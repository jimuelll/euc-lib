const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const repository = require("../modules/recommendations/recommendations.repository");
const service = require("../modules/recommendations/recommendations.service");

test("AI backfill selects books with missing, stale, or failed embeddings", async () => {
  const originalQuery = db.query;
  let statement = "";
  try {
    db.query = async (sql) => {
      statement = sql;
      return [[{ id: 12, title: "Missing vector" }, { id: 13, title: "Stale vector" }]];
    };

    const books = await repository.findBooksForBackfill();

    assert.deepEqual(books.map((book) => book.id), [12, 13]);
    assert.match(statement, /LEFT JOIN book_embeddings embeddings/);
    assert.match(statement, /OR embeddings\.book_id IS NULL/);
    assert.match(statement, /OR embeddings\.status <> 'ready'/);
    assert.match(statement, /COALESCE\(enrichment\.source, ''\) <> 'manual'/);
  } finally {
    db.query = originalQuery;
  }
});

test("AI backfill reuses useful saved metadata when only an embedding needs repair", async () => {
  const originalFindEnrichment = repository.findEnrichment;
  const originalFetch = global.fetch;
  const savedMetadata = { description: "Existing book summary", subjects: ["History"] };
  try {
    repository.findEnrichment = async () => ({
      source: "openlibrary_googlebooks",
      status: "ready",
      enrichment_json: JSON.stringify(savedMetadata),
    });
    global.fetch = async () => { throw new Error("Unexpected online lookup"); };

    const metadata = await service.enrichBook(123);

    assert.deepEqual(metadata, savedMetadata);
  } finally {
    repository.findEnrichment = originalFindEnrichment;
    global.fetch = originalFetch;
  }
});

test("online metadata lookup failures are tracked separately from embedding failures", async () => {
  const originals = {
    findEnrichment: repository.findEnrichment,
    findBookIsbn: repository.findBookIsbn,
    markEnrichmentFailed: repository.markEnrichmentFailed,
    fetch: global.fetch,
    googleKey: process.env.GOOGLE_BOOKS_API_KEY,
  };
  let savedFailure = null;
  try {
    repository.findEnrichment = async () => null;
    repository.findBookIsbn = async () => ({ id: 124, isbn: "9781234567890" });
    repository.markEnrichmentFailed = async (_bookId, message) => { savedFailure = message; };
    delete process.env.GOOGLE_BOOKS_API_KEY;
    global.fetch = async () => ({ ok: false, status: 503 });

    const result = await service.enrichBook(124);

    assert.deepEqual(result, {
      __lookupFailed: true,
      __lookupError: "Open Library: Metadata source failed (503)",
    });
    assert.equal(savedFailure, "Open Library: Metadata source failed (503)");
  } finally {
    repository.findEnrichment = originals.findEnrichment;
    repository.findBookIsbn = originals.findBookIsbn;
    repository.markEnrichmentFailed = originals.markEnrichmentFailed;
    global.fetch = originals.fetch;
    if (originals.googleKey === undefined) delete process.env.GOOGLE_BOOKS_API_KEY;
    else process.env.GOOGLE_BOOKS_API_KEY = originals.googleKey;
  }
});

test("Google Books can enrich a book when Open Library is unavailable", async () => {
  const originals = {
    findEnrichment: repository.findEnrichment,
    findBookIsbn: repository.findBookIsbn,
    saveEnrichment: repository.saveEnrichment,
    fetch: global.fetch,
    contact: process.env.OPEN_LIBRARY_CONTACT_EMAIL,
    googleKey: process.env.GOOGLE_BOOKS_API_KEY,
  };
  let savedMetadata = null;
  let openLibraryUserAgent = "";
  try {
    repository.findEnrichment = async () => null;
    repository.findBookIsbn = async () => ({ id: 126, isbn: "9781234567890" });
    repository.saveEnrichment = async (_bookId, metadata) => { savedMetadata = metadata; };
    process.env.OPEN_LIBRARY_CONTACT_EMAIL = "catalog@example.test";
    process.env.GOOGLE_BOOKS_API_KEY = "books-test-key";
    global.fetch = async (url, options) => {
      if (String(url).startsWith("https://openlibrary.org/")) {
        openLibraryUserAgent = options.headers["User-Agent"];
        return { ok: false, status: 503 };
      }
      return {
        ok: true,
        json: async () => ({ items: [{ volumeInfo: { description: "A recovered summary", categories: ["History"], publisher: "Example Press" } }] }),
      };
    };

    const result = await service.enrichBook(126);

    assert.equal(result.description, "A recovered summary");
    assert.deepEqual(result.categories, ["History"]);
    assert.deepEqual(savedMetadata, result);
    assert.match(openLibraryUserAgent, /^ECULibraryCatalogue\/1\.0 \(catalog@example\.test\)$/);
  } finally {
    repository.findEnrichment = originals.findEnrichment;
    repository.findBookIsbn = originals.findBookIsbn;
    repository.saveEnrichment = originals.saveEnrichment;
    global.fetch = originals.fetch;
    if (originals.contact === undefined) delete process.env.OPEN_LIBRARY_CONTACT_EMAIL;
    else process.env.OPEN_LIBRARY_CONTACT_EMAIL = originals.contact;
    if (originals.googleKey === undefined) delete process.env.GOOGLE_BOOKS_API_KEY;
    else process.env.GOOGLE_BOOKS_API_KEY = originals.googleKey;
  }
});

test("Open Library ISBN search enriches books without a Google Books key", async () => {
  const originals = {
    findEnrichment: repository.findEnrichment,
    findBookIsbn: repository.findBookIsbn,
    saveEnrichment: repository.saveEnrichment,
    fetch: global.fetch,
    googleKey: process.env.GOOGLE_BOOKS_API_KEY,
  };
  let savedMetadata = null;
  try {
    repository.findEnrichment = async () => null;
    repository.findBookIsbn = async () => ({ id: 127, isbn: "9781234567890" });
    repository.saveEnrichment = async (_bookId, metadata) => { savedMetadata = metadata; };
    delete process.env.GOOGLE_BOOKS_API_KEY;
    global.fetch = async (url) => {
      assert.match(String(url), /search\.json\?isbn=9781234567890/);
      return { ok: true, json: async () => ({ docs: [{ subject: ["Library science"], publisher: ["Example Press"], language: ["eng"], number_of_pages_median: 248, publish_year: [2024] }] }) };
    };

    const result = await service.enrichBook(127);

    assert.deepEqual(result.subjects, ["Library science"]);
    assert.equal(result.publisher, "Example Press");
    assert.equal(result.pageCount, 248);
    assert.equal(result.publishedDate, 2024);
    assert.deepEqual(savedMetadata, result);
  } finally {
    repository.findEnrichment = originals.findEnrichment;
    repository.findBookIsbn = originals.findBookIsbn;
    repository.saveEnrichment = originals.saveEnrichment;
    global.fetch = originals.fetch;
    if (originals.googleKey === undefined) delete process.env.GOOGLE_BOOKS_API_KEY;
    else process.env.GOOGLE_BOOKS_API_KEY = originals.googleKey;
  }
});

test("book details expose a safe online lookup error to staff", async () => {
  const originalFindRecord = repository.findBookMetadataRecord;
  try {
    repository.findBookMetadataRecord = async () => ({
      id: 125,
      title: "Lookup failure",
      author: "A. Writer",
      isbn: "9781234567890",
      material_type: "book",
      metadata_source: "none",
      metadata_status: "failed",
      metadata_error: "Metadata source failed (503) https://books.example.test/lookup?key=secret-token",
      enrichment_json: null,
      embedding_status: "ready",
      embedding_error: null,
    });

    const result = await service.getManualMetadata(125);

    assert.equal(result.metadataStatus, "failed");
    assert.equal(result.metadataError, "Metadata source failed (503) [metadata provider]");
    assert.equal(result.embeddingStatus, "ready");
    assert.equal(result.summary, "");
    assert.doesNotMatch(result.metadataError, /secret-token|https?:/i);
  } finally {
    repository.findBookMetadataRecord = originalFindRecord;
  }
});

test("embedding status counts books with no embedding record", async () => {
  const originalQuery = db.query;
  const originalGetStatus = repository.getEmbeddingStatus;
  const originalErrors = [{ book_id: 99, last_error: "Gemini unavailable" }];
  const queries = [];
  try {
    db.query = async (sql) => {
      queries.push(sql);
      return queries.length === 1
        ? [[{ total: 7, ready: 5, stale: 1, failed: 1, missing: 3 }]]
        : [originalErrors];
    };
    repository.getEmbeddingStatus = originalGetStatus;

    const status = await repository.getEmbeddingStatus();

    assert.equal(Number(status.row.missing), 3);
    assert.deepEqual(status.errors, originalErrors);
    assert.match(queries[0], /COALESCE\(SUM\(embeddings\.book_id IS NULL\), 0\) AS missing/);
    assert.match(queries[0], /bk\.material_type = 'book' AND bk\.deleted_at IS NULL/);
  } finally {
    db.query = originalQuery;
    repository.getEmbeddingStatus = originalGetStatus;
  }

  const originalGetStatusForService = repository.getEmbeddingStatus;
  try {
    repository.getEmbeddingStatus = async () => ({ row: { total: 7, ready: 5, stale: 1, failed: 1, missing: 3 }, errors: [] });
    assert.equal((await service.embeddingStatus()).missing, 3);
  } finally {
    repository.getEmbeddingStatus = originalGetStatusForService;
  }
});

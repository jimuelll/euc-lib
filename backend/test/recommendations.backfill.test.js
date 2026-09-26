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
      __lookupError: "Open Library: Metadata source failed (503); Open Library search: Metadata source failed (503); Google Books: Metadata source failed (503)",
    });
    assert.equal(savedFailure, result.__lookupError);
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
    const requests = [];
    global.fetch = async (url) => {
      requests.push(String(url));
      if (String(url).includes("/api/books?")) return { ok: true, json: async () => ({}) };
      if (String(url).includes("/search.json?")) {
        return { ok: true, json: async () => ({ docs: [{ subject: ["Library science"], publisher: ["Example Press"], language: ["eng"], number_of_pages_median: 248, publish_year: [2024] }] }) };
      }
      assert.match(String(url), /^https:\/\/www\.googleapis\.com\/books\/v1\/volumes\?q=isbn:9781234567890$/);
      return { ok: true, json: async () => ({ items: [] }) };
    };

    const result = await service.enrichBook(127);

    assert.deepEqual(result.subjects, ["Library science"]);
    assert.equal(result.publisher, "Example Press");
    assert.equal(result.pageCount, 248);
    assert.equal(result.publishedDate, "2024");
    assert.deepEqual(savedMetadata, result);
    assert.equal(requests.length, 3);
  } finally {
    repository.findEnrichment = originals.findEnrichment;
    repository.findBookIsbn = originals.findBookIsbn;
    repository.saveEnrichment = originals.saveEnrichment;
    global.fetch = originals.fetch;
    if (originals.googleKey === undefined) delete process.env.GOOGLE_BOOKS_API_KEY;
    else process.env.GOOGLE_BOOKS_API_KEY = originals.googleKey;
  }
});

test("an imported synopsis is saved privately and included in the generated embedding", async () => {
  const originals = {
    findEnrichment: repository.findEnrichment,
    findBookIsbn: repository.findBookIsbn,
    saveEnrichment: repository.saveEnrichment,
    findBookForEmbedding: repository.findBookForEmbedding,
    findReadyEnrichment: repository.findReadyEnrichment,
    saveEmbedding: repository.saveEmbedding,
    fetch: global.fetch,
    provider: process.env.AI_EMBEDDING_PROVIDER,
    geminiKey: process.env.GEMINI_API_KEY,
  };
  let savedEnrichment = null;
  let embeddingRequest = null;
  let savedEmbedding = null;
  try {
    repository.findEnrichment = async () => null;
    repository.findBookIsbn = async () => ({ id: 128, isbn: "9781234567890" });
    repository.saveEnrichment = async (_bookId, metadata) => { savedEnrichment = metadata; };
    repository.findBookForEmbedding = async () => ({
      id: 128, title: "Imported synopsis test", author: "A. Writer", material_type: "book",
      metadata: JSON.stringify({ category: "Literature", edition: "First", publication_year: "2024" }),
    });
    repository.findReadyEnrichment = async () => ({ enrichment_json: JSON.stringify(savedEnrichment) });
    repository.saveEmbedding = async (embedding) => { savedEmbedding = embedding; };
    process.env.AI_EMBEDDING_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    global.fetch = async (url, options) => {
      if (String(url).startsWith("https://openlibrary.org/api/books?")) {
        return { ok: true, json: async () => ({ "ISBN:9781234567890": { subjects: [{ name: "Literature" }] } }) };
      }
      if (String(url).startsWith("https://www.googleapis.com/books/v1/volumes?")) {
        return { ok: true, json: async () => ({ items: [{ volumeInfo: { description: "<p>A &amp; clean synopsis.</p><script>ignored</script>" } }] }) };
      }
      assert.match(String(url), /generativelanguage\.googleapis\.com/);
      embeddingRequest = JSON.parse(options.body);
      return { ok: true, json: async () => ({ embedding: { values: [0.1, 0.2] } }) };
    };

    const enrichment = await service.enrichBook(128);
    const embedding = await service.embedBook(128);

    assert.equal(enrichment.description, "A & clean synopsis.");
    assert.equal(savedEnrichment.description, "A & clean synopsis.");
    assert.deepEqual(savedEnrichment.subjects, ["Literature"]);
    assert.match(embeddingRequest.content.parts[0].text, /A & clean synopsis\./);
    assert.deepEqual(savedEmbedding.vector, [0.1, 0.2]);
    assert.deepEqual(embedding, { bookId: 128, dimensions: 2 });
  } finally {
    repository.findEnrichment = originals.findEnrichment;
    repository.findBookIsbn = originals.findBookIsbn;
    repository.saveEnrichment = originals.saveEnrichment;
    repository.findBookForEmbedding = originals.findBookForEmbedding;
    repository.findReadyEnrichment = originals.findReadyEnrichment;
    repository.saveEmbedding = originals.saveEmbedding;
    global.fetch = originals.fetch;
    if (originals.provider === undefined) delete process.env.AI_EMBEDDING_PROVIDER;
    else process.env.AI_EMBEDDING_PROVIDER = originals.provider;
    if (originals.geminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originals.geminiKey;
  }
});

test("automatic ISBN enrichment does not replace staff-entered AI metadata", async () => {
  const originals = { findEnrichment: repository.findEnrichment, fetch: global.fetch };
  const staffMetadata = { description: "Staff reviewed description", subjects: ["Staff topic"] };
  try {
    repository.findEnrichment = async () => ({ source: "manual", enrichment_json: JSON.stringify(staffMetadata) });
    global.fetch = async () => { throw new Error("Manual metadata should avoid provider lookup"); };

    const result = await service.enrichBook(129);

    assert.deepEqual(result, staffMetadata);
  } finally {
    repository.findEnrichment = originals.findEnrichment;
    global.fetch = originals.fetch;
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

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const db = require("../db");
const isbnLookup = require("../modules/catalog/isbn-metadata.lookup");
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

test("a successful Google Books check with no description is marked complete and remains visible to staff", async () => {
  const originals = {
    findEnrichment: repository.findEnrichment,
    findBookIsbn: repository.findBookIsbn,
    saveEnrichment: repository.saveEnrichment,
    findBookMetadataRecord: repository.findBookMetadataRecord,
    fetch: global.fetch,
  };
  let saved = null;
  try {
    repository.findEnrichment = async () => ({ source: "openlibrary_googlebooks", status: "ready", enrichment_json: JSON.stringify({ subjects: ["History"] }) });
    repository.findBookIsbn = async () => ({ id: 130, isbn: "9781234567890" });
    repository.saveEnrichment = async (_bookId, enrichment) => { saved = enrichment; };
    repository.findBookMetadataRecord = async () => ({
      id: 130, title: "No online synopsis", author: "A. Writer", isbn: "9781234567890", material_type: "book",
      metadata_source: "openlibrary_googlebooks", metadata_status: "ready", enrichment_json: JSON.stringify(saved),
      metadata_error: null, embedding_status: "ready", embedding_error: null,
    });
    global.fetch = async () => ({ ok: true, json: async () => ({ items: [] }) });

    const enrichment = await service.enrichBook(130);
    const details = await service.getManualMetadata(130);

    assert.equal(enrichment.googleBooksSynopsisCheckVersion, 1);
    assert.equal(enrichment.description, undefined);
    assert.equal(details.synopsisStatus, "no_description");
    assert.equal(details.summary, "");
  } finally {
    repository.findEnrichment = originals.findEnrichment;
    repository.findBookIsbn = originals.findBookIsbn;
    repository.saveEnrichment = originals.saveEnrichment;
    repository.findBookMetadataRecord = originals.findBookMetadataRecord;
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
        ? [[{ total: 7, ready: 5, stale: 1, failed: 1, missing: 3, missing_synopses: 2, needs_attention: 4 }]]
        : [originalErrors];
    };
    repository.getEmbeddingStatus = originalGetStatus;

    const status = await repository.getEmbeddingStatus();

    assert.equal(Number(status.row.missing), 3);
    assert.equal(Number(status.row.missing_synopses), 2);
    assert.equal(Number(status.row.needs_attention), 4);
    assert.deepEqual(status.errors, originalErrors);
    assert.match(queries[0], /COALESCE\(SUM\(embeddings\.book_id IS NULL\), 0\) AS missing/);
    assert.match(queries[0], /AS missing_synopses/);
    assert.match(queries[0], /AS needs_attention/);
    assert.match(queries[0], /JSON_EXTRACT\(enrichment\.enrichment_json, '\$\.description'\)/);
    assert.match(queries[0], /bk\.material_type = 'book' AND bk\.deleted_at IS NULL/);
  } finally {
    db.query = originalQuery;
    repository.getEmbeddingStatus = originalGetStatus;
  }

  const originalGetStatusForService = repository.getEmbeddingStatus;
  try {
    repository.getEmbeddingStatus = async () => ({ row: { total: 7, ready: 5, stale: 1, failed: 1, missing: 3, missing_synopses: 2, needs_attention: 4 }, errors: [] });
    assert.equal((await service.embeddingStatus()).missing, 3);
    assert.equal((await service.embeddingStatus()).missingSynopses, 2);
    assert.equal((await service.embeddingStatus()).needsAttention, 4);
  } finally {
    repository.getEmbeddingStatus = originalGetStatusForService;
  }
});

test("manual books with blank summaries stay in the attention list with a missing synopsis status", async () => {
  const originals = {
    findBookMetadataRecord: repository.findBookMetadataRecord,
    listBooksForMetadata: repository.listBooksForMetadata,
  };
  try {
    repository.findBookMetadataRecord = async () => ({
      id: 301, title: "Staff topics only", author: "A. Writer", isbn: null, material_type: "book",
      metadata_source: "manual", metadata_status: "ready", metadata_error: null,
      enrichment_json: JSON.stringify({ description: "", subjects: ["History"] }), embedding_status: "ready", embedding_error: null,
    });
    repository.listBooksForMetadata = async () => ({
      total: 1,
      rows: [{ id: 301, title: "Staff topics only", author: "A. Writer", isbn: null, metadata_source: "manual", metadata_status: "ready", enrichment_json: JSON.stringify({ description: "", subjects: ["History"] }), embedding_status: "ready" }],
    });

    const details = await service.getManualMetadata(301);
    const result = await service.listMetadataBooks({ needsAttention: true });

    assert.equal(details.synopsisStatus, "missing");
    assert.equal(details.summary, "");
    assert.equal(result.pagination.total, 1);
    assert.equal(result.rows[0].synopsisStatus, "missing");
    assert.equal(result.rows[0].metadataStatus, "manual");
  } finally {
    repository.findBookMetadataRecord = originals.findBookMetadataRecord;
    repository.listBooksForMetadata = originals.listBooksForMetadata;
  }
});

test("the attention-list query includes blank summaries independently of manual metadata", async () => {
  const originalQuery = db.query;
  const statements = [];
  try {
    db.query = async (sql) => {
      statements.push(sql);
      return statements.length === 1
        ? [[{ total: 1 }]]
        : [[{ id: 302, title: "Manual blank synopsis", author: "A. Writer", isbn: null, metadata_source: "manual", metadata_status: "ready", enrichment_json: JSON.stringify({ subjects: ["History"] }), embedding_status: "ready" }]];
    };

    const result = await repository.listBooksForMetadata({ needsAttention: true });

    assert.equal(result.total, 1);
    assert.equal(result.rows[0].metadata_source, "manual");
    assert.match(statements[0], /SELECT COUNT\(\*\) AS total/);
    assert.match(statements[0], /JSON_EXTRACT\(enrichment\.enrichment_json, '\$\.description'\)/);
    assert.match(statements[0], /OR \(COALESCE\(enrichment\.source, ''\) <> 'manual'/);
    assert.match(statements[0], /embeddings\.status <> 'ready'/);
  } finally {
    db.query = originalQuery;
  }
});

test("a 429 retries once then pauses the batch and leaves remaining books deferred", async () => {
  const originals = {
    findBooksForBackfill: repository.findBooksForBackfill,
    getEmbeddingStatus: repository.getEmbeddingStatus,
    findEnrichment: repository.findEnrichment,
    findBookIsbn: repository.findBookIsbn,
    saveEnrichment: repository.saveEnrichment,
    findBookForEmbedding: repository.findBookForEmbedding,
    findReadyEnrichment: repository.findReadyEnrichment,
    fetch: global.fetch,
    model: process.env.GEMINI_EMBEDDING_MODEL,
    googleKey: process.env.GOOGLE_BOOKS_API_KEY,
  };
  const books = [401, 402, 403].map((id) => ({ id, title: `Book ${id}`, author: "A. Writer", material_type: "book", metadata: "{}" }));
  const saved = new Map();
  let googleRequests = 0;
  try {
    repository.findBooksForBackfill = async () => books.map(({ id, title }) => ({ id, title }));
    repository.getEmbeddingStatus = async () => ({ row: { total: 3, ready: 3, stale: 0, failed: 0, missing: 0, missing_synopses: 3, needs_attention: 3 }, errors: [] });
    repository.findEnrichment = async () => ({ source: "openlibrary_googlebooks", status: "ready", enrichment_json: JSON.stringify({ subjects: ["History"] }) });
    repository.findBookIsbn = async (id) => ({ id, isbn: `9780000000${id}` });
    repository.saveEnrichment = async (id, enrichment) => { saved.set(id, enrichment); };
    repository.findBookForEmbedding = async (id) => books.find((book) => book.id === id);
    repository.findReadyEnrichment = async (id) => {
      const enrichment = saved.get(id) || { subjects: ["History"] };
      const text = [books.find((book) => book.id === id).title, "A. Writer", ...(enrichment.subjects || [])].filter(Boolean).join("\n");
      return {
        enrichment_json: JSON.stringify(enrichment), embedding_status: "ready", embedding_model: "backfill-test-model",
        embedding_content_hash: crypto.createHash("sha256").update(text).digest("hex"), embedding_dimensions: 4,
      };
    };
    process.env.GEMINI_EMBEDDING_MODEL = "backfill-test-model";
    delete process.env.GOOGLE_BOOKS_API_KEY;
    global.fetch = async (url) => {
      assert.match(String(url), /^https:\/\/www\.googleapis\.com\/books\/v1\/volumes/);
      googleRequests += 1;
      return { ok: false, status: 429, headers: { get: () => "0" } };
    };

    const started = await service.startBackfill();
    assert.equal(started.status, "running");
    const deadline = Date.now() + 5000;
    let progress = service.backfillProgress();
    while (progress.status === "running" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      progress = service.backfillProgress();
    }

    assert.equal(progress.status, "paused_rate_limited");
    assert.equal(progress.completed, 1);
    assert.equal(progress.deferred, 2);
    assert.equal(progress.lookupFailed, 1);
    assert.equal(progress.failed, 0);
    assert.equal(googleRequests, 2, "Google Books is retried once after a 429");
    assert.ok(progress.rateLimitRetryAt);
    assert.match(saved.get(401).googleBooksSynopsisLastError, /429/);
    assert.equal(saved.has(402), false);
    assert.equal(saved.has(403), false);
  } finally {
    repository.findBooksForBackfill = originals.findBooksForBackfill;
    repository.getEmbeddingStatus = originals.getEmbeddingStatus;
    repository.findEnrichment = originals.findEnrichment;
    repository.findBookIsbn = originals.findBookIsbn;
    repository.saveEnrichment = originals.saveEnrichment;
    repository.findBookForEmbedding = originals.findBookForEmbedding;
    repository.findReadyEnrichment = originals.findReadyEnrichment;
    global.fetch = originals.fetch;
    if (originals.model === undefined) delete process.env.GEMINI_EMBEDDING_MODEL;
    else process.env.GEMINI_EMBEDDING_MODEL = originals.model;
    if (originals.googleKey === undefined) delete process.env.GOOGLE_BOOKS_API_KEY;
    else process.env.GOOGLE_BOOKS_API_KEY = originals.googleKey;
  }
});

test("Google Books lookup exposes long Retry-After values without waiting past the cap", async () => {
  const originalFetch = global.fetch;
  let requests = 0;
  try {
    global.fetch = async () => {
      requests += 1;
      return { ok: false, status: 429, headers: { get: () => "61" } };
    };

    const lookup = await isbnLookup.lookupGoogleBooksSynopsis("9781234567890", { retryRateLimit: true });

    assert.equal(requests, 1);
    assert.equal(lookup.status, 429);
    assert.equal(lookup.retryAfterMs, 61000);
    assert.equal(lookup.rateLimited, true);
    assert.match(lookup.errors[0], /429/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("provider failures finish with errors even when embeddings succeed", async () => {
  const originals = {
    findBooksForBackfill: repository.findBooksForBackfill,
    getEmbeddingStatus: repository.getEmbeddingStatus,
    findEnrichment: repository.findEnrichment,
    findBookIsbn: repository.findBookIsbn,
    markEnrichmentFailed: repository.markEnrichmentFailed,
    findBookForEmbedding: repository.findBookForEmbedding,
    findReadyEnrichment: repository.findReadyEnrichment,
    saveEmbedding: repository.saveEmbedding,
    fetch: global.fetch,
    aiProvider: process.env.AI_EMBEDDING_PROVIDER,
    geminiKey: process.env.GEMINI_API_KEY,
  };
  let savedFailure = null;
  try {
    repository.findBooksForBackfill = async () => [{ id: 501, title: "Provider failure" }];
    repository.getEmbeddingStatus = async () => ({ row: { total: 1, ready: 1, stale: 0, failed: 0, missing: 0, missing_synopses: 1, needs_attention: 1 }, errors: [] });
    repository.findEnrichment = async () => null;
    repository.findBookIsbn = async () => ({ id: 501, isbn: "9781234567890" });
    repository.markEnrichmentFailed = async (_bookId, message, enrichment) => { savedFailure = { message, enrichment }; };
    repository.findBookForEmbedding = async () => ({ id: 501, title: "Provider failure", author: "A. Writer", material_type: "book", metadata: "{}" });
    repository.findReadyEnrichment = async () => ({ enrichment_json: JSON.stringify(savedFailure?.enrichment || {}) });
    repository.saveEmbedding = async () => {};
    process.env.AI_EMBEDDING_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    global.fetch = async (url) => {
      const target = String(url);
      if (target.startsWith("https://openlibrary.org/")) return { ok: true, json: async () => ({}) };
      if (target.startsWith("https://www.googleapis.com/books/")) return { ok: false, status: 503 };
      assert.match(target, /generativelanguage\.googleapis\.com/);
      return { ok: true, json: async () => ({ embedding: { values: [0.2, 0.3] } }) };
    };

    await service.startBackfill();
    const deadline = Date.now() + 5000;
    let progress = service.backfillProgress();
    while (progress.status === "running" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      progress = service.backfillProgress();
    }

    assert.equal(progress.status, "completed_with_errors");
    assert.equal(progress.lookupFailed, 1);
    assert.equal(progress.failed, 0);
    assert.equal(progress.embedded, 1);
    assert.match(savedFailure.message, /Google Books: Metadata source failed \(503\)/);
    assert.match(savedFailure.enrichment.googleBooksSynopsisLastError, /503/);
  } finally {
    repository.findBooksForBackfill = originals.findBooksForBackfill;
    repository.getEmbeddingStatus = originals.getEmbeddingStatus;
    repository.findEnrichment = originals.findEnrichment;
    repository.findBookIsbn = originals.findBookIsbn;
    repository.markEnrichmentFailed = originals.markEnrichmentFailed;
    repository.findBookForEmbedding = originals.findBookForEmbedding;
    repository.findReadyEnrichment = originals.findReadyEnrichment;
    repository.saveEmbedding = originals.saveEmbedding;
    global.fetch = originals.fetch;
    if (originals.aiProvider === undefined) delete process.env.AI_EMBEDDING_PROVIDER;
    else process.env.AI_EMBEDDING_PROVIDER = originals.aiProvider;
    if (originals.geminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originals.geminiKey;
  }
});

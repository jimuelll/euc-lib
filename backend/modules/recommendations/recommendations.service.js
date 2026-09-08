const crypto = require("crypto");
const db = require("../../db");
const { hydrateCatalogRecord, parseMetadata } = require("../catalog/catalog.projection");

const BOOK_LIMIT = 5;
const THESIS_LIMIT = 5;
const embeddingModel = () => process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
let activeBackfill = { status: "idle", total: 0, completed: 0, embedded: 0, failed: 0, skipped: 0, currentTitle: null, errors: [] };

const normalized = (value) => String(value || "").toLowerCase().trim();
const tokens = (value) => new Set(normalized(value).split(/[^a-z0-9]+/).filter((token) => token.length > 2));
const overlap = (a, b) => {
  const left = tokens(a); const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let count = 0; for (const token of left) if (right.has(token)) count += 1;
  return count / Math.max(left.size, right.size);
};
const cosine = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return -1;
  let dot = 0; let leftMagnitude = 0; let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) { dot += left[index] * right[index]; leftMagnitude += left[index] ** 2; rightMagnitude += right[index] ** 2; }
  return leftMagnitude && rightMagnitude ? dot / Math.sqrt(leftMagnitude * rightMagnitude) : -1;
};

const embeddingText = (book, enrichment = {}) => {
  const metadata = parseMetadata(book.metadata);
  const fields = book.material_type === "thesis"
    ? [book.title, book.author, metadata.thesis_program, metadata.thesis_keywords, metadata.thesis_abstract, metadata.thesis_adviser, metadata.academic_year]
    : [book.title, book.author, metadata.category, metadata.edition, metadata.publication_year, enrichment.description, ...(enrichment.subjects || []), ...(enrichment.categories || []), enrichment.publisher, enrichment.language];
  return fields.filter(Boolean).join("\n");
};
const contentHash = (book, enrichment) => crypto.createHash("sha256").update(embeddingText(book, enrichment)).digest("hex");

const publicFields = async () => {
  const [fields] = await db.query("SELECT `key` FROM catalog_schema WHERE `public` = 1 AND archived = 0");
  return new Set(fields.map((field) => field.key));
};
const activeCandidates = async (materialType, excludedIds = []) => {
  const exclusion = excludedIds.length ? " AND bk.id NOT IN (?)" : "";
  const params = [materialType, ...(excludedIds.length ? [excludedIds] : [])];
  const [rows] = await db.query(
    `SELECT bk.*, COUNT(DISTINCT bc.id) AS total_copies,
       GREATEST(0, COUNT(DISTINCT bc.id) - COUNT(DISTINCT CASE WHEN br.status IN ('borrowed','overdue') OR rr.id IS NOT NULL THEN bc.id END)) AS available,
       COUNT(DISTINCT completed.id) AS popularity
     FROM books bk
     LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.condition IN ('good','damaged') AND bc.deleted_at IS NULL
     LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.status IN ('borrowed','overdue') AND br.deleted_at IS NULL
     LEFT JOIN reservations rr ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL
     LEFT JOIN borrowings completed ON completed.book_id = bk.id AND completed.status = 'returned' AND completed.deleted_at IS NULL
     WHERE bk.material_type = ? AND bk.deleted_at IS NULL${exclusion}
     GROUP BY bk.id`, params
  );
  return rows;
};
const serialize = async (records) => {
  const fields = [...await publicFields()];
  return records.map((record) => {
    const hydrated = hydrateCatalogRecord(record, { publicKeys: fields });
    return {
      id: hydrated.id, title: hydrated.title, author: hydrated.author, isbn: hydrated.isbn,
      copies: hydrated.copies, material_type: hydrated.material_type, metadata: hydrated.metadata,
      ...hydrated.metadata, canBorrow: hydrated.canBorrow, canReserve: hydrated.canReserve,
      available: Number(record.available || 0), total_copies: Number(record.total_copies || 0),
      reason: record.reason, source: record.source,
    };
  });
};

const ruleScore = (seed, candidate) => {
  const seedMeta = parseMetadata(seed.metadata); const candidateMeta = parseMetadata(candidate.metadata);
  if (seed.material_type === "thesis") {
    return (normalized(seedMeta.thesis_program) && normalized(seedMeta.thesis_program) === normalized(candidateMeta.thesis_program) ? 8 : 0)
      + overlap(seedMeta.thesis_keywords, candidateMeta.thesis_keywords) * 5
      + (normalized(seedMeta.thesis_adviser) && normalized(seedMeta.thesis_adviser) === normalized(candidateMeta.thesis_adviser) ? 2 : 0)
      + (normalized(seedMeta.academic_year) && normalized(seedMeta.academic_year) === normalized(candidateMeta.academic_year) ? 1 : 0)
      + overlap(`${seed.title} ${seed.author}`, `${candidate.title} ${candidate.author}`);
  }
  return (normalized(seedMeta.category) && normalized(seedMeta.category) === normalized(candidateMeta.category) ? 8 : 0)
    + (normalized(seed.author) && normalized(seed.author) === normalized(candidate.author) ? 3 : 0)
    + overlap(`${seed.title} ${seed.author}`, `${candidate.title} ${candidate.author}`)
    + Number(candidate.popularity || 0) / 1000;
};
const ruleReason = (seed, candidate) => {
  const a = parseMetadata(seed.metadata); const b = parseMetadata(candidate.metadata);
  if (seed.material_type === "thesis") {
    if (a.thesis_program && normalized(a.thesis_program) === normalized(b.thesis_program)) return `Same program: ${a.thesis_program}`;
    if (overlap(a.thesis_keywords, b.thesis_keywords)) return "Related thesis keywords";
    return "Related thesis topic";
  }
  if (a.category && normalized(a.category) === normalized(b.category)) return `Similar category: ${a.category}`;
  if (seed.author && normalized(seed.author) === normalized(candidate.author)) return `Also by ${seed.author}`;
  return "Related catalogue title";
};

const getEmbedding = async (bookId) => {
  const [[row]] = await db.query("SELECT vector_json FROM book_embeddings WHERE book_id = ? AND status = 'ready' LIMIT 1", [bookId]);
  try { return row ? JSON.parse(row.vector_json) : null; } catch { return null; }
};
const semanticMatches = async (seed, candidates, limit, excluded = new Set()) => {
  const vector = await getEmbedding(seed.id); if (!vector) return [];
  const [rows] = await db.query("SELECT book_id, vector_json FROM book_embeddings WHERE status = 'ready' AND book_id IN (?)", [candidates.map((candidate) => candidate.id)]);
  const byId = new Map(rows.map((row) => { try { return [row.book_id, JSON.parse(row.vector_json)]; } catch { return [row.book_id, null]; } }));
  return candidates.filter((candidate) => !excluded.has(candidate.id) && byId.has(candidate.id))
    .map((candidate) => ({ ...candidate, score: cosine(vector, byId.get(candidate.id)), source: "ai", reason: "Similar subject and catalogue details" }))
    .filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
};

const recommendationsForSeed = async (bookId) => {
  const [[seed]] = await db.query("SELECT * FROM books WHERE id = ? AND deleted_at IS NULL LIMIT 1", [bookId]);
  if (!seed) { const error = new Error("Catalogue record not found"); error.status = 404; throw error; }
  const candidates = await activeCandidates(seed.material_type, [seed.id]);
  const ruleLimit = seed.material_type === "book" ? 3 : THESIS_LIMIT;
  const rules = candidates.map((candidate) => ({ ...candidate, score: ruleScore(seed, candidate), source: "rule", reason: ruleReason(seed, candidate) }))
    .sort((a, b) => b.score - a.score || b.popularity - a.popularity).slice(0, ruleLimit);
  const semantic = seed.material_type === "book" ? await semanticMatches(seed, candidates, 2, new Set(rules.map((item) => item.id))) : [];
  return { material_type: seed.material_type, rows: await serialize([...rules, ...semantic]) };
};

const historySeeds = async (userId, materialType) => {
  const [rows] = await db.query(
    `SELECT bk.*, MAX(activity.at) AS activity_at
     FROM (
       SELECT book_id, returned_at AS at FROM borrowings WHERE user_id = ? AND status IN ('borrowed','overdue','returned') AND deleted_at IS NULL
       UNION ALL
       SELECT book_id, COALESCE(fulfilled_at, reserved_at) AS at FROM reservations WHERE user_id = ? AND status IN ('pending','ready','fulfilled') AND deleted_at IS NULL
     ) activity JOIN books bk ON bk.id = activity.book_id
     WHERE bk.material_type = ? AND bk.deleted_at IS NULL GROUP BY bk.id ORDER BY activity_at DESC LIMIT 12`, [userId, userId, materialType]
  );
  return rows;
};
const personalized = async (userId, materialType) => {
  if (!["book", "thesis"].includes(materialType)) { const error = new Error("materialType must be book or thesis"); error.status = 400; throw error; }
  const seeds = await historySeeds(userId, materialType);
  if (!seeds.length) return { material_type: materialType, rows: [], has_history: false };
  const [[dismissed]] = await db.query("SELECT GROUP_CONCAT(book_id) AS ids FROM recommendation_feedback WHERE user_id = ? AND feedback = 'dismissed'", [userId]);
  const dismissIds = String(dismissed?.ids || "").split(",").filter(Boolean).map(Number);
  const candidates = await activeCandidates(materialType, [...seeds.map((seed) => seed.id), ...dismissIds]);
  const anchor = seeds[0];
  const ruleLimit = materialType === "book" ? 3 : THESIS_LIMIT;
  const rules = candidates.map((candidate) => ({ ...candidate, score: seeds.reduce((total, seed, index) => total + ruleScore(seed, candidate) / (index + 1), 0), source: "rule", reason: `Based on your recent ${materialType === "book" ? "library activity" : "thesis activity"}` }))
    .sort((a, b) => b.score - a.score).slice(0, ruleLimit);
  const semantic = materialType === "book" ? await semanticMatches(anchor, candidates, 2, new Set(rules.map((item) => item.id))) : [];
  const rows = await serialize([...rules, ...semantic].map((row) => ({ ...row, reason: row.source === "ai" ? "Similar to your recent reading" : row.reason })));
  return { material_type: materialType, rows, has_history: true };
};

const dismiss = async (userId, bookId) => {
  const [[book]] = await db.query("SELECT id FROM books WHERE id = ? AND deleted_at IS NULL", [bookId]);
  if (!book) { const error = new Error("Catalogue record not found"); error.status = 404; throw error; }
  await db.query("INSERT INTO recommendation_feedback (user_id, book_id, feedback) VALUES (?, ?, 'dismissed') ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP", [userId, bookId]);
};

const toText = (value) => typeof value === "string" ? value : (value?.value || value?.text || "");
const unique = (values) => [...new Set(values.filter(Boolean).map((value) => String(value).trim()))];
const fetchJson = async (url) => { const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }); if (!response.ok) throw new Error(`Metadata source failed (${response.status})`); return response.json(); };
const enrichBook = async (bookId) => {
  const [[book]] = await db.query("SELECT id, isbn FROM books WHERE id = ? AND material_type = 'book' AND deleted_at IS NULL", [bookId]);
  if (!book?.isbn) return null;
  try {
    const open = await fetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(book.isbn)}&format=json&jscmd=data`);
    const openRecord = open[`ISBN:${book.isbn}`] || {};
    let googleRecord = {};
    try {
      const key = process.env.GOOGLE_BOOKS_API_KEY ? `&key=${encodeURIComponent(process.env.GOOGLE_BOOKS_API_KEY)}` : "";
      const google = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(book.isbn)}${key}`);
      googleRecord = google.items?.[0]?.volumeInfo || {};
    } catch { /* Open Library data remains useful when Google Books is unavailable. */ }
    const enrichment = {
      description: toText(googleRecord.description) || toText(openRecord.description),
      subjects: unique([...(openRecord.subjects || []).map((item) => item.name || item), ...(googleRecord.categories || [])]),
      categories: unique(googleRecord.categories || []), publisher: googleRecord.publisher || openRecord.publishers?.[0]?.name || "",
      language: googleRecord.language || "", pageCount: googleRecord.pageCount || openRecord.number_of_pages || null,
      publishedDate: googleRecord.publishedDate || openRecord.publish_date || "",
    };
    await db.query(`INSERT INTO book_enrichment (book_id, source, enrichment_json, status, enriched_at, last_error) VALUES (?, 'openlibrary_googlebooks', ?, 'ready', CURRENT_TIMESTAMP, NULL)
      ON DUPLICATE KEY UPDATE source=VALUES(source), enrichment_json=VALUES(enrichment_json), status='ready', enriched_at=CURRENT_TIMESTAMP, last_error=NULL`, [book.id, JSON.stringify(enrichment)]);
    return enrichment;
  } catch (error) {
    await db.query(`INSERT INTO book_enrichment (book_id, source, status, last_error) VALUES (?, 'none', 'failed', ?)
      ON DUPLICATE KEY UPDATE status='failed', last_error=VALUES(last_error)`, [book.id, String(error.message || error).slice(0, 500)]);
    return {};
  }
};

const embedBook = async (bookId) => {
  const [[book]] = await db.query("SELECT * FROM books WHERE id = ? AND deleted_at IS NULL", [bookId]);
  if (!book) return null;
  const [[enrichmentRow]] = await db.query("SELECT enrichment_json FROM book_enrichment WHERE book_id = ? AND status = 'ready'", [bookId]);
  let enrichment = {}; try { enrichment = enrichmentRow ? JSON.parse(enrichmentRow.enrichment_json) : {}; } catch { enrichment = {}; }
  const hash = contentHash(book, enrichment); const model = embeddingModel();
  if (process.env.AI_EMBEDDING_PROVIDER !== "gemini" || !process.env.GEMINI_API_KEY) throw new Error("Gemini embedding provider is not configured");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`,
    { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, body: JSON.stringify({ model: `models/${model}`, taskType: "SEMANTIC_SIMILARITY", content: { parts: [{ text: embeddingText(book, enrichment) }] } }) }
  );
  if (!response.ok) {
    const providerMessage = await response.text();
    throw new Error(`Gemini embedding request failed (${response.status}): ${providerMessage.slice(0, 400)}`);
  }
  const payload = await response.json(); const vector = payload.embedding?.values;
  if (!Array.isArray(vector) || !vector.length) throw new Error("Gemini returned no embedding vector");
  await db.query(`INSERT INTO book_embeddings (book_id, model, content_hash, vector_json, dimensions, status, embedded_at, last_error)
    VALUES (?, ?, ?, ?, ?, 'ready', CURRENT_TIMESTAMP, NULL)
    ON DUPLICATE KEY UPDATE model=VALUES(model), content_hash=VALUES(content_hash), vector_json=VALUES(vector_json), dimensions=VALUES(dimensions), status='ready', embedded_at=CURRENT_TIMESTAMP, last_error=NULL`, [book.id, model, hash, JSON.stringify(vector), vector.length]);
  return { bookId: book.id, dimensions: vector.length };
};
const markEmbeddingStale = async (bookId) => db.query("INSERT INTO book_embeddings (book_id, model, content_hash, status) VALUES (?, ?, '', 'stale') ON DUPLICATE KEY UPDATE status='stale'", [bookId, embeddingModel()]);
const queueEmbedding = async (bookId) => {
  await markEmbeddingStale(bookId);
  setImmediate(async () => {
    try { await embedBook(bookId); }
    catch (error) {
      await db.query("UPDATE book_embeddings SET status = 'failed', last_error = ? WHERE book_id = ?", [String(error.message || error).slice(0, 500), bookId]).catch(() => {});
      console.error("[recommendations] embedding failed:", error.message);
    }
  });
};
const queueEnrichmentAndEmbedding = (bookId) => new Promise((resolve) => {
  setImmediate(() => {
    enrichBook(bookId)
      .then(() => queueEmbedding(bookId))
      .catch((error) => console.error("[recommendations] enrichment/embedding refresh:", error))
      .finally(resolve);
  });
});
const runBackfill = async (books) => {
  for (const book of books) {
    activeBackfill.currentTitle = book.title;
    try {
      await enrichBook(book.id);
      await embedBook(book.id);
      activeBackfill.embedded += 1;
    } catch (error) {
      activeBackfill.failed += 1;
      const message = String(error?.message || error || "Embedding failed").replace(/key=[^&\s]+/gi, "key=[redacted]").slice(0, 180);
      if (!activeBackfill.errors.includes(message)) activeBackfill.errors.push(message);
    } finally {
      activeBackfill.completed += 1;
    }
  }
  activeBackfill.status = activeBackfill.failed ? "completed_with_errors" : "completed";
  activeBackfill.currentTitle = null;
};
const startBackfill = async () => {
  if (activeBackfill.status === "running") return { ...activeBackfill, alreadyRunning: true };
  const [books] = await db.query(
    `SELECT bk.id, bk.title
     FROM books bk
     LEFT JOIN book_enrichment enrichment ON enrichment.book_id = bk.id
     WHERE bk.material_type = 'book' AND bk.deleted_at IS NULL
       AND (enrichment.book_id IS NULL OR enrichment.status <> 'ready' OR enrichment.enrichment_json IS NULL)
     ORDER BY bk.id`
  );
  activeBackfill = { status: "running", total: books.length, completed: 0, embedded: 0, failed: 0, skipped: 0, currentTitle: null, errors: [] };
  if (!books.length) { activeBackfill.status = "completed"; return { ...activeBackfill }; }
  setImmediate(() => runBackfill(books).catch((error) => {
    activeBackfill.status = "completed_with_errors";
    activeBackfill.errors.push(String(error?.message || error || "Backfill failed").slice(0, 180));
  }));
  return { ...activeBackfill };
};
const backfillProgress = () => ({ ...activeBackfill, errors: [...activeBackfill.errors] });
const embeddingStatus = async () => {
  const [[row]] = await db.query("SELECT COUNT(*) AS total, SUM(status = 'ready') AS ready, SUM(status = 'stale') AS stale, SUM(status = 'failed') AS failed FROM book_embeddings");
  const [errors] = await db.query("SELECT book_id, last_error FROM book_embeddings WHERE status = 'failed' AND last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 3");
  return { total: Number(row.total || 0), ready: Number(row.ready || 0), stale: Number(row.stale || 0), failed: Number(row.failed || 0), errors: errors.map((entry) => ({ bookId: entry.book_id, message: String(entry.last_error).replace(/key=[^&\s]+/gi, "key=[redacted]") })) };
};

module.exports = { recommendationsForSeed, personalized, dismiss, embedBook, enrichBook, markEmbeddingStale, queueEmbedding, queueEnrichmentAndEmbedding, startBackfill, backfillProgress, embeddingStatus };

const db = require("../../db");

async function getPublicFieldKeys() {
  const [fields] = await db.query("SELECT `key` FROM catalog_schema WHERE `public` = 1 AND archived = 0");
  return fields.map((field) => field.key);
}

async function findActiveCandidates(materialType, excludedIds = []) {
  const exclusion = excludedIds.length ? " AND bk.id NOT IN (?)" : "";
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
     GROUP BY bk.id`,
    [materialType, ...(excludedIds.length ? [excludedIds] : [])]
  );
  return rows;
}

async function findEmbedding(bookId) {
  const [[row]] = await db.query("SELECT vector_json FROM book_embeddings WHERE book_id = ? AND status = 'ready' LIMIT 1", [bookId]);
  return row || null;
}

async function findEmbeddings(bookIds) {
  const [rows] = await db.query("SELECT book_id, vector_json FROM book_embeddings WHERE status = 'ready' AND book_id IN (?)", [bookIds]);
  return rows;
}

async function findBook(bookId) {
  const [[book]] = await db.query("SELECT * FROM books WHERE id = ? AND deleted_at IS NULL LIMIT 1", [bookId]);
  return book || null;
}

async function findHistorySeeds(userId, materialType) {
  const [rows] = await db.query(
    `SELECT bk.*, MAX(activity.at) AS activity_at
     FROM (
       SELECT book_id, returned_at AS at FROM borrowings WHERE user_id = ? AND status IN ('borrowed','overdue','returned') AND deleted_at IS NULL
       UNION ALL
       SELECT book_id, COALESCE(fulfilled_at, reserved_at) AS at FROM reservations WHERE user_id = ? AND status IN ('pending','ready','fulfilled') AND deleted_at IS NULL
     ) activity JOIN books bk ON bk.id = activity.book_id
     WHERE bk.material_type = ? AND bk.deleted_at IS NULL GROUP BY bk.id ORDER BY activity_at DESC LIMIT 12`,
    [userId, userId, materialType]
  );
  return rows;
}

async function findDismissedBookIds(userId) {
  const [[dismissed]] = await db.query("SELECT GROUP_CONCAT(book_id) AS ids FROM recommendation_feedback WHERE user_id = ? AND feedback = 'dismissed'", [userId]);
  return String(dismissed?.ids || "").split(",").filter(Boolean).map(Number);
}

async function findBookId(bookId) {
  const [[book]] = await db.query("SELECT id FROM books WHERE id = ? AND deleted_at IS NULL", [bookId]);
  return book || null;
}

async function dismissBook(userId, bookId) {
  await db.query("INSERT INTO recommendation_feedback (user_id, book_id, feedback) VALUES (?, ?, 'dismissed') ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP", [userId, bookId]);
}

async function findBookIsbn(bookId) {
  const [[book]] = await db.query("SELECT id, isbn FROM books WHERE id = ? AND material_type = 'book' AND deleted_at IS NULL", [bookId]);
  return book || null;
}

async function findEnrichment(bookId) {
  const [[row]] = await db.query("SELECT source, enrichment_json, status, last_error FROM book_enrichment WHERE book_id = ? LIMIT 1", [bookId]);
  return row || null;
}

function bookNeedsManualMetadataSql(alias = "enrichment") {
  return `(${alias}.book_id IS NULL OR ${alias}.status <> 'ready' OR ${alias}.enrichment_json IS NULL OR NOT (
    COALESCE(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(${alias}.enrichment_json, '$.description'))), ''), '') <> ''
    OR COALESCE(JSON_LENGTH(JSON_EXTRACT(${alias}.enrichment_json, '$.subjects')), 0) > 0
    OR COALESCE(JSON_LENGTH(JSON_EXTRACT(${alias}.enrichment_json, '$.categories')), 0) > 0
    OR COALESCE(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(${alias}.enrichment_json, '$.publisher'))), ''), '') <> ''
    OR COALESCE(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(${alias}.enrichment_json, '$.language'))), ''), '') <> ''
    OR COALESCE(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(${alias}.enrichment_json, '$.pageCount'))), ''), '') <> ''
    OR COALESCE(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(${alias}.enrichment_json, '$.publishedDate'))), ''), '') <> ''
  ))`;
}

async function listBooksForMetadata({ query = "", needsAttention = false, page = 1, limit = 25 }) {
  const filters = ["bk.material_type = 'book'", "bk.deleted_at IS NULL"];
  const params = [];
  if (query.trim()) {
    const match = `%${query.trim()}%`;
    filters.push("(bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ?)");
    params.push(match, match, match);
  }
  if (needsAttention) filters.push(`((COALESCE(enrichment.source, '') <> 'manual' AND ${bookNeedsManualMetadataSql()}) OR embeddings.book_id IS NULL OR embeddings.status <> 'ready')`);
  const where = filters.join(" AND ");
  const [[count]] = await db.query(
    `SELECT COUNT(*) AS total FROM books bk
     LEFT JOIN book_enrichment enrichment ON enrichment.book_id = bk.id
     LEFT JOIN book_embeddings embeddings ON embeddings.book_id = bk.id
     WHERE ${where}`,
    params
  );
  const [rows] = await db.query(
    `SELECT bk.id, bk.title, bk.author, bk.isbn,
       enrichment.source AS metadata_source, enrichment.status AS metadata_status, enrichment.enrichment_json,
       embeddings.status AS embedding_status
     FROM books bk
     LEFT JOIN book_enrichment enrichment ON enrichment.book_id = bk.id
     LEFT JOIN book_embeddings embeddings ON embeddings.book_id = bk.id
     WHERE ${where}
     ORDER BY CASE WHEN ((${bookNeedsManualMetadataSql()}) OR embeddings.book_id IS NULL OR embeddings.status <> 'ready') THEN 0 ELSE 1 END, bk.title ASC, bk.id ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  return { rows, total: Number(count.total || 0) };
}

async function findBookMetadataRecord(bookId) {
  const [[row]] = await db.query(
    `SELECT bk.id, bk.title, bk.author, bk.isbn, bk.material_type,
       enrichment.source AS metadata_source, enrichment.status AS metadata_status,
       enrichment.enrichment_json, enrichment.last_error AS metadata_error,
       embeddings.status AS embedding_status, embeddings.last_error AS embedding_error
     FROM books bk
     LEFT JOIN book_enrichment enrichment ON enrichment.book_id = bk.id
     LEFT JOIN book_embeddings embeddings ON embeddings.book_id = bk.id
     WHERE bk.id = ? AND bk.deleted_at IS NULL LIMIT 1`,
    [bookId]
  );
  return row || null;
}

async function saveManualEnrichment(bookId, enrichment) {
  await db.query(
    `INSERT INTO book_enrichment (book_id, source, enrichment_json, status, enriched_at, last_error)
     VALUES (?, 'manual', ?, 'ready', CURRENT_TIMESTAMP, NULL)
     ON DUPLICATE KEY UPDATE source='manual', enrichment_json=VALUES(enrichment_json), status='ready', enriched_at=CURRENT_TIMESTAMP, last_error=NULL`,
    [bookId, JSON.stringify(enrichment)]
  );
}

async function saveEnrichment(bookId, enrichment) {
  await db.query(
    `INSERT INTO book_enrichment (book_id, source, enrichment_json, status, enriched_at, last_error)
     VALUES (?, 'openlibrary_googlebooks', ?, 'ready', CURRENT_TIMESTAMP, NULL)
     ON DUPLICATE KEY UPDATE
       source=IF(source='manual', source, VALUES(source)),
       enrichment_json=IF(source='manual', enrichment_json, VALUES(enrichment_json)),
       status=IF(source='manual', status, 'ready'),
       enriched_at=IF(source='manual', enriched_at, CURRENT_TIMESTAMP),
       last_error=IF(source='manual', last_error, NULL)`,
    [bookId, JSON.stringify(enrichment)]
  );
}

async function markEnrichmentFailed(bookId, message) {
  await db.query(
    `INSERT INTO book_enrichment (book_id, source, status, last_error) VALUES (?, 'none', 'failed', ?)
     ON DUPLICATE KEY UPDATE status=IF(source='manual', status, 'failed'), last_error=IF(source='manual', last_error, VALUES(last_error))`,
    [bookId, message]
  );
}

async function findBookForEmbedding(bookId) {
  const [[book]] = await db.query("SELECT * FROM books WHERE id = ? AND deleted_at IS NULL", [bookId]);
  return book || null;
}

async function findReadyEnrichment(bookId) {
  const [[row]] = await db.query("SELECT enrichment_json FROM book_enrichment WHERE book_id = ? AND status = 'ready'", [bookId]);
  return row || null;
}

async function saveEmbedding({ bookId, model, hash, vector }) {
  await db.query(
    `INSERT INTO book_embeddings (book_id, model, content_hash, vector_json, dimensions, status, embedded_at, last_error)
     VALUES (?, ?, ?, ?, ?, 'ready', CURRENT_TIMESTAMP, NULL)
     ON DUPLICATE KEY UPDATE model=VALUES(model), content_hash=VALUES(content_hash), vector_json=VALUES(vector_json), dimensions=VALUES(dimensions), status='ready', embedded_at=CURRENT_TIMESTAMP, last_error=NULL`,
    [bookId, model, hash, JSON.stringify(vector), vector.length]
  );
}

async function markEmbeddingStale(bookId, model) {
  await db.query("INSERT INTO book_embeddings (book_id, model, content_hash, status) VALUES (?, ?, '', 'stale') ON DUPLICATE KEY UPDATE status='stale'", [bookId, model]);
}

async function markEmbeddingFailed(bookId, message) {
  await db.query("UPDATE book_embeddings SET status = 'failed', last_error = ? WHERE book_id = ?", [message, bookId]);
}

async function findBooksForBackfill() {
  const [books] = await db.query(
    `SELECT bk.id, bk.title FROM books bk
     LEFT JOIN book_enrichment enrichment ON enrichment.book_id = bk.id
     WHERE bk.material_type = 'book' AND bk.deleted_at IS NULL
       AND COALESCE(enrichment.source, '') <> 'manual'
       AND ${bookNeedsManualMetadataSql()}
     ORDER BY bk.id`
  );
  return books;
}

async function getEmbeddingStatus() {
  const [[row]] = await db.query("SELECT COUNT(*) AS total, SUM(status = 'ready') AS ready, SUM(status = 'stale') AS stale, SUM(status = 'failed') AS failed FROM book_embeddings");
  const [errors] = await db.query("SELECT book_id, last_error FROM book_embeddings WHERE status = 'failed' AND last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 3");
  return { row, errors };
}

module.exports = { getPublicFieldKeys, findActiveCandidates, findEmbedding, findEmbeddings, findBook, findHistorySeeds, findDismissedBookIds, findBookId, dismissBook, findBookIsbn, findEnrichment, listBooksForMetadata, findBookMetadataRecord, saveManualEnrichment, saveEnrichment, markEnrichmentFailed, findBookForEmbedding, findReadyEnrichment, saveEmbedding, markEmbeddingStale, markEmbeddingFailed, findBooksForBackfill, getEmbeddingStatus };

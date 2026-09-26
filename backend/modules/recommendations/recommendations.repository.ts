import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  BackfillBook,
  CatalogRecord,
  EmbeddingErrorRecord,
  EmbeddingRecord,
  EmbeddingStatusRecord,
  Enrichment,
  EnrichmentRecord,
  ManualMetadataRecord,
  MetadataListRecord,
  MetadataListOptions,
  RecommendationCandidate,
} from "./recommendations.types";

const db = require("../../db") as Pool;
const { activeLendableCopy, hasAccession, availableToBorrow, hasActiveLoan, hasPreparedReservation, hasActiveBookPolicy } = require("../catalog/copyEligibility");

async function getPublicFieldKeys() {
  const [fields] = await db.query<Array<RowDataPacket & { key: string }>>("SELECT `key` FROM catalog_schema WHERE `public` = 1 AND archived = 0");
  return fields.map((field) => field.key);
}

async function findActiveCandidates(materialType: string, excludedIds: number[] = [], { showUnheldInOpac = true }: { showUnheldInOpac?: boolean } = {}): Promise<RecommendationCandidate[]> {
  const exclusion = excludedIds.length ? " AND bk.id NOT IN (?)" : "";
  const visibility = materialType !== "book" || showUnheldInOpac ? "" : ` AND EXISTS (
    SELECT 1 FROM book_copies visible_bc
    WHERE visible_bc.book_id = bk.id AND visible_bc.deleted_at IS NULL
      AND visible_bc.is_active = 1 AND visible_bc.condition IN ('good','damaged')
      AND ${hasAccession("visible_bc")}
  )`;
  const [rows] = await db.query<RecommendationCandidate[]>(
    `SELECT bk.*, ${hasActiveBookPolicy("bk")} AS has_active_policy,
       COUNT(DISTINCT CASE WHEN ${activeLendableCopy("bc")} AND ${hasAccession("bc", "held")} THEN bc.id END) AS total_copies,
       COUNT(DISTINCT CASE WHEN ${availableToBorrow("bc")} THEN bc.id END) AS available,
       COUNT(DISTINCT CASE WHEN ${activeLendableCopy("bc")} AND ${hasAccession("bc", "loaned")} AND ${hasActiveLoan("bc")} THEN bc.id END) AS checked_out,
       COUNT(DISTINCT CASE WHEN ${activeLendableCopy("bc")} AND ${hasAccession("bc", "reserved_copy")} AND ${hasPreparedReservation("bc")} THEN bc.id END) AS reserved_copies,
       COUNT(DISTINCT completed.id) AS popularity
     FROM books bk
     LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.condition IN ('good','damaged') AND bc.deleted_at IS NULL
     LEFT JOIN borrowings completed ON completed.book_id = bk.id AND completed.status = 'returned' AND completed.deleted_at IS NULL
     WHERE bk.material_type = ? AND bk.deleted_at IS NULL${visibility}${exclusion}
     GROUP BY bk.id`,
    [materialType, ...(excludedIds.length ? [excludedIds] : [])]
  );
  return rows;
}

async function findEmbedding(bookId: number): Promise<(RowDataPacket & { vector_json: string }) | null> {
  const [rows] = await db.query<Array<RowDataPacket & { vector_json: string }>>("SELECT vector_json FROM book_embeddings WHERE book_id = ? AND status = 'ready' LIMIT 1", [bookId]);
  const [row] = rows;
  return row || null;
}

async function findEmbeddings(bookIds: number[]): Promise<EmbeddingRecord[]> {
  const [rows] = await db.query<EmbeddingRecord[]>("SELECT book_id, vector_json FROM book_embeddings WHERE status = 'ready' AND book_id IN (?)", [bookIds]);
  return rows;
}

async function findBook(bookId: number): Promise<CatalogRecord | null> {
  const [rows] = await db.query<CatalogRecord[]>("SELECT * FROM books WHERE id = ? AND deleted_at IS NULL LIMIT 1", [bookId]);
  const [book] = rows;
  return book || null;
}

async function findHistorySeeds(userId: number, materialType: string): Promise<CatalogRecord[]> {
  const [rows] = await db.query<CatalogRecord[]>(
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

async function findDismissedBookIds(userId: number): Promise<number[]> {
  const [rows] = await db.query<Array<RowDataPacket & { ids: string | null }>>("SELECT GROUP_CONCAT(book_id) AS ids FROM recommendation_feedback WHERE user_id = ? AND feedback = 'dismissed'", [userId]);
  const [dismissed] = rows;
  return String(dismissed?.ids || "").split(",").filter(Boolean).map(Number);
}

async function findBookId(bookId: number): Promise<(RowDataPacket & { id: number }) | null> {
  const [rows] = await db.query<Array<RowDataPacket & { id: number }>>("SELECT id FROM books WHERE id = ? AND deleted_at IS NULL", [bookId]);
  const [book] = rows;
  return book || null;
}

async function dismissBook(userId: number, bookId: number): Promise<void> {
  await db.query("INSERT INTO recommendation_feedback (user_id, book_id, feedback) VALUES (?, ?, 'dismissed') ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP", [userId, bookId]);
}

async function findBookIsbn(bookId: number): Promise<(RowDataPacket & { id: number; isbn: string | null }) | null> {
  const [rows] = await db.query<Array<RowDataPacket & { id: number; isbn: string | null }>>("SELECT id, isbn FROM books WHERE id = ? AND material_type = 'book' AND deleted_at IS NULL", [bookId]);
  const [book] = rows;
  return book || null;
}

async function findEnrichment(bookId: number): Promise<EnrichmentRecord | null> {
  const [rows] = await db.query<EnrichmentRecord[]>("SELECT source, enrichment_json, status, last_error FROM book_enrichment WHERE book_id = ? LIMIT 1", [bookId]);
  const [row] = rows;
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

async function listBooksForMetadata({ query = "", needsAttention = false, page = 1, limit = 25 }: MetadataListOptions) {
  const filters = ["bk.material_type = 'book'", "bk.deleted_at IS NULL"];
  const params = [];
  if (query.trim()) {
    const match = `%${query.trim()}%`;
    filters.push("(bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ?)");
    params.push(match, match, match);
  }
  if (needsAttention) filters.push(`((COALESCE(enrichment.source, '') <> 'manual' AND ${bookNeedsManualMetadataSql()}) OR embeddings.book_id IS NULL OR embeddings.status <> 'ready')`);
  const where = filters.join(" AND ");
  const [countRows] = await db.query<Array<RowDataPacket & { total: number | string }>>(
    `SELECT COUNT(*) AS total FROM books bk
     LEFT JOIN book_enrichment enrichment ON enrichment.book_id = bk.id
     LEFT JOIN book_embeddings embeddings ON embeddings.book_id = bk.id
     WHERE ${where}`,
    params
  );
  const [count] = countRows;
  const [rows] = await db.query<MetadataListRecord[]>(
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

async function findBookMetadataRecord(bookId: number): Promise<ManualMetadataRecord | null> {
  const [rows] = await db.query<ManualMetadataRecord[]>(
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
  const [row] = rows;
  return row || null;
}

async function saveManualEnrichment(bookId: number, enrichment: Enrichment): Promise<void> {
  await db.query(
    `INSERT INTO book_enrichment (book_id, source, enrichment_json, status, enriched_at, last_error)
     VALUES (?, 'manual', ?, 'ready', CURRENT_TIMESTAMP, NULL)
     ON DUPLICATE KEY UPDATE source='manual', enrichment_json=VALUES(enrichment_json), status='ready', enriched_at=CURRENT_TIMESTAMP, last_error=NULL`,
    [bookId, JSON.stringify(enrichment)]
  );
}

async function saveEnrichment(bookId: number, enrichment: Enrichment): Promise<void> {
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

async function markEnrichmentFailed(bookId: number, message: string): Promise<void> {
  await db.query(
    `INSERT INTO book_enrichment (book_id, source, status, last_error) VALUES (?, 'none', 'failed', ?)
     ON DUPLICATE KEY UPDATE status=IF(source='manual', status, 'failed'), last_error=IF(source='manual', last_error, VALUES(last_error))`,
    [bookId, message]
  );
}

async function findBookForEmbedding(bookId: number): Promise<CatalogRecord | null> {
  const [rows] = await db.query<CatalogRecord[]>("SELECT * FROM books WHERE id = ? AND deleted_at IS NULL", [bookId]);
  const [book] = rows;
  return book || null;
}

async function findReadyEnrichment(bookId: number): Promise<(RowDataPacket & {
  enrichment_json: string | null;
  embedding_model: string | null;
  embedding_content_hash: string | null;
  embedding_dimensions: number | null;
  embedding_status: string | null;
}) | null> {
  const [rows] = await db.query<Array<RowDataPacket & {
    enrichment_json: string | null;
    embedding_model: string | null;
    embedding_content_hash: string | null;
    embedding_dimensions: number | null;
    embedding_status: string | null;
  }>>(
    `SELECT CASE WHEN enrichment.status = 'ready' THEN enrichment.enrichment_json ELSE NULL END AS enrichment_json,
       embeddings.model AS embedding_model, embeddings.content_hash AS embedding_content_hash,
       embeddings.dimensions AS embedding_dimensions, embeddings.status AS embedding_status
     FROM books bk
     LEFT JOIN book_enrichment enrichment ON enrichment.book_id = bk.id
     LEFT JOIN book_embeddings embeddings ON embeddings.book_id = bk.id
     WHERE bk.id = ? AND bk.deleted_at IS NULL LIMIT 1`,
    [bookId]
  );
  const [row] = rows;
  return row || null;
}

async function saveEmbedding({ bookId, model, hash, vector }: { bookId: number; model: string; hash: string; vector: number[] }): Promise<void> {
  await db.query<ResultSetHeader>(
    `INSERT INTO book_embeddings (book_id, model, content_hash, vector_json, dimensions, status, embedded_at, last_error)
     VALUES (?, ?, ?, ?, ?, 'ready', CURRENT_TIMESTAMP, NULL)
     ON DUPLICATE KEY UPDATE model=VALUES(model), content_hash=VALUES(content_hash), vector_json=VALUES(vector_json), dimensions=VALUES(dimensions), status='ready', embedded_at=CURRENT_TIMESTAMP, last_error=NULL`,
    [bookId, model, hash, JSON.stringify(vector), vector.length]
  );
}

async function markEmbeddingStale(bookId: number, model: string): Promise<void> {
  await db.query("INSERT INTO book_embeddings (book_id, model, content_hash, status) VALUES (?, ?, '', 'stale') ON DUPLICATE KEY UPDATE status='stale'", [bookId, model]);
}

async function markEmbeddingFailed(bookId: number, message: string): Promise<void> {
  await db.query("UPDATE book_embeddings SET status = 'failed', last_error = ? WHERE book_id = ?", [message, bookId]);
}

async function findBooksForBackfill(): Promise<BackfillBook[]> {
  const [books] = await db.query<BackfillBook[]>(
    `SELECT bk.id, bk.title FROM books bk
     LEFT JOIN book_enrichment enrichment ON enrichment.book_id = bk.id
     LEFT JOIN book_embeddings embeddings ON embeddings.book_id = bk.id
     WHERE bk.material_type = 'book' AND bk.deleted_at IS NULL
       AND (
         (COALESCE(enrichment.source, '') <> 'manual' AND ${bookNeedsManualMetadataSql()})
         OR embeddings.book_id IS NULL
         OR embeddings.status <> 'ready'
         OR (
           enrichment.source = 'openlibrary_googlebooks'
           AND enrichment.status = 'ready'
           AND bk.isbn IS NOT NULL AND TRIM(bk.isbn) <> ''
           AND COALESCE(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(enrichment.enrichment_json, '$.description'))), ''), '') = ''
           AND CAST(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(enrichment.enrichment_json, '$.googleBooksSynopsisCheckVersion')), ''), '0') AS UNSIGNED) < 1
         )
       )
     ORDER BY bk.id`
  );
  return books;
}

async function getEmbeddingStatus(): Promise<{ row: EmbeddingStatusRecord; errors: EmbeddingErrorRecord[] }> {
  const [statusRows] = await db.query<EmbeddingStatusRecord[]>(
    `SELECT COUNT(embeddings.book_id) AS total,
       COALESCE(SUM(embeddings.status = 'ready'), 0) AS ready,
       COALESCE(SUM(embeddings.status = 'stale'), 0) AS stale,
       COALESCE(SUM(embeddings.status = 'failed'), 0) AS failed,
       COALESCE(SUM(embeddings.book_id IS NULL), 0) AS missing
     FROM books bk
     LEFT JOIN book_embeddings embeddings ON embeddings.book_id = bk.id
     WHERE bk.material_type = 'book' AND bk.deleted_at IS NULL`
  );
  const [row] = statusRows;
  const [errors] = await db.query<EmbeddingErrorRecord[]>("SELECT book_id, last_error FROM book_embeddings WHERE status = 'failed' AND last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 3");
  return { row, errors };
}

export = { getPublicFieldKeys, findActiveCandidates, findEmbedding, findEmbeddings, findBook, findHistorySeeds, findDismissedBookIds, findBookId, dismissBook, findBookIsbn, findEnrichment, listBooksForMetadata, findBookMetadataRecord, saveManualEnrichment, saveEnrichment, markEnrichmentFailed, findBookForEmbedding, findReadyEnrichment, saveEmbedding, markEmbeddingStale, markEmbeddingFailed, findBooksForBackfill, getEmbeddingStatus };

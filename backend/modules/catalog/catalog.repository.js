const db = require("../../db");
const { availableToBorrow, hasAccession, hasActiveBookPolicy } = require("./copyEligibility");
const { enqueueAuditEvent } = require("../analytics/analytics.audit.service");

function getConnection() {
  return db.getConnection();
}

async function getSchema({ includeArchived = false } = {}) {
  const [rows] = await db.query(
    `SELECT * FROM catalog_schema
     ${includeArchived ? "" : "WHERE archived = 0"}
     ORDER BY \`order\` ASC`
  );
  return rows;
}

async function findActiveSchemaKeys(conn) {
  const [existing] = await conn.query(
    "SELECT `key` FROM catalog_schema WHERE locked = 0 AND archived = 0"
  );
  return existing.map((row) => row.key);
}

async function archiveSchemaKeys(keys, conn) {
  if (keys.length) {
    await conn.query(
      "UPDATE catalog_schema SET archived = 1 WHERE `key` IN (?) AND locked = 0",
      [keys]
    );
  }
}

async function upsertSchema(fields, conn) {
  if (!fields.length) return;
  await conn.query(
    `INSERT INTO catalog_schema
       (\`key\`, label, type, options, required, locked, \`public\`, \`order\`, archived, scope)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       label = VALUES(label),
       type = VALUES(type),
       options = VALUES(options),
       required = VALUES(required),
       locked = VALUES(locked),
       \`public\` = VALUES(\`public\`),
       \`order\` = VALUES(\`order\`),
       archived = VALUES(archived),
       scope = VALUES(scope)`,
    [fields.map((field) => [
      field.key,
      field.label,
      field.type,
      field.options ? JSON.stringify(field.options) : null,
      field.required ? 1 : 0,
      field.locked ? 1 : 0,
      field.public ? 1 : 0,
      field.order,
      field.archived ? 1 : 0,
      field.scope || "shared",
    ])]
  );
}

async function getExistingCopies(bookId, conn) {
  const [rows] = await conn.query(
    "SELECT id, barcode FROM book_copies WHERE book_id = ? ORDER BY id ASC FOR UPDATE",
    [bookId]
  );
  return rows;
}

async function getLastCopySequence(bookId, conn) {
  const [[row]] = await conn.query(
    `SELECT GREATEST(
       COALESCE((SELECT MAX(CAST(SUBSTRING_INDEX(barcode, '-', -1) AS UNSIGNED)) FROM book_copies WHERE book_id = ?), 0),
       COALESCE((SELECT MAX(CAST(SUBSTRING_INDEX(copy_barcode, '-', -1) AS UNSIGNED)) FROM accession_claims WHERE book_id = ?), 0)
     ) AS sequence_number`,
    [bookId, bookId],
  );
  return Number(row?.sequence_number ?? 0);
}

async function lockBookForCopySync(bookId, conn) {
  const [[book]] = await conn.query(
    "SELECT id, title, material_type, book_type_id FROM books WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
    [bookId],
  );
  if (!book) throw Object.assign(new Error("Catalog record not found"), { status: 404 });
  return book;
}

async function findCopyStateForUpdate(copyId, conn) {
  const [[copy]] = await conn.query(
    `SELECT bc.id, bc.book_id, bc.barcode, bc.condition, bc.is_active, bc.notes,
            bk.title, bk.deleted_at AS book_deleted_at, bk.material_type,
            (${hasActiveBookPolicy("bk")}) AS has_active_policy, h.accession_number,
            EXISTS(SELECT 1 FROM accession_claim_voids voided_accession WHERE voided_accession.accession_number = h.accession_number) AS accession_voided,
            EXISTS(SELECT 1 FROM borrowings b WHERE b.copy_id = bc.id AND b.deleted_at IS NULL AND b.status IN ('borrowed','overdue')) AS has_active_loan,
            EXISTS(SELECT 1 FROM reservations r WHERE r.reserved_copy_id = bc.id AND r.deleted_at IS NULL AND r.status = 'ready' AND (r.expires_at IS NULL OR r.expires_at > NOW())) AS has_prepared_reservation
       FROM book_copies bc JOIN books bk ON bk.id = bc.book_id
       LEFT JOIN copy_holdings h ON h.copy_id = bc.id
      WHERE bc.id = ? AND bc.deleted_at IS NULL FOR UPDATE`,
    [copyId],
  );
  return copy || null;
}

async function getAvailableEligibleCopyCount(bookId, conn, excludingCopyId = null) {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS total
       FROM book_copies bc
       JOIN books bk ON bk.id = bc.book_id
       LEFT JOIN copy_holdings h ON h.copy_id = bc.id
      WHERE bc.book_id = ? AND ${availableToBorrow("bc")}
        AND (? IS NULL OR bc.id <> ?)` ,
    [bookId, excludingCopyId, excludingCopyId],
  );
  return Number(row.total);
}

async function getPendingReservationCount(bookId, conn) {
  const [[row]] = await conn.query(
    "SELECT COUNT(*) AS total FROM reservations WHERE book_id = ? AND status = 'pending' AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())",
    [bookId],
  );
  return Number(row.total);
}

async function setCopyActive(copyId, isActive, conn) {
  const [result] = await conn.query(
    "UPDATE book_copies SET is_active = ? WHERE id = ? AND deleted_at IS NULL AND is_active = ?",
    [isActive ? 1 : 0, copyId, isActive ? 0 : 1],
  );
  return Number(result.affectedRows);
}

async function getActiveCopyCount(bookId, conn) {
  const [[row]] = await conn.query(
    "SELECT COUNT(*) AS activeCount FROM book_copies WHERE book_id = ? AND deleted_at IS NULL AND is_active = 1",
    [bookId]
  );
  return Number(row.activeCount);
}

async function createCopy(bookId, barcode, conn) {
  await conn.query("INSERT INTO book_copies (book_id, barcode) VALUES (?, ?)", [bookId, barcode]);
}

async function getCommittedCopyCounts(bookId, conn) {
  const [[borrowed]] = await conn.query(
    `SELECT COUNT(*) AS borrowed
     FROM borrowings b
     WHERE b.book_id = ? AND b.deleted_at IS NULL AND b.status IN ('borrowed', 'overdue')`,
    [bookId]
  );
  const [[prepared]] = await conn.query(
    `SELECT COUNT(*) AS prepared
     FROM reservations r
     WHERE r.book_id = ? AND r.status = 'ready' AND r.deleted_at IS NULL AND (r.expires_at IS NULL OR r.expires_at > NOW())`,
    [bookId]
  );
  const [[pending]] = await conn.query(
    `SELECT COUNT(*) AS pending
     FROM reservations r
     WHERE r.book_id = ? AND r.status = 'pending' AND r.deleted_at IS NULL AND (r.expires_at IS NULL OR r.expires_at > NOW())`,
    [bookId]
  );
  return { borrowed: Number(borrowed.borrowed), prepared: Number(prepared.prepared), pending: Number(pending.pending) };
}

async function getActiveCopies(bookId, conn) {
  const [rows] = await conn.query(
    `SELECT bc.id, bc.barcode,
            (${hasAccession("bc", "h")} AND bc.condition IN ('good','damaged') AND bk.material_type = 'book' AND ${hasActiveBookPolicy("bk")}) AS borrow_eligible
       FROM book_copies bc
       JOIN books bk ON bk.id = bc.book_id
       LEFT JOIN copy_holdings h ON h.copy_id = bc.id
      WHERE bc.book_id = ? AND bc.deleted_at IS NULL AND bc.is_active = 1
        AND NOT EXISTS (
          SELECT 1 FROM borrowings b
           WHERE b.copy_id = bc.id AND b.deleted_at IS NULL
             AND b.status IN ('borrowed', 'overdue')
        )
        AND NOT EXISTS (
          SELECT 1 FROM reservations r
           WHERE r.reserved_copy_id = bc.id AND r.deleted_at IS NULL
             AND r.status = 'ready' AND (r.expires_at IS NULL OR r.expires_at > NOW())
        )
      ORDER BY borrow_eligible ASC, (bc.condition = 'lost') DESC,
               (bc.condition = 'damaged') DESC,
               bc.id DESC
      FOR UPDATE`,
    [bookId]
  );
  return rows;
}

async function deactivateCopies(copyIds, conn) {
  if (!copyIds.length) return 0;
  const [result] = await conn.query(
    `UPDATE book_copies bc SET bc.is_active = 0
      WHERE bc.id IN (?) AND bc.is_active = 1 AND bc.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM borrowings b
           WHERE b.copy_id = bc.id AND b.deleted_at IS NULL
             AND b.status IN ('borrowed', 'overdue')
        )
        AND NOT EXISTS (
          SELECT 1 FROM reservations r
           WHERE r.reserved_copy_id = bc.id AND r.deleted_at IS NULL
             AND r.status = 'ready' AND (r.expires_at IS NULL OR r.expires_at > NOW())
        )`,
    [copyIds]
  );
  return result.affectedRows;
}

async function updateBookCopyCount(bookId, activeCount, conn) {
  await conn.query("UPDATE books SET copies = ? WHERE id = ? AND deleted_at IS NULL", [activeCount, bookId]);
}

async function getBookCopies(bookId) {
  const [rows] = await db.query(
    `SELECT
       bc.id,
       bc.barcode,
       bc.condition,
       bc.is_active,
       bc.notes,
       h.accession_number,
       EXISTS(SELECT 1 FROM accession_claim_voids voided_accession WHERE voided_accession.accession_number = h.accession_number) AS accession_voided,
       bt.name AS book_type,
       (${hasAccession("bc", "h")} AND bc.is_active = 1 AND bc.condition IN ('good','damaged') AND bk.material_type = 'book' AND ${hasActiveBookPolicy("bk")}) AS borrow_eligible,
       (bk.material_type = 'book' AND NOT ${hasActiveBookPolicy("bk")}) AS needs_policy,
       CASE
         WHEN b.id IS NOT NULL THEN 'borrowed'
         WHEN r.id IS NOT NULL THEN 'reserved'
         ELSE 'available'
       END AS status,
       b.due_date,
       u.name AS borrower_name
     FROM book_copies bc
     LEFT JOIN copy_holdings h ON h.copy_id = bc.id
     LEFT JOIN books bk ON bk.id = bc.book_id
     LEFT JOIN book_types bt ON bt.id = bk.book_type_id
     LEFT JOIN borrowings b
       ON b.copy_id = bc.id AND b.deleted_at IS NULL AND b.status IN ('borrowed', 'overdue')
     LEFT JOIN reservations r
       ON r.reserved_copy_id = bc.id AND r.status = 'ready' AND r.deleted_at IS NULL AND (r.expires_at IS NULL OR r.expires_at > NOW())
     LEFT JOIN users u ON u.id = b.user_id
     WHERE bc.book_id = ? AND bc.deleted_at IS NULL
     ORDER BY bc.id ASC`,
    [bookId]
  );
  return rows;
}

async function getCopyByBarcode(barcode) {
  const [rows] = await db.query(
    `SELECT
       bc.id,
       bc.barcode,
       bc.condition,
       bc.is_active,
       bc.notes,
       h.accession_number,
       EXISTS(SELECT 1 FROM accession_claim_voids voided_accession WHERE voided_accession.accession_number = h.accession_number) AS accession_voided,
       (${hasAccession("bc", "h")} AND bc.is_active = 1 AND bc.condition IN ('good','damaged') AND b.material_type = 'book' AND ${hasActiveBookPolicy("b")}) AS borrow_eligible,
       (b.material_type = 'book' AND NOT ${hasActiveBookPolicy("b")}) AS needs_policy,
       b.id AS book_id,
       b.title,
       b.author,
       b.isbn,
       b.material_type,
       CASE
         WHEN br.id IS NOT NULL THEN 'borrowed'
         WHEN rr.id IS NOT NULL THEN 'reserved'
         ELSE 'available'
       END AS status,
       br.due_date,
       u.name AS borrower_name
     FROM book_copies bc
     JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
     LEFT JOIN copy_holdings h ON h.copy_id = bc.id
     LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.deleted_at IS NULL AND br.status IN ('borrowed', 'overdue')
     LEFT JOIN reservations rr ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL AND (rr.expires_at IS NULL OR rr.expires_at > NOW())
     LEFT JOIN users u ON u.id = br.user_id
     WHERE bc.barcode = ? AND bc.deleted_at IS NULL`,
    [barcode]
  );
  return rows[0] ?? null;
}

async function searchBooks({ query, publicOnly = false, showArchived = false, materialType = "all", page = null, limit = 20, showUnheldInOpac = true } = {}) {
  const like = `%${query}%`;
  const deletedFilter = showArchived ? "IS NOT NULL" : "IS NULL";
  const materialFilter = ["book", "thesis"].includes(materialType) ? " AND bk.material_type = ?" : "";
  const materialParams = ["book", "thesis"].includes(materialType) ? [materialType] : [];
  const paged = Number.isFinite(Number(page));
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const baseParams = [like, like, like, like, ...materialParams];

  if (publicOnly) {
    const opacVisibilityFilter = showUnheldInOpac ? "" : `AND (bk.material_type = 'thesis' OR EXISTS (
      SELECT 1 FROM book_copies held_bc JOIN copy_holdings held_h ON held_h.copy_id = held_bc.id
       WHERE held_bc.book_id = bk.id AND held_bc.deleted_at IS NULL AND held_bc.is_active = 1
         AND held_bc.condition IN ('good','damaged') AND ${hasAccession("held_bc", "held_h")}
    ))`;
    const [[{ total }]] = paged
      ? await db.query(
        `SELECT COUNT(*) AS total FROM books bk
         WHERE bk.deleted_at ${deletedFilter}
           AND (bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ? OR JSON_SEARCH(bk.metadata, 'one', ?) IS NOT NULL)
           ${opacVisibilityFilter}`,
        [like, like, like, like]
      )
      : [[{ total: 0 }]];
    const [rows] = await db.query(
      `SELECT bk.id, bk.title, bk.author, bk.isbn, bk.copies, bk.material_type, bk.metadata,
              COUNT(DISTINCT CASE WHEN ${hasAccession("bc", "ch")} THEN bc.id END) AS total_copies,
              COUNT(DISTINCT CASE WHEN ${hasAccession("bc", "ch")} THEN bc.id END) AS registered_copies,
              COUNT(DISTINCT CASE WHEN ${availableToBorrow("bc")} THEN bc.id END) AS available,
              (COUNT(DISTINCT CASE WHEN ${availableToBorrow("bc")} THEN bc.id END) > 0) AS canBorrow,
              (bk.material_type = 'book' AND ${hasActiveBookPolicy("bk")} AND COUNT(DISTINCT CASE WHEN ${hasAccession("bc", "ch")} THEN bc.id END) > 0) AS canReserve
       FROM books bk
       LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.condition IN ('good', 'damaged') AND bc.deleted_at IS NULL
       LEFT JOIN copy_holdings ch ON ch.copy_id = bc.id
       LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.deleted_at IS NULL AND br.status IN ('borrowed','overdue')
       LEFT JOIN reservations rr ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL AND (rr.expires_at IS NULL OR rr.expires_at > NOW())
       WHERE bk.deleted_at ${deletedFilter}
         AND (bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ? OR JSON_SEARCH(bk.metadata, 'one', ?) IS NOT NULL)
         ${opacVisibilityFilter}
       GROUP BY bk.id
       ORDER BY bk.title ASC${paged ? " LIMIT ? OFFSET ?" : " LIMIT 50"}`,
      paged ? [like, like, like, like, safeLimit, (safePage - 1) * safeLimit] : [like, like, like, like]
    );
    return { rows, total: Number(total), paged, page: safePage, limit: safeLimit };
  }

  const [rows] = await db.query(
    `SELECT bk.*, (bk.material_type = 'book' AND NOT ${hasActiveBookPolicy("bk")}) AS needs_policy,
            COUNT(DISTINCT bc.id) AS total_copies,
            COUNT(DISTINCT CASE WHEN ${hasAccession("bc", "ch")} AND bc.is_active = 1 AND bc.condition IN ('good','damaged') THEN bc.id END) AS accessioned_copies,
            COUNT(DISTINCT CASE WHEN ${availableToBorrow("bc")} THEN bc.id END) AS available
     FROM books bk
     LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.deleted_at IS NULL
     LEFT JOIN copy_holdings ch ON ch.copy_id = bc.id
     LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.deleted_at IS NULL AND br.status IN ('borrowed','overdue')
     LEFT JOIN reservations rr ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL AND (rr.expires_at IS NULL OR rr.expires_at > NOW())
     WHERE bk.deleted_at ${deletedFilter}
       AND (bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ? OR JSON_SEARCH(bk.metadata, 'one', ?) IS NOT NULL)
       ${materialFilter}
     GROUP BY bk.id
     ORDER BY bk.title ASC
     LIMIT 50`,
    baseParams
  );
  return { rows, total: 0, paged: false, page: safePage, limit: safeLimit };
}

async function searchBooksPage({ query = "", status = "active", materialType = "all", policyStatus = "all", page = 1, limit = 25 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const like = `%${String(query).trim()}%`;
  const safeStatus = ["active", "archived", "all"].includes(status) ? status : "active";
  const deletedFilter = safeStatus === "all" ? "1 = 1" : `bk.deleted_at ${safeStatus === "archived" ? "IS NOT NULL" : "IS NULL"}`;
  const materialFilter = ["book", "thesis"].includes(materialType) ? " AND bk.material_type = ?" : "";
  const policyFilter = policyStatus === "needs_policy" ? ` AND bk.material_type = 'book' AND NOT ${hasActiveBookPolicy("bk")}` : "";
  const params = [like, like, like, like, ...(["book", "thesis"].includes(materialType) ? [materialType] : [])];
  const where = `WHERE ${deletedFilter} AND (bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ? OR JSON_SEARCH(bk.metadata, 'one', ?) IS NOT NULL) ${materialFilter} ${policyFilter}`;
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM books bk ${where}`, params);
  const [rows] = await db.query(
    `SELECT bk.*, (bk.material_type = 'book' AND NOT ${hasActiveBookPolicy("bk")}) AS needs_policy, COUNT(DISTINCT bc.id) AS total_copies,
      COUNT(DISTINCT CASE WHEN ${hasAccession("bc", "ch")} AND bc.is_active = 1 AND bc.condition IN ('good','damaged') THEN bc.id END) AS accessioned_copies,
      COUNT(DISTINCT CASE WHEN NOT ${hasAccession("bc", "ch")} AND bc.is_active = 1 AND bc.condition IN ('good','damaged') THEN bc.id END) AS unaccessioned_copies,
      COUNT(DISTINCT CASE WHEN bc.is_active = 1 AND bc.condition IN ('good','damaged') AND EXISTS (SELECT 1 FROM accession_claim_voids voided WHERE voided.accession_number = ch.accession_number) THEN bc.id END) AS voided_copies,
      COUNT(DISTINCT CASE WHEN ${availableToBorrow("bc")} THEN bc.id END) AS available
     FROM books bk
     LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.deleted_at IS NULL
     LEFT JOIN copy_holdings ch ON ch.copy_id = bc.id
     LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.deleted_at IS NULL AND br.status IN ('borrowed','overdue')
     LEFT JOIN reservations rr ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL AND (rr.expires_at IS NULL OR rr.expires_at > NOW())
     ${where}
     GROUP BY bk.id ORDER BY bk.title ASC LIMIT ? OFFSET ?`,
    [...params, safeLimit, (safePage - 1) * safeLimit]
  );
  return { rows, total: Number(total), page: safePage, limit: safeLimit };
}

async function createBookRecord({ createdBy, materialType, title, author, isbn, copies, bookTypeId, metadata }, conn) {
  const [result] = await conn.query(
    "INSERT INTO books (`created_by`, `material_type`, `title`, `author`, `isbn`, `copies`, `book_type_id`, `metadata`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [createdBy, materialType, title, author, isbn, copies, bookTypeId, JSON.stringify(metadata)]
  );
  return result.insertId;
}

async function lockActiveBookType(id, conn) {
  const [[row]] = await conn.query("SELECT id FROM book_types WHERE id = ? AND is_active = 1 FOR UPDATE", [id]);
  return row || null;
}

async function findBookForUpdate(id, conn) {
  const [[book]] = await conn.query("SELECT id, title, author, isbn, material_type, book_type_id, copies, metadata, deleted_at FROM books WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [id]);
  return book || null;
}

async function findCatalogRecordForValidation(id) {
  const [[record]] = await db.query(
    "SELECT material_type, title, author, isbn, copies, book_type_id, metadata FROM books WHERE id = ? AND deleted_at IS NULL",
    [id],
  );
  return record || null;
}

async function updateBookRecord(id, updates, conn) {
  const columns = ["title", "author", "isbn", "copies", "book_type_id", "metadata"];
  const names = columns.filter((column) => Object.prototype.hasOwnProperty.call(updates, column));
  if (!names.length) return;
  await conn.query(
    `UPDATE books SET ${names.map((column) => `\`${column}\` = ?`).join(", ")} WHERE id = ? AND deleted_at IS NULL`,
    [...names.map((column) => updates[column]), id]
  );
}

async function findBookForDelete(id, conn) {
  const [[book]] = await conn.query("SELECT id, title, author, isbn, material_type, book_type_id, copies, metadata, deleted_at FROM books WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [id]);
  return book || null;
}

async function findActiveBorrowingsForBook(id, conn) {
  const [rows] = await conn.query("SELECT id FROM borrowings b WHERE b.book_id = ? AND b.deleted_at IS NULL AND b.status IN ('borrowed', 'overdue') FOR UPDATE", [id]);
  return rows;
}

async function getBorrowingOwnerIdsForBook(id, conn) {
  const [rows] = await conn.query("SELECT DISTINCT user_id FROM borrowings WHERE book_id = ? ORDER BY user_id", [id]);
  return rows.map((row) => Number(row.user_id));
}

async function lockUsersByIds(userIds, conn) {
  const ids = [...new Set((userIds || []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))].sort((a, b) => a - b);
  if (!ids.length) return;
  await conn.query(`SELECT id FROM users WHERE id IN (${ids.map(() => "?").join(",")}) ORDER BY id FOR UPDATE`, ids);
}

async function findBorrowingIdsForBook(id, conn) {
  const [rows] = await conn.query("SELECT id FROM borrowings WHERE book_id = ? ORDER BY id FOR UPDATE", [id]);
  return rows.map((row) => Number(row.id));
}

async function findActiveReservationsForBook(id, conn) {
  const [rows] = await conn.query("SELECT id FROM reservations WHERE book_id = ? AND status IN ('pending', 'ready') AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE", [id]);
  return rows;
}

async function archiveBook(id, deletedBy, conn) {
  await conn.query("UPDATE book_copies SET deleted_at = NOW(), deleted_by = ? WHERE book_id = ? AND deleted_at IS NULL", [deletedBy ?? null, id]);
  await conn.query("UPDATE books SET deleted_at = NOW(), deleted_by = ? WHERE id = ? AND deleted_at IS NULL", [deletedBy ?? null, id]);
}

async function findArchivedBook(id, conn) {
  const [[book]] = await conn.query("SELECT id, title, author, isbn, material_type, book_type_id, copies, metadata, deleted_at FROM books WHERE id = ? AND deleted_at IS NOT NULL FOR UPDATE", [id]);
  return book || null;
}

async function restoreBook(id, conn) {
  await conn.query("UPDATE book_copies SET deleted_at = NULL, deleted_by = NULL WHERE book_id = ? AND deleted_at IS NOT NULL", [id]);
  await conn.query("UPDATE books SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", [id]);
}

async function getBookTypes() {
  const [rows] = await db.query(`SELECT bt.id, bt.name, bt.default_borrow_days, bt.loan_duration_minutes, bt.loan_duration_unit, bt.fine_per_hour, bt.fine_interval, bt.initial_fine,
       bt.is_active,
       COUNT(CASE WHEN bk.id IS NOT NULL AND bk.deleted_at IS NULL THEN 1 END) AS assigned_active_books,
       COUNT(CASE WHEN bk.id IS NOT NULL AND bk.deleted_at IS NOT NULL THEN 1 END) AS assigned_archived_books
     FROM book_types bt LEFT JOIN books bk ON bk.book_type_id = bt.id
     GROUP BY bt.id ORDER BY bt.is_active DESC, bt.name`);
  return rows;
}

async function createBookType({ name, days, minutes, durationUnit, fine, fineInterval, initial }) {
  const [result] = await db.query(
    "INSERT INTO book_types (name, default_borrow_days, loan_duration_minutes, loan_duration_unit, fine_per_hour, fine_interval, initial_fine) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [name, days, minutes, durationUnit, fine.toFixed(2), fineInterval, initial.toFixed(2)]
  );
  const [[row]] = await db.query("SELECT id, name, default_borrow_days, loan_duration_minutes, loan_duration_unit, fine_per_hour, fine_interval, initial_fine FROM book_types WHERE id = ?", [result.insertId]);
  return row;
}

async function updateBookType(id, { name, days, minutes, durationUnit, fine, fineInterval, initial }) {
  const [result] = await db.query(
    "UPDATE book_types SET name = ?, default_borrow_days = ?, loan_duration_minutes = ?, loan_duration_unit = ?, fine_per_hour = ?, fine_interval = ?, initial_fine = ? WHERE id = ? AND is_active = 1",
    [name, days, minutes, durationUnit, fine.toFixed(2), fineInterval, initial.toFixed(2), id]
  );
  if (!result.affectedRows) return null;
  const [[row]] = await db.query("SELECT id, name, default_borrow_days, loan_duration_minutes, loan_duration_unit, fine_per_hour, fine_interval, initial_fine FROM book_types WHERE id = ?", [id]);
  return row;
}

async function deleteBookType(id, actorId = null) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[policy]] = await conn.query("SELECT id, name FROM book_types WHERE id = ? FOR UPDATE", [id]);
    if (!policy) throw Object.assign(new Error("Book type policy not found"), { status: 404 });
    const [assignedBooks] = await conn.query("SELECT id, deleted_at FROM books WHERE book_type_id = ? FOR UPDATE", [id]);
    const activeCount = assignedBooks.filter((book) => book.deleted_at == null).length;
    const archivedCount = assignedBooks.length - activeCount;
    await conn.query("UPDATE books SET book_type_id = NULL WHERE book_type_id = ?", [id]);
    const [deleted] = await conn.query("DELETE FROM book_types WHERE id = ?", [id]);
    if (!deleted.affectedRows) throw Object.assign(new Error("Book type policy not found"), { status: 404 });
    await enqueueAuditEvent(conn, {
      actorId,
      category: "catalog",
      action: "deleted",
      description: `Deleted loan policy “${policy.name}” · ${assignedBooks.length} book${assignedBooks.length === 1 ? " now needs" : "s now need"} a loan policy`,
      route: `/api/admin/book-types/${id}`,
      metadata: {
        detail_status: "affected_record_summary",
        changes: [{ field: "Loan policy", before: policy.name, after: "Deleted" }],
        affected_record_count: assignedBooks.length,
        affected_record_type: "books now needing a loan policy",
        active_books: activeCount,
        archived_books: archivedCount,
      },
    });
    await conn.commit();
    return { id: Number(id), name: policy.name, active_books: activeCount, archived_books: archivedCount, affected_books: assignedBooks.length };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function findCopyForUpdate(copyId, conn) {
  const [[copy]] = await conn.query(
    `SELECT bc.id, bc.book_id, bc.barcode, bc.condition, bc.is_active, bc.notes,
            bk.title, h.accession_number
       FROM book_copies bc JOIN books bk ON bk.id = bc.book_id
       LEFT JOIN copy_holdings h ON h.copy_id = bc.id
      WHERE bc.id = ? AND bc.deleted_at IS NULL FOR UPDATE`,
    [copyId],
  );
  return copy || null;
}

async function findActiveLoanForCopy(copyId, conn) {
  const [[loan]] = await conn.query("SELECT id FROM borrowings WHERE copy_id = ? AND deleted_at IS NULL AND status IN ('borrowed', 'overdue') FOR UPDATE", [copyId]);
  return loan || null;
}

async function findPreparedReservationForCopy(copyId, conn) {
  const [[reservation]] = await conn.query(
    "SELECT id FROM reservations WHERE reserved_copy_id = ? AND deleted_at IS NULL AND status = 'ready' AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE",
    [copyId],
  );
  return reservation || null;
}

async function updateCopyCondition(copyId, condition, notes, conn) {
  await conn.query("UPDATE book_copies SET `condition` = ?, notes = COALESCE(?, notes) WHERE id = ?", [condition, notes?.trim() || null, copyId]);
}

module.exports = {
  getConnection,
  getSchema,
  findActiveSchemaKeys,
  archiveSchemaKeys,
  upsertSchema,
  getExistingCopies,
  getLastCopySequence,
  lockBookForCopySync,
  findCopyStateForUpdate,
  getAvailableEligibleCopyCount,
  getPendingReservationCount,
  setCopyActive,
  getActiveCopyCount,
  createCopy,
  getCommittedCopyCounts,
  getActiveCopies,
  deactivateCopies,
  updateBookCopyCount,
  getBookCopies,
  getCopyByBarcode,
  searchBooks,
  searchBooksPage,
  createBookRecord,
  findBookForUpdate,
  findCatalogRecordForValidation,
  updateBookRecord,
  findBookForDelete,
  findActiveBorrowingsForBook,
  getBorrowingOwnerIdsForBook,
  lockUsersByIds,
  findBorrowingIdsForBook,
  findActiveReservationsForBook,
  archiveBook,
  findArchivedBook,
  restoreBook,
  getBookTypes,
  lockActiveBookType,
  createBookType,
  updateBookType,
  deleteBookType,
  findCopyForUpdate,
  findActiveLoanForCopy,
  findPreparedReservationForCopy,
  updateCopyCondition,
};

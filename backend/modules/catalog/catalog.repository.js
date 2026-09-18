const db = require("../../db");

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
    "SELECT id, barcode FROM book_copies WHERE book_id = ? AND deleted_at IS NULL ORDER BY id ASC FOR UPDATE",
    [bookId]
  );
  return rows;
}

async function getActiveCopyCount(bookId, conn) {
  const [[row]] = await conn.query(
    "SELECT COUNT(*) AS activeCount FROM book_copies WHERE book_id = ? AND deleted_at IS NULL AND is_active = 1",
    [bookId]
  );
  return Number(row.activeCount);
}

async function getInactiveCopies(bookId, conn) {
  const [rows] = await conn.query(
    "SELECT id FROM book_copies WHERE book_id = ? AND deleted_at IS NULL AND is_active = 0 ORDER BY id ASC",
    [bookId]
  );
  return rows;
}

async function reactivateCopies(copyIds, conn) {
  if (copyIds.length) await conn.query("UPDATE book_copies SET is_active = 1 WHERE id IN (?)", [copyIds]);
}

async function createCopy(bookId, barcode, conn) {
  await conn.query("INSERT INTO book_copies (book_id, barcode) VALUES (?, ?)", [bookId, barcode]);
}

async function getCommittedCopyCounts(bookId, conn) {
  const [[borrowed]] = await conn.query(
    `SELECT COUNT(*) AS borrowed
     FROM borrowings b
     WHERE b.book_id = ? AND b.status IN ('borrowed', 'overdue')`,
    [bookId]
  );
  const [[prepared]] = await conn.query(
    `SELECT COUNT(*) AS prepared
     FROM reservations r
     WHERE r.book_id = ? AND r.status = 'ready' AND r.deleted_at IS NULL`,
    [bookId]
  );
  return { borrowed: Number(borrowed.borrowed), prepared: Number(prepared.prepared) };
}

async function getActiveCopies(bookId, conn) {
  const [rows] = await conn.query(
    "SELECT id FROM book_copies WHERE book_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY id DESC FOR UPDATE",
    [bookId]
  );
  return rows;
}

async function deactivateCopies(copyIds, conn) {
  if (!copyIds.length) return;
  await conn.query(
    `UPDATE book_copies SET is_active = 0
     WHERE id IN (?) AND id NOT IN (
       SELECT copy_id FROM borrowings
       WHERE status IN ('borrowed', 'overdue') AND copy_id IS NOT NULL
     ) AND id NOT IN (
       SELECT reserved_copy_id FROM reservations
       WHERE status = 'ready' AND deleted_at IS NULL AND reserved_copy_id IS NOT NULL
     )`,
    [copyIds]
  );
}

async function getBookCopies(bookId) {
  const [rows] = await db.query(
    `SELECT
       bc.id,
       bc.barcode,
       bc.condition,
       bc.is_active,
       bc.notes,
       CASE
         WHEN b.id IS NOT NULL THEN 'borrowed'
         WHEN r.id IS NOT NULL THEN 'reserved'
         ELSE 'available'
       END AS status,
       b.due_date,
       u.name AS borrower_name
     FROM book_copies bc
     LEFT JOIN borrowings b
       ON b.copy_id = bc.id AND b.status IN ('borrowed', 'overdue')
     LEFT JOIN reservations r
       ON r.reserved_copy_id = bc.id AND r.status = 'ready' AND r.deleted_at IS NULL
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
     LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.status IN ('borrowed', 'overdue')
     LEFT JOIN reservations rr ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL
     LEFT JOIN users u ON u.id = br.user_id
     WHERE bc.barcode = ? AND bc.deleted_at IS NULL`,
    [barcode]
  );
  return rows[0] ?? null;
}

async function searchBooks({ query, publicOnly = false, showArchived = false, materialType = "all", page = null, limit = 20 } = {}) {
  const like = `%${query}%`;
  const deletedFilter = showArchived ? "IS NOT NULL" : "IS NULL";
  const materialFilter = ["book", "thesis"].includes(materialType) ? " AND bk.material_type = ?" : "";
  const materialParams = ["book", "thesis"].includes(materialType) ? [materialType] : [];
  const paged = Number.isFinite(Number(page));
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const baseParams = [like, like, like, like, ...materialParams];

  if (publicOnly) {
    const [[{ total }]] = paged
      ? await db.query(
        `SELECT COUNT(*) AS total FROM books bk
         WHERE bk.deleted_at ${deletedFilter}
           AND (bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ? OR JSON_SEARCH(bk.metadata, 'one', ?) IS NOT NULL)`,
        [like, like, like, like]
      )
      : [[{ total: 0 }]];
    const [rows] = await db.query(
      `SELECT bk.id, bk.title, bk.author, bk.isbn, bk.copies, bk.material_type, bk.metadata,
              COUNT(DISTINCT bc.id) AS total_copies,
              GREATEST(0,
                COUNT(DISTINCT bc.id) -
                COUNT(DISTINCT CASE WHEN br.status IN ('borrowed','overdue') OR rr.id IS NOT NULL THEN bc.id END)
              ) AS available
       FROM books bk
       LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.condition IN ('good', 'damaged') AND bc.deleted_at IS NULL
       LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.status IN ('borrowed','overdue')
       LEFT JOIN reservations rr ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL
       WHERE bk.deleted_at ${deletedFilter}
         AND (bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ? OR JSON_SEARCH(bk.metadata, 'one', ?) IS NOT NULL)
       GROUP BY bk.id
       ORDER BY bk.title ASC${paged ? " LIMIT ? OFFSET ?" : " LIMIT 50"}`,
      paged ? [like, like, like, like, safeLimit, (safePage - 1) * safeLimit] : [like, like, like, like]
    );
    return { rows, total: Number(total), paged, page: safePage, limit: safeLimit };
  }

  const [rows] = await db.query(
    `SELECT bk.*,
            COUNT(DISTINCT bc.id) AS total_copies,
            GREATEST(0,
              COUNT(DISTINCT bc.id) -
              COUNT(DISTINCT CASE WHEN br.status IN ('borrowed','overdue') OR rr.id IS NOT NULL THEN bc.id END)
            ) AS available
     FROM books bk
     LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.condition IN ('good', 'damaged') AND bc.deleted_at IS NULL
     LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.status IN ('borrowed','overdue')
     LEFT JOIN reservations rr ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL
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

async function searchBooksPage({ query = "", status = "active", materialType = "all", page = 1, limit = 25 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const like = `%${String(query).trim()}%`;
  const safeStatus = ["active", "archived", "all"].includes(status) ? status : "active";
  const deletedFilter = safeStatus === "all" ? "1 = 1" : `bk.deleted_at ${safeStatus === "archived" ? "IS NOT NULL" : "IS NULL"}`;
  const materialFilter = ["book", "thesis"].includes(materialType) ? " AND bk.material_type = ?" : "";
  const params = [like, like, like, like, ...(["book", "thesis"].includes(materialType) ? [materialType] : [])];
  const where = `WHERE ${deletedFilter} AND (bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ? OR JSON_SEARCH(bk.metadata, 'one', ?) IS NOT NULL) ${materialFilter}`;
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM books bk ${where}`, params);
  const [rows] = await db.query(
    `SELECT bk.*, COUNT(DISTINCT bc.id) AS total_copies,
      GREATEST(0, COUNT(DISTINCT bc.id) - COUNT(DISTINCT CASE WHEN br.status IN ('borrowed','overdue') OR rr.id IS NOT NULL THEN bc.id END)) AS available
     FROM books bk
     LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.condition IN ('good','damaged') AND bc.deleted_at IS NULL
     LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.status IN ('borrowed','overdue')
     LEFT JOIN reservations rr ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL
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

async function findBookForUpdate(id, conn) {
  const [[book]] = await conn.query("SELECT material_type, metadata FROM books WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [id]);
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
  const [[book]] = await conn.query("SELECT id FROM books WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [id]);
  return book || null;
}

async function findActiveBorrowingsForBook(id, conn) {
  const [rows] = await conn.query("SELECT id FROM borrowings b WHERE b.book_id = ? AND b.status IN ('borrowed', 'overdue') FOR UPDATE", [id]);
  return rows;
}

async function findActiveReservationsForBook(id, conn) {
  const [rows] = await conn.query("SELECT id FROM reservations WHERE book_id = ? AND status IN ('pending', 'ready') AND deleted_at IS NULL FOR UPDATE", [id]);
  return rows;
}

async function archiveBook(id, deletedBy, conn) {
  await conn.query("UPDATE book_copies SET deleted_at = NOW(), deleted_by = ? WHERE book_id = ? AND deleted_at IS NULL", [deletedBy ?? null, id]);
  await conn.query("UPDATE books SET deleted_at = NOW(), deleted_by = ? WHERE id = ? AND deleted_at IS NULL", [deletedBy ?? null, id]);
}

async function findArchivedBook(id, conn) {
  const [[book]] = await conn.query("SELECT id FROM books WHERE id = ? AND deleted_at IS NOT NULL FOR UPDATE", [id]);
  return book || null;
}

async function restoreBook(id, conn) {
  await conn.query("UPDATE book_copies SET deleted_at = NULL, deleted_by = NULL WHERE book_id = ? AND deleted_at IS NOT NULL", [id]);
  await conn.query("UPDATE books SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", [id]);
}

async function getBookTypes() {
  const [rows] = await db.query("SELECT id, name, default_borrow_days, fine_per_hour, fine_interval, initial_fine FROM book_types WHERE is_active = 1 ORDER BY name");
  return rows;
}

async function createBookType({ name, days, fine, fineInterval, initial }) {
  const [result] = await db.query(
    "INSERT INTO book_types (name, default_borrow_days, fine_per_hour, fine_interval, initial_fine) VALUES (?, ?, ?, ?, ?)",
    [name, days, fine.toFixed(2), fineInterval, initial.toFixed(2)]
  );
  const [[row]] = await db.query("SELECT id, name, default_borrow_days, fine_per_hour, fine_interval, initial_fine FROM book_types WHERE id = ?", [result.insertId]);
  return row;
}

async function updateBookType(id, { name, days, fine, fineInterval, initial }) {
  const [result] = await db.query(
    "UPDATE book_types SET name = ?, default_borrow_days = ?, fine_per_hour = ?, fine_interval = ?, initial_fine = ? WHERE id = ? AND is_active = 1",
    [name, days, fine.toFixed(2), fineInterval, initial.toFixed(2), id]
  );
  if (!result.affectedRows) return null;
  const [[row]] = await db.query("SELECT id, name, default_borrow_days, fine_per_hour, fine_interval, initial_fine FROM book_types WHERE id = ?", [id]);
  return row;
}

async function findCopyForUpdate(copyId, conn) {
  const [[copy]] = await conn.query("SELECT id FROM book_copies WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [copyId]);
  return copy || null;
}

async function findActiveLoanForCopy(copyId, conn) {
  const [[loan]] = await conn.query("SELECT id FROM borrowings WHERE copy_id = ? AND status IN ('borrowed', 'overdue') FOR UPDATE", [copyId]);
  return loan || null;
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
  getActiveCopyCount,
  getInactiveCopies,
  reactivateCopies,
  createCopy,
  getCommittedCopyCounts,
  getActiveCopies,
  deactivateCopies,
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
  findActiveReservationsForBook,
  archiveBook,
  findArchivedBook,
  restoreBook,
  getBookTypes,
  createBookType,
  updateBookType,
  findCopyForUpdate,
  findActiveLoanForCopy,
  updateCopyCondition,
};

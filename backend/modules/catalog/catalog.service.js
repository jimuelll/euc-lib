const db = require("../../db");
const { httpError, validateBookTypeInput, validateIsbn } = require("./catalog.validation");
const MATERIAL_KEYS = ["material_type", "thesis_program", "thesis_adviser", "academic_year", "thesis_abstract", "thesis_keywords", "accession_number"];
const PUBLIC_CATALOGUE_CORE_KEYS = ["id", "title", "author", "isbn", "category", "edition", "publication_year", "copies"];

// ─── Schema ───────────────────────────────────────────────────────────────────

const MAX_CUSTOM_FIELDS = 15;

const getSchema = async ({ includeArchived = false } = {}) => {
  const [rows] = await db.query(
    `SELECT * FROM catalog_schema
     ${includeArchived ? "" : "WHERE archived = 0"}
     ORDER BY \`order\` ASC`
  );
  return rows;
};

/**
 * FIX #2: Replace DELETE+INSERT with INSERT ... ON DUPLICATE KEY UPDATE.
 * This is atomic per-row and never leaves the schema table empty on failure.
 */
const upsertSchema = async (fields) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Determine which active non-locked keys are being removed so we can archive them
    const [existing] = await conn.query(
      "SELECT `key` FROM catalog_schema WHERE locked = 0 AND archived = 0"
    );
    const incomingKeys = new Set(fields.map((f) => f.key));
    const toArchive    = existing
      .map((r) => r.key)
      .filter((k) => !incomingKeys.has(k));

    // Archive removed custom fields instead of deleting them
    if (toArchive.length) {
      await conn.query(
        "UPDATE catalog_schema SET archived = 1 WHERE `key` IN (?) AND locked = 0",
        [toArchive]
      );
    }

    // Upsert each incoming field
    if (fields.length) {
      await conn.query(
        `INSERT INTO catalog_schema
           (\`key\`, label, type, options, required, locked, \`public\`, \`order\`, archived)
         VALUES ?
         ON DUPLICATE KEY UPDATE
           label    = VALUES(label),
           type     = VALUES(type),
           options  = VALUES(options),
           required = VALUES(required),
           locked   = VALUES(locked),
           \`public\` = VALUES(\`public\`),
           \`order\` = VALUES(\`order\`),
           archived = VALUES(archived)`,
        [
          fields.map((f) => [
            f.key,
            f.label,
            f.type,
            f.options ? JSON.stringify(f.options) : null,
            f.required ? 1 : 0,
            f.locked   ? 1 : 0,
            f.public   ? 1 : 0,
            f.order,
            f.archived ? 1 : 0,
          ]),
        ]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ─── Dynamic column helpers ───────────────────────────────────────────────────

const RESERVED_KEYS = new Set([
  "id", "title", "author", "category", "isbn",
  "edition", "publication_year", "copies", "created_by",
  "created_at", "updated_at", "deleted_at", "deleted_by",
]);

const columnExists = async (key) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'books'
       AND COLUMN_NAME  = ?`,
    [key]
  );
  return rows[0].cnt > 0;
};

const SQL_TYPE_MAP = {
  text:     "TEXT",
  textarea: "TEXT",
  number:   "DECIMAL(15,4)",
  date:     "DATE",
  select:   "VARCHAR(255)",
};

const addColumnIfMissing = async (key, type) => {
  if (RESERVED_KEYS.has(key)) return;
  if (await columnExists(key)) return;
  const sqlType = SQL_TYPE_MAP[type] ?? "TEXT";
  await db.query(`ALTER TABLE books ADD COLUMN \`${key}\` ${sqlType} DEFAULT NULL`);
};

/**
 * FIX #1: Never physically drop a column.
 * Data stays in the DB; the column is simply hidden from the schema.
 * A DBA can physically drop it later after verifying the data is no longer needed.
 */
const dropColumnIfExists = async (key) => {
  // Intentionally a no-op — column archival is handled by upsertSchema.
  // The physical column remains in `books` with its data intact.
  if (RESERVED_KEYS.has(key)) return;
  // Log for visibility
  console.info(`[catalog] Field "${key}" removed from schema (column retained in books table)`);
};

// ─── book_copies helpers ──────────────────────────────────────────────────────

const generateBarcode = (bookId, copyNumber) =>
  `LIB-${String(bookId).padStart(6, "0")}-${String(copyNumber).padStart(3, "0")}`;

const syncBookCopies = async (bookId, targetCount, conn = db) => {
  const [existing] = await conn.query(
    "SELECT id, barcode FROM book_copies WHERE book_id = ? AND deleted_at IS NULL ORDER BY id ASC",
    [bookId]
  );

  const [[{ activeCount }]] = await conn.query(
    "SELECT COUNT(*) AS activeCount FROM book_copies WHERE book_id = ? AND deleted_at IS NULL AND is_active = 1",
    [bookId]
  );
  const currentCount = Number(activeCount);

  if (targetCount > currentCount) {
    // Restore retired copies first. A physical copy keeps its identity and label
    // when stock is lowered and raised again.
    const [inactiveCopies] = await conn.query(
      "SELECT id FROM book_copies WHERE book_id = ? AND deleted_at IS NULL AND is_active = 0 ORDER BY id ASC",
      [bookId]
    );
    const toReactivate = inactiveCopies.slice(0, targetCount - currentCount).map((copy) => copy.id);
    if (toReactivate.length) {
      await conn.query("UPDATE book_copies SET is_active = 1 WHERE id IN (?)", [toReactivate]);
    }

    const toAdd = targetCount - currentCount - toReactivate.length;
    for (let i = 0; i < toAdd; i++) {
      const copyNumber = existing.length + i + 1;
      const barcode    = generateBarcode(bookId, copyNumber);
      await conn.query(
        "INSERT INTO book_copies (book_id, barcode) VALUES (?, ?)",
        [bookId, barcode]
      );
    }
  } else if (targetCount < currentCount) {
    const [[{ borrowed }]] = await conn.query(
      `SELECT COUNT(*) AS borrowed
       FROM borrowings b
       WHERE b.book_id = ? AND b.status IN ('borrowed', 'overdue')`,
      [bookId]
    );

    if (borrowed > targetCount) {
      throw Object.assign(
        new Error(
          `Cannot reduce copies to ${targetCount}: ${borrowed} cop${borrowed === 1 ? "y is" : "ies are"} currently borrowed`
        ),
        { status: 409 }
      );
    }

    const [activeCopies] = await conn.query(
      "SELECT id FROM book_copies WHERE book_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY id DESC",
      [bookId]
    );
    const toDeactivate = activeCopies.slice(0, currentCount - targetCount).map((c) => c.id);

    if (toDeactivate.length) {
      await conn.query(
        `UPDATE book_copies SET is_active = 0
         WHERE id IN (?) AND id NOT IN (
           SELECT copy_id FROM borrowings
           WHERE status IN ('borrowed', 'overdue') AND copy_id IS NOT NULL
         )`,
        [toDeactivate]
      );
    }
  }
};

const getBookCopies = async (bookId) => {
  const [rows] = await db.query(
    `SELECT
       bc.id,
       bc.barcode,
       bc.condition,
       bc.is_active,
       bc.notes,
       CASE
         WHEN b.id IS NOT NULL THEN 'borrowed'
         ELSE 'available'
       END AS status,
       b.due_date,
       u.name AS borrower_name
     FROM book_copies bc
     LEFT JOIN borrowings b
       ON b.copy_id = bc.id AND b.status IN ('borrowed', 'overdue')
     LEFT JOIN users u ON u.id = b.user_id
     WHERE bc.book_id = ? AND bc.deleted_at IS NULL
     ORDER BY bc.id ASC`,
    [bookId]
  );
  return rows;
};

// ─── Books CRUD ───────────────────────────────────────────────────────────────

const searchBooks = async (query, publicOnly = false, showArchived = false, materialType = "all", page = null, limit = 20) => {
  const like = `%${query}%`;
  const deletedFilter = showArchived ? "IS NOT NULL" : "IS NULL";

  if (publicOnly) {
    const paged = Number.isFinite(Number(page));
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const schema = await getSchema();
    const publicKeys = schema
      .filter((f) => f.public)
      .map((f) => f.key);

    const columns = [...new Set([
      ...PUBLIC_CATALOGUE_CORE_KEYS,
      ...publicKeys,
    ])];
    const columnList = columns.map((c) => `bk.\`${c}\``).join(", ");

    const [[{ total }]] = paged ? await db.query(
      `SELECT COUNT(*) AS total FROM books bk
       WHERE bk.deleted_at ${deletedFilter} AND (bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ?)`,
      [like, like, like]
    ) : [[{ total: 0 }]];
    const [rows] = await db.query(
      `SELECT ${columnList},
              COUNT(DISTINCT bc.id) AS total_copies,
              GREATEST(0,
                COUNT(DISTINCT bc.id) -
                COUNT(DISTINCT CASE WHEN br.status IN ('borrowed','overdue') THEN br.id END)
              ) AS available
       FROM books bk
       LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.condition IN ('good', 'damaged') AND bc.deleted_at IS NULL
       LEFT JOIN borrowings  br ON br.copy_id  = bc.id AND br.status IN ('borrowed','overdue')
       WHERE bk.deleted_at ${deletedFilter}
         AND (bk.title  LIKE ?
          OR bk.author LIKE ?
          OR bk.isbn   LIKE ?)
       GROUP BY bk.id
       ORDER BY bk.title ASC${paged ? " LIMIT ? OFFSET ?" : " LIMIT 50"}`,
      paged ? [like, like, like, safeLimit, (safePage - 1) * safeLimit] : [like, like, like]
    );
    return paged ? { rows, pagination: { page: safePage, limit: safeLimit, total: Number(total), totalPages: Math.ceil(Number(total) / safeLimit) } } : rows;
  }

  const materialFilter = ["book", "thesis"].includes(materialType) ? " AND bk.material_type = ?" : "";
  const params = [like, like, like, ...(["book", "thesis"].includes(materialType) ? [materialType] : [])];
  const [rows] = await db.query(
    `SELECT bk.*,
            COUNT(DISTINCT bc.id) AS total_copies,
            GREATEST(0,
              COUNT(DISTINCT bc.id) -
              COUNT(DISTINCT CASE WHEN br.status IN ('borrowed','overdue') THEN br.id END)
            ) AS available
     FROM books bk
     LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.condition IN ('good', 'damaged') AND bc.deleted_at IS NULL
     LEFT JOIN borrowings  br ON br.copy_id  = bc.id AND br.status IN ('borrowed','overdue')
     WHERE bk.deleted_at ${deletedFilter}
       AND (bk.title  LIKE ?
        OR bk.author LIKE ?
        OR bk.isbn   LIKE ?)
       ${materialFilter}
     GROUP BY bk.id
     ORDER BY bk.title ASC
     LIMIT 50`,
    params
  );
  return rows;
};

const createBook = async (data, createdBy) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const schema = await getSchema();

    const allowedKeys = [...new Set([...schema.map((f) => f.key), ...MATERIAL_KEYS, "book_type_id"])]
      .filter((k) => data[k] !== undefined && data[k] !== "");

    if (!allowedKeys.includes("material_type")) allowedKeys.push("material_type");
    const columns      = ["created_by", ...allowedKeys];
    const values       = [createdBy, ...allowedKeys.map((k) => k === "material_type" ? (data[k] || "book") : (data[k] ?? null))];
    const placeholders = columns.map(() => "?").join(", ");
    const columnNames  = columns.map((c) => `\`${c}\``).join(", ");

    const [result] = await conn.query(
      `INSERT INTO books (${columnNames}) VALUES (${placeholders})`,
      values
    );

    const bookId = result.insertId;
    const copies = parseInt(data.copies ?? 1, 10);

    await syncBookCopies(bookId, copies, conn);

    await conn.commit();
    return bookId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const updateBook = async (id, data) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const schema = await getSchema();

    const allowedKeys = [...new Set([...schema.map((f) => f.key), ...MATERIAL_KEYS, "book_type_id"])]
      .filter((k) => data[k] !== undefined && data[k] !== "");

    if (allowedKeys.length) {
      const setClause = allowedKeys.map((k) => `\`${k}\` = ?`).join(", ");
      const values    = [...allowedKeys.map((k) => data[k] ?? null), id];
      await conn.query(
        `UPDATE books SET ${setClause} WHERE id = ? AND deleted_at IS NULL`,
        values
      );
    }

    if (data.copies !== undefined) {
      const targetCount = parseInt(data.copies, 10);
      if (!isNaN(targetCount) && targetCount >= 0) {
        await syncBookCopies(id, targetCount, conn);
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const deleteBook = async (id, deletedBy) => {
  const [[{ borrowed }]] = await db.query(
    `SELECT COUNT(*) AS borrowed
     FROM borrowings b
     WHERE b.book_id = ? AND b.status IN ('borrowed', 'overdue')`,
    [id]
  );

  if (borrowed > 0) {
    throw Object.assign(
      new Error(`Cannot delete: ${borrowed} cop${borrowed === 1 ? "y is" : "ies are"} currently borrowed`),
      { status: 409 }
    );
  }

  await db.query(
    "UPDATE book_copies SET deleted_at = NOW(), deleted_by = ? WHERE book_id = ? AND deleted_at IS NULL",
    [deletedBy ?? null, id]
  );
  await db.query(
    "UPDATE books SET deleted_at = NOW(), deleted_by = ? WHERE id = ? AND deleted_at IS NULL",
    [deletedBy ?? null, id]
  );
};

const restoreBook = async (id) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[book]] = await conn.query(
      "SELECT id FROM books WHERE id = ? AND deleted_at IS NOT NULL FOR UPDATE",
      [id]
    );
    if (!book) throw Object.assign(new Error("Archived book not found"), { status: 404 });

    await conn.query("UPDATE book_copies SET deleted_at = NULL, deleted_by = NULL WHERE book_id = ? AND deleted_at IS NOT NULL", [id]);
    await conn.query("UPDATE books SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", [id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return { message: "Book restored successfully" };
};

const getCopyByBarcode = async (barcode) => {
  const [rows] = await db.query(
    `SELECT
       bc.id,
       bc.barcode,
       bc.condition,
       bc.is_active,
       bc.notes,
       b.id   AS book_id,
       b.title,
       b.author,
       b.isbn,
       b.material_type,
       CASE
         WHEN br.id IS NOT NULL THEN 'borrowed'
         ELSE 'available'
       END AS status,
       br.due_date,
       u.name AS borrower_name
     FROM book_copies bc
     JOIN  books     b  ON b.id  = bc.book_id AND b.deleted_at IS NULL
     LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.status IN ('borrowed', 'overdue')
     LEFT JOIN users      u  ON u.id = br.user_id
     WHERE bc.barcode = ? AND bc.deleted_at IS NULL`,
    [barcode]
  );
  return rows[0] ?? null;
};

const searchBooksPage = async ({ query = "", showArchived = false, materialType = "all", page = 1, limit = 25 } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const like = `%${String(query).trim()}%`;
  const deletedFilter = showArchived ? "IS NOT NULL" : "IS NULL";
  const materialFilter = ["book", "thesis"].includes(materialType) ? " AND bk.material_type = ?" : "";
  const params = [like, like, like, ...(["book", "thesis"].includes(materialType) ? [materialType] : [])];
  const where = `WHERE bk.deleted_at ${deletedFilter}
    AND (bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ?) ${materialFilter}`;
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM books bk ${where}`, params);
  const [rows] = await db.query(
    `SELECT bk.*, COUNT(DISTINCT bc.id) AS total_copies,
      GREATEST(0, COUNT(DISTINCT bc.id) - COUNT(DISTINCT CASE WHEN br.status IN ('borrowed','overdue') THEN br.id END)) AS available
     FROM books bk
     LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.condition IN ('good','damaged') AND bc.deleted_at IS NULL
     LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.status IN ('borrowed','overdue')
     ${where}
     GROUP BY bk.id ORDER BY bk.title ASC LIMIT ? OFFSET ?`,
    [...params, safeLimit, (safePage - 1) * safeLimit]
  );
  return { rows, pagination: { page: safePage, limit: safeLimit, total: Number(total), totalPages: Math.max(1, Math.ceil(Number(total) / safeLimit)) } };
};

const getBookTypes = async () => {
  const [rows] = await db.query("SELECT id, name, default_borrow_days, fine_per_hour, fine_interval, initial_fine FROM book_types WHERE is_active = 1 ORDER BY name");
  return rows;
};

const createBookType = async ({ name, defaultBorrowDays, finePerHour, fineInterval = "hour", initialFine = 0 }) => {
  const { name: safeName, days, fine, fineInterval: safeInterval, initial } = validateBookTypeInput({ name, defaultBorrowDays, finePerHour, fineInterval, initialFine });
  const [result] = await db.query("INSERT INTO book_types (name, default_borrow_days, fine_per_hour, fine_interval, initial_fine) VALUES (?, ?, ?, ?, ?)", [safeName, days, fine.toFixed(2), safeInterval, initial.toFixed(2)]);
  const [[row]] = await db.query("SELECT id, name, default_borrow_days, fine_per_hour, fine_interval, initial_fine FROM book_types WHERE id = ?", [result.insertId]); return row;
};

const updateBookType = async (id, { name, defaultBorrowDays, finePerHour, fineInterval = "hour", initialFine = 0 }) => {
  const { name: safeName, days, fine, fineInterval: safeInterval, initial } = validateBookTypeInput({ name, defaultBorrowDays, finePerHour, fineInterval, initialFine });
  const [result] = await db.query("UPDATE book_types SET name = ?, default_borrow_days = ?, fine_per_hour = ?, fine_interval = ?, initial_fine = ? WHERE id = ? AND is_active = 1", [safeName, days, fine.toFixed(2), safeInterval, initial.toFixed(2), id]);
  if (!result.affectedRows) throw httpError("Book type not found", 404);
  const [[row]] = await db.query("SELECT id, name, default_borrow_days, fine_per_hour, fine_interval, initial_fine FROM book_types WHERE id = ?", [id]); return row;
};

const updateCopyCondition = async (copyId, condition, notes = null) => {
  if (!['good', 'damaged', 'lost'].includes(condition)) throw Object.assign(new Error("Invalid copy condition"), { status: 400 });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[copy]] = await conn.query("SELECT id FROM book_copies WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [copyId]);
    if (!copy) throw Object.assign(new Error("Copy not found"), { status: 404 });
    if (condition === "lost") {
      const [[loan]] = await conn.query("SELECT id FROM borrowings WHERE copy_id = ? AND status IN ('borrowed', 'overdue') FOR UPDATE", [copyId]);
      if (loan) throw Object.assign(new Error("Return this copy before marking it lost"), { status: 409 });
    }
    await conn.query("UPDATE book_copies SET `condition` = ?, notes = COALESCE(?, notes) WHERE id = ?", [condition, notes?.trim() || null, copyId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const lookupIsbn = async (value) => {
  const isbn = validateIsbn(value);
  const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw Object.assign(new Error("ISBN lookup is unavailable right now"), { status: 503 });
  const record = (await response.json())[`ISBN:${isbn}`];
  if (!record) throw Object.assign(new Error("No metadata was found for this ISBN"), { status: 404 });
  return { isbn, title: record.title || "", author: (record.authors || []).map((item) => item.name).filter(Boolean).join(", "), publication_year: record.publish_date?.match(/\d{4}/)?.[0] || "", edition: record.publishers?.[0]?.name || "" };
};

module.exports = {
  MAX_CUSTOM_FIELDS,
  getSchema, upsertSchema, addColumnIfMissing, dropColumnIfExists,
  searchBooks, searchBooksPage, createBook, updateBook, deleteBook, restoreBook,
  getBookCopies, syncBookCopies, getCopyByBarcode, lookupIsbn, getBookTypes, createBookType, updateBookType, updateCopyCondition,
};

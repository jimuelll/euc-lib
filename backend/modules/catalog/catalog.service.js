const db = require("../../db");

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

  const currentCount = existing.length;

  if (targetCount > currentCount) {
    const toAdd = targetCount - currentCount;
    for (let i = 0; i < toAdd; i++) {
      const copyNumber = currentCount + i + 1;
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
       JOIN book_copies bc ON bc.id = b.copy_id
       WHERE bc.book_id = ? AND bc.deleted_at IS NULL AND b.status IN ('borrowed', 'overdue')`,
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

    const toDeactivate = existing.slice(targetCount).map((c) => c.id);

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

const searchBooks = async (query, publicOnly = false, showArchived = false) => {
  const like = `%${query}%`;
  const deletedFilter = showArchived ? "IS NOT NULL" : "IS NULL";

  if (publicOnly) {
    const schema = await getSchema();
    const publicKeys = schema
      .filter((f) => f.public)
      .map((f) => f.key);

    const columns    = ["id", ...publicKeys.filter((k) => k !== "id")];
    const columnList = columns.map((c) => `bk.\`${c}\``).join(", ");

    const [rows] = await db.query(
      `SELECT ${columnList},
              COUNT(DISTINCT bc.id) AS total_copies,
              GREATEST(0,
                COUNT(DISTINCT bc.id) -
                COUNT(DISTINCT CASE WHEN br.status IN ('borrowed','overdue') THEN br.id END)
              ) AS available
       FROM books bk
       LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.deleted_at IS NULL
       LEFT JOIN borrowings  br ON br.copy_id  = bc.id AND br.status IN ('borrowed','overdue')
       WHERE bk.deleted_at ${deletedFilter}
         AND (bk.title  LIKE ?
          OR bk.author LIKE ?
          OR bk.isbn   LIKE ?)
       GROUP BY bk.id
       ORDER BY bk.title ASC
       LIMIT 50`,
      [like, like, like]
    );
    return rows;
  }

  const [rows] = await db.query(
    `SELECT bk.*,
            COUNT(DISTINCT bc.id) AS total_copies,
            GREATEST(0,
              COUNT(DISTINCT bc.id) -
              COUNT(DISTINCT CASE WHEN br.status IN ('borrowed','overdue') THEN br.id END)
            ) AS available
     FROM books bk
     LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.deleted_at IS NULL
     LEFT JOIN borrowings  br ON br.copy_id  = bc.id AND br.status IN ('borrowed','overdue')
     WHERE bk.deleted_at ${deletedFilter}
       AND (bk.title  LIKE ?
        OR bk.author LIKE ?
        OR bk.isbn   LIKE ?)
     GROUP BY bk.id
     ORDER BY bk.title ASC
     LIMIT 50`,
    [like, like, like]
  );
  return rows;
};

const createBook = async (data, createdBy) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const schema = await getSchema();

    for (const field of schema) {
      if (!RESERVED_KEYS.has(field.key)) {
        await addColumnIfMissing(field.key, field.type);
      }
    }

    const allowedKeys = schema
      .map((f) => f.key)
      .filter((k) => data[k] !== undefined && data[k] !== "");

    const columns      = ["created_by", ...allowedKeys];
    const values       = [createdBy, ...allowedKeys.map((k) => data[k] ?? null)];
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

    const allowedKeys = schema
      .map((f) => f.key)
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
     JOIN book_copies bc ON bc.id = b.copy_id
     WHERE bc.book_id = ? AND bc.deleted_at IS NULL AND b.status IN ('borrowed', 'overdue')`,
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
  const [[book]] = await db.query(
    "SELECT id FROM books WHERE id = ? AND deleted_at IS NOT NULL",
    [id]
  );
  if (!book) throw Object.assign(new Error("Archived book not found"), { status: 404 });

  await db.query(
    "UPDATE books SET deleted_at = NULL, deleted_by = NULL WHERE id = ?",
    [id]
  );
  // Only restore copies that were deleted at the same time as the book,
  // not ones that were manually deactivated beforehand
  await db.query(
    `UPDATE book_copies SET deleted_at = NULL, deleted_by = NULL
     WHERE book_id = ? AND deleted_at >= (
       SELECT deleted_at FROM (SELECT deleted_at FROM books WHERE id = ?) AS t
     )`,
    [id, id]
  );

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

module.exports = {
  MAX_CUSTOM_FIELDS,
  getSchema, upsertSchema, addColumnIfMissing, dropColumnIfExists,
  searchBooks, createBook, updateBook, deleteBook, restoreBook,
  getBookCopies, syncBookCopies, getCopyByBarcode,
};

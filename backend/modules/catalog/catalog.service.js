const db = require("../../db");

// ─── Schema ───────────────────────────────────────────────────────────────────

const getSchema = async () => {
  const [rows] = await db.query(
    "SELECT * FROM catalog_schema ORDER BY `order` ASC"
  );
  return rows;
};

const upsertSchema = async (fields) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM catalog_schema");
    if (fields.length) {
      await conn.query(
        `INSERT INTO catalog_schema
           (\`key\`, label, type, options, required, locked, \`public\`, \`order\`)
         VALUES ?`,
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
  "created_at", "updated_at",
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

const dropColumnIfExists = async (key) => {
  if (RESERVED_KEYS.has(key)) return;
  if (!(await columnExists(key))) return;
  await db.query(`ALTER TABLE books DROP COLUMN \`${key}\``);
};

// ─── book_copies helpers ──────────────────────────────────────────────────────

/**
 * Generate the next barcode for a book.
 * Format: LIB-{bookId padded to 6}-{copy number padded to 3}
 * e.g. LIB-000002-003
 */
const generateBarcode = (bookId, copyNumber) =>
  `LIB-${String(bookId).padStart(6, "0")}-${String(copyNumber).padStart(3, "0")}`;

/**
 * Ensure book_copies rows match the books.copies count.
 * - If copies increased: insert new rows.
 * - If copies decreased: soft-delete (is_active = 0) excess rows that are not
 *   currently borrowed. Throws if there are more active loans than the new count.
 */
const syncBookCopies = async (bookId, targetCount, conn = db) => {
  // Current active copies
  const [existing] = await conn.query(
    "SELECT id, barcode FROM book_copies WHERE book_id = ? ORDER BY id ASC",
    [bookId]
  );

  const currentCount = existing.length;

  if (targetCount > currentCount) {
    // Add missing copies
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
    // Check how many are currently out on loan
    const [[{ borrowed }]] = await conn.query(
      `SELECT COUNT(*) AS borrowed
       FROM borrowings b
       JOIN book_copies bc ON bc.id = b.copy_id
       WHERE bc.book_id = ? AND b.status IN ('borrowed', 'overdue')`,
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

    // Soft-deactivate excess copies that are not out on loan (from the end)
    const toDeactivate = existing
      .slice(targetCount)
      .map((c) => c.id);

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

/**
 * Get all copies for a book with their current borrow status.
 */
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
     WHERE bc.book_id = ?
     ORDER BY bc.id ASC`,
    [bookId]
  );
  return rows;
};

// ─── Books CRUD ───────────────────────────────────────────────────────────────

const searchBooks = async (query, publicOnly = false) => {
  const like = `%${query}%`;

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
       LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1
       LEFT JOIN borrowings  br ON br.copy_id  = bc.id AND br.status IN ('borrowed','overdue')
       WHERE bk.title  LIKE ?
          OR bk.author LIKE ?
          OR bk.isbn   LIKE ?
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
     LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1
     LEFT JOIN borrowings  br ON br.copy_id  = bc.id AND br.status IN ('borrowed','overdue')
     WHERE bk.title  LIKE ?
        OR bk.author LIKE ?
        OR bk.isbn   LIKE ?
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

    // Seed book_copies rows for every physical copy
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
      await conn.query(`UPDATE books SET ${setClause} WHERE id = ?`, values);
    }

    // If copies changed, sync book_copies accordingly
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

const deleteBook = async (id) => {
  // book_copies has ON DELETE RESTRICT — check for active loans first
  const [[{ borrowed }]] = await db.query(
    `SELECT COUNT(*) AS borrowed
     FROM borrowings b
     JOIN book_copies bc ON bc.id = b.copy_id
     WHERE bc.book_id = ? AND b.status IN ('borrowed', 'overdue')`,
    [id]
  );

  if (borrowed > 0) {
    throw Object.assign(
      new Error(`Cannot delete: ${borrowed} cop${borrowed === 1 ? "y is" : "ies are"} currently borrowed`),
      { status: 409 }
    );
  }

  // Remove copies first, then the book
  await db.query("DELETE FROM book_copies WHERE book_id = ?", [id]);
  await db.query("DELETE FROM books WHERE id = ?", [id]);
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
     JOIN  books     b  ON b.id  = bc.book_id
     LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.status IN ('borrowed', 'overdue')
     LEFT JOIN users      u  ON u.id = br.user_id
     WHERE bc.barcode = ?`,
    [barcode]
  );
  return rows[0] ?? null;
};

// Add to module.exports:
module.exports = {
  getSchema, upsertSchema, addColumnIfMissing, dropColumnIfExists,
  searchBooks, createBook, updateBook, deleteBook,
  getBookCopies, syncBookCopies, getCopyByBarcode,
};
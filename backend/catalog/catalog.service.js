const db = require("../db");

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

// ─── Books CRUD ───────────────────────────────────────────────────────────────

const searchBooks = async (query, publicOnly = false) => {
  const like = `%${query}%`;

  if (publicOnly) {
    // Only return columns that are marked public in the schema
    const schema = await getSchema();
    const publicKeys = schema
      .filter((f) => f.public)
      .map((f) => f.key);

    // Always include id so the frontend can key rows
    const columns = ["id", ...publicKeys.filter((k) => k !== "id")];
    const columnList = columns.map((c) => `\`${c}\``).join(", ");

    const [rows] = await db.query(
      `SELECT ${columnList} FROM books
       WHERE title  LIKE ?
          OR author LIKE ?
          OR isbn   LIKE ?
       ORDER BY title ASC
       LIMIT 50`,
      [like, like, like]
    );
    return rows;
  }

  const [rows] = await db.query(
    `SELECT * FROM books
     WHERE title  LIKE ?
        OR author LIKE ?
        OR isbn   LIKE ?
     ORDER BY title ASC
     LIMIT 50`,
    [like, like, like]
  );
  return rows;
};

const createBook = async (data, createdBy) => {
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

  const [result] = await db.query(
    `INSERT INTO books (${columnNames}) VALUES (${placeholders})`,
    values
  );
  return result.insertId;
};

const updateBook = async (id, data) => {
  const schema = await getSchema();

  const allowedKeys = schema
    .map((f) => f.key)
    .filter((k) => data[k] !== undefined && data[k] !== "");

  if (!allowedKeys.length) return;

  const setClause = allowedKeys.map((k) => `\`${k}\` = ?`).join(", ");
  const values    = [...allowedKeys.map((k) => data[k] ?? null), id];

  await db.query(`UPDATE books SET ${setClause} WHERE id = ?`, values);
};

const deleteBook = async (id) => {
  await db.query("DELETE FROM books WHERE id = ?", [id]);
};

module.exports = {
  getSchema,
  upsertSchema,
  addColumnIfMissing,
  dropColumnIfExists,
  searchBooks,
  createBook,
  updateBook,
  deleteBook,
};
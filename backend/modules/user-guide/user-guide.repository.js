const db = require("../../db");

const ensureDefaults = async (defaults) => {
  const [[row]] = await db.query("SELECT COUNT(*) AS total FROM user_guide_modules WHERE deleted_at IS NULL");
  if (Number(row.total) > 0) return;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (let index = 0; index < defaults.length; index += 1) {
      const content = defaults[index];
      const serialized = JSON.stringify(content);
      await conn.query(
        `INSERT IGNORE INTO user_guide_modules
          (slug, sort_order, draft_content, published_content, is_published, published_at)
         VALUES (?, ?, ?, ?, 1, NOW())`,
        [content.slug, index + 1, serialized, serialized],
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const listPublished = async () => {
  const [rows] = await db.query(
    `SELECT id, sort_order, published_content
       FROM user_guide_modules
      WHERE is_published = 1 AND published_content IS NOT NULL AND deleted_at IS NULL
      ORDER BY sort_order ASC, id ASC`,
  );
  return rows;
};

const listForAdmin = async () => {
  const [rows] = await db.query(
    "SELECT * FROM user_guide_modules WHERE deleted_at IS NULL ORDER BY sort_order ASC, id ASC",
  );
  return rows;
};

const getById = async (id) => {
  const [[row]] = await db.query(
    "SELECT * FROM user_guide_modules WHERE id = ? AND deleted_at IS NULL",
    [id],
  );
  return row ?? null;
};

const getNextOrder = async () => {
  const [[row]] = await db.query(
    "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM user_guide_modules WHERE deleted_at IS NULL",
  );
  return Number(row.next_order);
};

const createDraft = async ({ slug, sortOrder, content, userId }) => {
  const [result] = await db.query(
    `INSERT INTO user_guide_modules (slug, sort_order, draft_content, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?)`,
    [slug, sortOrder, JSON.stringify(content), userId || null, userId || null],
  );
  return result.insertId;
};

const updateDraft = async (id, { slug, content, userId }) => {
  await db.query(
    "UPDATE user_guide_modules SET slug = ?, draft_content = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL",
    [slug, JSON.stringify(content), userId || null, id],
  );
};

const publish = async (id, userId) => {
  await db.query(
    `UPDATE user_guide_modules
        SET published_content = draft_content, is_published = 1, published_at = NOW(), updated_by = ?
      WHERE id = ? AND deleted_at IS NULL`,
    [userId || null, id],
  );
};

const unpublish = async (id, userId) => {
  await db.query(
    "UPDATE user_guide_modules SET is_published = 0, updated_by = ? WHERE id = ? AND deleted_at IS NULL",
    [userId || null, id],
  );
};

const archive = async (id, userId) => {
  await db.query(
    "UPDATE user_guide_modules SET slug = CONCAT(slug, '-archived-', id), deleted_at = NOW(), updated_by = ? WHERE id = ?",
    [userId || null, id],
  );
};

const listActiveIds = async () => {
  const [rows] = await db.query("SELECT id FROM user_guide_modules WHERE deleted_at IS NULL");
  return rows.map((row) => Number(row.id));
};

const reorder = async (ids, userId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (let index = 0; index < ids.length; index += 1) {
      await conn.query(
        "UPDATE user_guide_modules SET sort_order = ?, updated_by = ? WHERE id = ?",
        [index + 1, userId || null, ids[index]],
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

module.exports = {
  ensureDefaults,
  listPublished,
  listForAdmin,
  getById,
  getNextOrder,
  createDraft,
  updateDraft,
  publish,
  unpublish,
  archive,
  listActiveIds,
  reorder,
};

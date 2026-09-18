const db = require("../../db");

const getAllSubscriptions = async (showArchived = false, { page, limit } = {}) => {
  const deletedFilter = showArchived ? "IS NOT NULL" : "IS NULL";
  if (page !== undefined) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM academic_subscriptions WHERE deleted_at ${deletedFilter}`);
    const [rows] = await db.query(
      `SELECT * FROM academic_subscriptions WHERE deleted_at ${deletedFilter} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`,
      [safeLimit, (safePage - 1) * safeLimit],
    );
    return { rows, pagination: { page: safePage, limit: safeLimit, total: Number(total), totalPages: Math.max(1, Math.ceil(Number(total) / safeLimit)) } };
  }
  const [rows] = await db.query(
    `SELECT * FROM academic_subscriptions
     WHERE deleted_at ${deletedFilter}
     ORDER BY sort_order ASC, id ASC`,
  );
  return rows;
};

const getActiveSubscriptions = async ({ page, limit } = {}) => {
  if (page !== undefined) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM academic_subscriptions WHERE is_active = 1 AND deleted_at IS NULL");
    const [rows] = await db.query(
      "SELECT * FROM academic_subscriptions WHERE is_active = 1 AND deleted_at IS NULL ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?",
      [safeLimit, (safePage - 1) * safeLimit],
    );
    return { rows, pagination: { page: safePage, limit: safeLimit, total: Number(total), totalPages: Math.max(1, Math.ceil(Number(total) / safeLimit)) } };
  }
  const [rows] = await db.query(
    `SELECT * FROM academic_subscriptions
     WHERE is_active = 1 AND deleted_at IS NULL
     ORDER BY sort_order ASC, id ASC`,
  );
  return rows;
};

const getSubscriptionById = async (id) => {
  const [rows] = await db.query("SELECT * FROM academic_subscriptions WHERE id = ? AND deleted_at IS NULL", [id]);
  return rows[0] ?? null;
};

const createSubscription = async (dto) => {
  const {
    title, url, description = null, category = null,
    image_url = null, image_public_id = null,
    is_active = true, sort_order = 0, created_by = null,
  } = dto;
  const [result] = await db.query(
    `INSERT INTO academic_subscriptions
       (title, url, description, category, image_url, image_public_id, is_active, sort_order, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, url, description, category, image_url, image_public_id, is_active ? 1 : 0, sort_order, created_by, created_by],
  );
  return result.insertId;
};

const updateSubscription = async (id, dto) => {
  const fields = [];
  const values = [];
  if (dto.title !== undefined) { fields.push("title = ?"); values.push(dto.title); }
  if (dto.url !== undefined) { fields.push("url = ?"); values.push(dto.url); }
  if (dto.description !== undefined) { fields.push("description = ?"); values.push(dto.description); }
  if (dto.category !== undefined) { fields.push("category = ?"); values.push(dto.category); }
  if (dto.image_url !== undefined) { fields.push("image_url = ?"); values.push(dto.image_url); }
  if (dto.image_public_id !== undefined) { fields.push("image_public_id = ?"); values.push(dto.image_public_id); }
  if (dto.is_active !== undefined) { fields.push("is_active = ?"); values.push(dto.is_active ? 1 : 0); }
  if (dto.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(dto.sort_order); }
  if (dto.updated_by !== undefined) { fields.push("updated_by = ?"); values.push(dto.updated_by); }
  if (!fields.length) throw new Error("No fields to update");
  values.push(id);
  await db.query(`UPDATE academic_subscriptions SET ${fields.join(", ")} WHERE id = ? AND deleted_at IS NULL`, values);
};

const deleteSubscription = async (id) => {
  await db.query("UPDATE academic_subscriptions SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL", [id]);
};

const restoreSubscription = async (id) => {
  const [rows] = await db.query("SELECT * FROM academic_subscriptions WHERE id = ? AND deleted_at IS NOT NULL", [id]);
  if (!rows.length) return null;
  await db.query("UPDATE academic_subscriptions SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", [id]);
  return getSubscriptionById(id);
};

const reorderSubscriptions = async (orderedIds, updatedBy) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < orderedIds.length; i += 1) {
      await conn.query(
        `UPDATE academic_subscriptions SET sort_order = ?, updated_by = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [i + 1, updatedBy ?? null, orderedIds[i]],
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
  getAllSubscriptions,
  getActiveSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  restoreSubscription,
  reorderSubscriptions,
};

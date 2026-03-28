// subscriptions/subscriptions.service.js
const pool = require("../../db"); // adjust to your DB pool path
const { v2: cloudinary } = require("cloudinary");

/**
 * Delete an image from Cloudinary by its public_id.
 * Fails silently — a failed delete should not block the DB operation.
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn("[subscriptions] Cloudinary delete failed for:", publicId, err);
  }
};

// ─── Read ─────────────────────────────────────────────────────────────────────

const getAllSubscriptions = async () => {
  const [rows] = await pool.query(
    `SELECT * FROM academic_subscriptions ORDER BY sort_order ASC, id ASC`
  );
  return rows;
};

const getActiveSubscriptions = async () => {
  const [rows] = await pool.query(
    `SELECT * FROM academic_subscriptions WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`
  );
  return rows;
};

const getSubscriptionById = async (id) => {
  const [rows] = await pool.query(
    `SELECT * FROM academic_subscriptions WHERE id = ?`,
    [id]
  );
  return rows.length ? rows[0] : null;
};

// ─── Create ───────────────────────────────────────────────────────────────────

const createSubscription = async (dto) => {
  const {
    title, url,
    description     = null,
    category        = null,
    image_url       = null,
    image_public_id = null,
    is_active       = true,
    sort_order      = 0,
    created_by      = null,
  } = dto;

  const [result] = await pool.query(
    `INSERT INTO academic_subscriptions
       (title, url, description, category, image_url, image_public_id, is_active, sort_order, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, url, description, category, image_url, image_public_id, is_active ? 1 : 0, sort_order, created_by, created_by]
  );

  const sub = await getSubscriptionById(result.insertId);
  if (!sub) throw new Error("Failed to retrieve newly created subscription");
  return sub;
};

// ─── Update ───────────────────────────────────────────────────────────────────

const updateSubscription = async (id, dto) => {
  const fields = [];
  const values = [];

  if (dto.title            !== undefined) { fields.push("title = ?");            values.push(dto.title); }
  if (dto.url              !== undefined) { fields.push("url = ?");              values.push(dto.url); }
  if (dto.description      !== undefined) { fields.push("description = ?");      values.push(dto.description); }
  if (dto.category         !== undefined) { fields.push("category = ?");         values.push(dto.category); }
  if (dto.image_url        !== undefined) { fields.push("image_url = ?");        values.push(dto.image_url); }
  if (dto.image_public_id  !== undefined) { fields.push("image_public_id = ?");  values.push(dto.image_public_id); }
  if (dto.is_active        !== undefined) { fields.push("is_active = ?");        values.push(dto.is_active ? 1 : 0); }
  if (dto.sort_order       !== undefined) { fields.push("sort_order = ?");       values.push(dto.sort_order); }
  if (dto.updated_by       !== undefined) { fields.push("updated_by = ?");       values.push(dto.updated_by); }

  if (fields.length === 0) throw new Error("No fields to update");

  values.push(id);
  await pool.query(
    `UPDATE academic_subscriptions SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  const sub = await getSubscriptionById(id);
  if (!sub) throw new Error("Subscription not found after update");
  return sub;
};

// ─── Delete ───────────────────────────────────────────────────────────────────

const deleteSubscription = async (id) => {
  // Fetch public_id first so we can clean up Cloudinary
  const sub = await getSubscriptionById(id);
  if (sub?.image_public_id) {
    await deleteFromCloudinary(sub.image_public_id);
  }

  await pool.query(
    `DELETE FROM academic_subscriptions WHERE id = ?`,
    [id]
  );
};

// ─── Reorder ──────────────────────────────────────────────────────────────────

const reorderSubscriptions = async (orderedIds, updatedBy) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < orderedIds.length; i++) {
      await conn.query(
        `UPDATE academic_subscriptions SET sort_order = ?, updated_by = ? WHERE id = ?`,
        [i + 1, updatedBy ?? null, orderedIds[i]]
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

module.exports = {
  deleteFromCloudinary,
  getAllSubscriptions,
  getActiveSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  reorderSubscriptions,
};
const db = require("../../db");

const buildAudienceWhere = () => `
  n.is_active = 1
  AND (n.expires_at IS NULL OR n.expires_at > NOW())
  AND (
    n.audience_type = 'all'
    OR (n.audience_type = 'user' AND n.audience_user_id = ?)
    OR (n.audience_type = 'role' AND n.audience_role = ?)
  )`;

const listForUser = async ({ userId, role, limit, unreadOnly }) => {
  const unreadClause = unreadOnly ? "AND nr.read_at IS NULL" : "";
  const [rows] = await db.query(
    `SELECT n.*, nr.read_at
       FROM notifications n
       LEFT JOIN notification_reads nr
         ON nr.notification_id = n.id AND nr.user_id = ?
      WHERE ${buildAudienceWhere()}
        ${unreadClause}
      ORDER BY n.created_at DESC
      LIMIT ?`,
    [userId, userId, role, limit],
  );
  return rows;
};

const getUnreadCountForUser = async ({ userId, role }) => {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total
       FROM notifications n
       LEFT JOIN notification_reads nr
         ON nr.notification_id = n.id AND nr.user_id = ?
      WHERE ${buildAudienceWhere()}
        AND nr.read_at IS NULL`,
    [userId, userId, role],
  );
  return row?.total ?? 0;
};

const getByIdForUser = async ({ notificationId, userId, role }) => {
  const [[row]] = await db.query(
    `SELECT n.*, nr.read_at
       FROM notifications n
       LEFT JOIN notification_reads nr
         ON nr.notification_id = n.id AND nr.user_id = ?
      WHERE n.id = ?
        AND ${buildAudienceWhere()}
      LIMIT 1`,
    [userId, notificationId, userId, role],
  );
  return row ?? null;
};

const markAsRead = async ({ notificationId, userId }) => {
  await db.query(
    `INSERT INTO notification_reads (notification_id, user_id, read_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE read_at = VALUES(read_at)`,
    [notificationId, userId],
  );
};

const markAllAsRead = async ({ userId, role }) => {
  await db.query(
    `INSERT INTO notification_reads (notification_id, user_id, read_at)
     SELECT n.id, ?, NOW()
       FROM notifications n
       LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = ?
      WHERE ${buildAudienceWhere()} AND nr.read_at IS NULL
     ON DUPLICATE KEY UPDATE read_at = VALUES(read_at)`,
    [userId, userId, userId, role],
  );
};

const findExistingNotification = async ({
  type,
  audienceType,
  audienceUserId,
  audienceRole,
  sourceType = null,
  sourceId = null,
}, conn = db) => {
  if (!sourceType || sourceId === null || sourceId === undefined) return null;
  const [[row]] = await conn.query(
    `SELECT id
       FROM notifications
      WHERE type = ?
        AND audience_type = ?
        AND audience_user_id <=> ?
        AND audience_role <=> ?
        AND source_type = ?
        AND source_id = ?
      ORDER BY id DESC
      LIMIT 1`,
    [type, audienceType, audienceUserId, audienceRole, sourceType, sourceId],
  );
  return row ?? null;
};

const updateNotification = async ({ notificationId, title, body, href, expiresAt, createdBy, sourceType, sourceId }) => {
  await db.query(
    `UPDATE notifications
        SET title = ?, body = ?, href = ?, expires_at = ?, created_by = ?,
            source_type = ?, source_id = ?, is_active = 1, created_at = NOW()
      WHERE id = ?`,
    [title, body, href, expiresAt, createdBy, sourceType, sourceId, notificationId],
  );
  await db.query("DELETE FROM notification_reads WHERE notification_id = ?", [notificationId]);
};

const createNotification = async ({
  type, title, body, href, audienceType, audienceUserId, audienceRole,
  expiresAt, createdBy, sourceType, sourceId,
}) => {
  const [result] = await db.query(
    `INSERT INTO notifications
      (type, title, body, href, audience_type, audience_user_id, audience_role, expires_at, created_by, source_type, source_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [type, title, body, href, audienceType, audienceUserId, audienceRole, expiresAt, createdBy, sourceType, sourceId],
  );
  return result.insertId;
};

const getUserRole = async (userId) => {
  const [[row]] = await db.query("SELECT role FROM users WHERE id = ? LIMIT 1", [userId]);
  return row?.role ?? "student";
};

const searchNotificationRecipients = async (query) => {
  const term = `%${query}%`;
  const [rows] = await db.query(
    `SELECT id, name, role, student_employee_id, library_card_number,
            student_number, employee_number, username
       FROM users
      WHERE deleted_at IS NULL AND is_active = 1
        AND (name LIKE ? OR CAST(id AS CHAR) LIKE ? OR student_employee_id LIKE ?
          OR library_card_number LIKE ? OR student_number LIKE ?
          OR employee_number LIKE ? OR username LIKE ?)
      ORDER BY name ASC
      LIMIT 10`,
    [term, term, term, term, term, term, term],
  );
  return rows;
};

const findActiveNotificationRecipient = async (userId) => {
  const [[row]] = await db.query(
    `SELECT id, name, role, student_employee_id, library_card_number,
            student_number, employee_number, username
       FROM users
      WHERE id = ? AND deleted_at IS NULL AND is_active = 1
      LIMIT 1`,
    [userId],
  );
  return row ?? null;
};

const listAdminNotifications = async ({ page, limit }) => {
  const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM notifications");
  const [rows] = await db.query(
    `SELECT n.*, creator.name AS creator_name,
            recipient.name AS audience_user_name,
            COALESCE(recipient.username, recipient.student_employee_id,
                     recipient.library_card_number, recipient.employee_number,
                     recipient.student_number) AS audience_user_identifier
       FROM notifications n
       LEFT JOIN users creator ON creator.id = n.created_by
       LEFT JOIN users recipient ON recipient.id = n.audience_user_id
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?`,
    [limit, (page - 1) * limit],
  );
  return { rows, total: Number(total), page, limit };
};

const getAdminStats = async () => {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total_notifications,
            SUM(CASE WHEN created_at >= CURDATE() THEN 1 ELSE 0 END) AS created_today,
            SUM(CASE WHEN audience_type = 'all' THEN 1 ELSE 0 END) AS broadcast_notifications,
            SUM(CASE WHEN audience_type = 'user' THEN 1 ELSE 0 END) AS direct_notifications
       FROM notifications`,
  );
  return row;
};

module.exports = {
  listForUser,
  getUnreadCountForUser,
  getByIdForUser,
  markAsRead,
  markAllAsRead,
  findExistingNotification,
  updateNotification,
  createNotification,
  getUserRole,
  searchNotificationRecipients,
  findActiveNotificationRecipient,
  listAdminNotifications,
  getAdminStats,
};

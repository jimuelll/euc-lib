const db = require("../../db");
const hub = require("../../realtime/notificationHub");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
let ensuredNotificationSourceColumns = false;

const ensureNotificationSourceColumns = async (conn = db) => {
  if (ensuredNotificationSourceColumns) return;

  const [columns] = await conn.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'notifications'
       AND COLUMN_NAME IN ('source_type', 'source_id')`
  );

  const existingColumns = new Set(columns.map((column) => column.COLUMN_NAME));

  if (!existingColumns.has("source_type")) {
    await conn.query(
      `ALTER TABLE notifications
       ADD COLUMN source_type VARCHAR(50) DEFAULT NULL AFTER created_by`
    );
  }

  if (!existingColumns.has("source_id")) {
    await conn.query(
      `ALTER TABLE notifications
       ADD COLUMN source_id BIGINT DEFAULT NULL AFTER source_type`
    );
  }

  ensuredNotificationSourceColumns = true;
};

const normaliseNotification = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  href: row.href,
  audience_type: row.audience_type,
  audience_user_id: row.audience_user_id,
  audience_role: row.audience_role,
  created_at: row.created_at,
  expires_at: row.expires_at,
  is_active: !!row.is_active,
  created_by: row.created_by,
  source_type: row.source_type ?? null,
  source_id: row.source_id ?? null,
  read_at: row.read_at ?? null,
  is_read: !!row.read_at,
});

const buildAudienceWhere = () => `
  n.is_active = 1
  AND (n.expires_at IS NULL OR n.expires_at > NOW())
  AND (
    n.audience_type = 'all'
    OR (n.audience_type = 'user' AND n.audience_user_id = ?)
    OR (n.audience_type = 'role' AND n.audience_role = ?)
  )
`;

const listForUser = async ({ userId, role, limit = DEFAULT_LIMIT, unreadOnly = false }) => {
  await ensureNotificationSourceColumns();
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const params = [userId, role];

  let unreadClause = "";
  if (unreadOnly) {
    unreadClause = "AND nr.read_at IS NULL";
  }

  const [rows] = await db.query(
    `SELECT
       n.*,
       nr.read_at
     FROM notifications n
     LEFT JOIN notification_reads nr
       ON nr.notification_id = n.id
      AND nr.user_id = ?
     WHERE ${buildAudienceWhere()}
       ${unreadClause}
     ORDER BY n.created_at DESC
     LIMIT ?`,
    [userId, ...params, safeLimit]
  );

  return rows.map(normaliseNotification);
};

const getUnreadCountForUser = async ({ userId, role }) => {
  await ensureNotificationSourceColumns();
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM notifications n
     LEFT JOIN notification_reads nr
       ON nr.notification_id = n.id
      AND nr.user_id = ?
     WHERE ${buildAudienceWhere()}
       AND nr.read_at IS NULL`,
    [userId, userId, role]
  );

  return row?.total ?? 0;
};

const getByIdForUser = async ({ notificationId, userId, role }) => {
  await ensureNotificationSourceColumns();
  const [[row]] = await db.query(
    `SELECT
       n.*,
       nr.read_at
     FROM notifications n
     LEFT JOIN notification_reads nr
       ON nr.notification_id = n.id
      AND nr.user_id = ?
     WHERE n.id = ?
       AND ${buildAudienceWhere()}
     LIMIT 1`,
    [userId, notificationId, userId, role]
  );

  return row ? normaliseNotification(row) : null;
};

const markAsRead = async ({ notificationId, userId, role }) => {
  const notification = await getByIdForUser({ notificationId, userId, role });
  if (!notification) {
    throw Object.assign(new Error("Notification not found"), { status: 404 });
  }

  await db.query(
    `INSERT INTO notification_reads (notification_id, user_id, read_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE read_at = VALUES(read_at)`,
    [notificationId, userId]
  );

  const unreadCount = await getUnreadCountForUser({ userId, role });
  hub.pushUnreadCount(userId, unreadCount);

  return { success: true, unreadCount };
};

const markAllAsRead = async ({ userId, role }) => {
  const notifications = await listForUser({ userId, role, limit: MAX_LIMIT, unreadOnly: true });

  if (notifications.length) {
    const values = notifications.map((notification) => [notification.id, userId]);
    await db.query(
      `INSERT INTO notification_reads (notification_id, user_id, read_at)
       VALUES ${values.map(() => "(?, ?, NOW())").join(", ")}
       ON DUPLICATE KEY UPDATE read_at = VALUES(read_at)`,
      values.flat()
    );
  }

  hub.pushUnreadCount(userId, 0);
  return { success: true, unreadCount: 0 };
};

const resolveRecipients = async ({ audienceType, audienceUserId, audienceRole }) => {
  if (audienceType === "user") return audienceUserId ? [audienceUserId] : [];

  if (audienceType === "role") {
    const [rows] = await db.query(
      `SELECT id
       FROM users
       WHERE role = ?
         AND is_active = 1
         AND deleted_at IS NULL`,
      [audienceRole]
    );
    return rows.map((row) => row.id);
  }

  const [rows] = await db.query(
    `SELECT id
     FROM users
     WHERE is_active = 1
       AND deleted_at IS NULL`
  );
  return rows.map((row) => row.id);
};

const findExistingNotification = async ({
  type,
  audienceType,
  audienceUserId,
  audienceRole,
  sourceType = null,
  sourceId = null,
}, conn = db) => {
  if (!sourceType || sourceId === null || sourceId === undefined) {
    return null;
  }

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
    [type, audienceType, audienceUserId, audienceRole, sourceType, sourceId]
  );

  return row ?? null;
};

const createNotification = async ({
  type,
  title,
  body,
  href = null,
  audienceType = "all",
  audienceUserId = null,
  audienceRole = null,
  expiresAt = null,
  createdBy = null,
  sourceType = null,
  sourceId = null,
  replaceExisting = false,
}) => {
  await ensureNotificationSourceColumns();

  const recipients = await resolveRecipients({ audienceType, audienceUserId, audienceRole });
  const existingNotification = replaceExisting
    ? await findExistingNotification({
        type,
        audienceType,
        audienceUserId,
        audienceRole,
        sourceType,
        sourceId,
      })
    : null;

  let notificationId = existingNotification?.id ?? null;

  if (notificationId) {
    await db.query(
      `UPDATE notifications
       SET title = ?,
           body = ?,
           href = ?,
           expires_at = ?,
           created_by = ?,
           source_type = ?,
           source_id = ?,
           is_active = 1,
           created_at = NOW()
       WHERE id = ?`,
      [title, body, href, expiresAt, createdBy, sourceType, sourceId, notificationId]
    );

    await db.query(
      `DELETE FROM notification_reads
       WHERE notification_id = ?`,
      [notificationId]
    );
  } else {
    const [result] = await db.query(
      `INSERT INTO notifications
        (type, title, body, href, audience_type, audience_user_id, audience_role, expires_at, created_by, source_type, source_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [type, title, body, href, audienceType, audienceUserId, audienceRole, expiresAt, createdBy, sourceType, sourceId]
    );

    notificationId = result.insertId;
  }

  const baseNotification = {
    id: notificationId,
    type,
    title,
    body,
    href,
    audience_type: audienceType,
    audience_user_id: audienceUserId,
    audience_role: audienceRole,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
    is_active: true,
    created_by: createdBy,
    source_type: sourceType,
    source_id: sourceId,
    read_at: null,
    is_read: false,
  };

  for (const userId of recipients) {
    const unreadCount = await getUnreadCountForUser({
      userId,
      role: audienceType === "role" ? audienceRole : (await getUserRole(userId)),
    });

    hub.pushNotification(userId, {
      type: "notification.created",
      notification: baseNotification,
      unreadCount,
    });
  }

  return baseNotification;
};

const getUserRole = async (userId) => {
  const [[row]] = await db.query(
    `SELECT role
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );

  return row?.role ?? "student";
};

const listAdminNotifications = async ({ limit = DEFAULT_LIMIT } = {}) => {
  await ensureNotificationSourceColumns();
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const [rows] = await db.query(
    `SELECT
       n.*,
       creator.name AS creator_name
     FROM notifications n
     LEFT JOIN users creator ON creator.id = n.created_by
     ORDER BY n.created_at DESC
     LIMIT ?`,
    [safeLimit]
  );

  return rows.map((row) => ({
    ...normaliseNotification(row),
    creator_name: row.creator_name ?? null,
  }));
};

const getAdminStats = async () => {
  await ensureNotificationSourceColumns();
  const [[row]] = await db.query(
    `SELECT
       COUNT(*) AS total_notifications,
       SUM(CASE WHEN created_at >= CURDATE() THEN 1 ELSE 0 END) AS created_today,
       SUM(CASE WHEN audience_type = 'all' THEN 1 ELSE 0 END) AS broadcast_notifications,
       SUM(CASE WHEN audience_type = 'user' THEN 1 ELSE 0 END) AS direct_notifications
     FROM notifications`
  );

  return {
    total_notifications: Number(row?.total_notifications ?? 0),
    created_today: Number(row?.created_today ?? 0),
    broadcast_notifications: Number(row?.broadcast_notifications ?? 0),
    direct_notifications: Number(row?.direct_notifications ?? 0),
  };
};

module.exports = {
  ensureNotificationSourceColumns,
  listForUser,
  getUnreadCountForUser,
  getByIdForUser,
  markAsRead,
  markAllAsRead,
  createNotification,
  listAdminNotifications,
  getAdminStats,
};

const repository = require("./notifications.repository");
const hub = require("../../realtime/notificationHub");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Notification source columns are part of the database baseline. This remains
// as a compatibility entry point for callers from before the repository split.
const ensureNotificationSourceColumns = async () => undefined;

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

const listForUser = async ({ userId, role, limit = DEFAULT_LIMIT, unreadOnly = false }) => {
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const rows = await repository.listForUser({ userId, role, limit: safeLimit, unreadOnly });
  return rows.map(normaliseNotification);
};

const getUnreadCountForUser = async ({ userId, role }) => repository.getUnreadCountForUser({ userId, role });

const getByIdForUser = async ({ notificationId, userId, role }) => {
  const row = await repository.getByIdForUser({ notificationId, userId, role });
  return row ? normaliseNotification(row) : null;
};

const markAsRead = async ({ notificationId, userId, role }) => {
  const notification = await getByIdForUser({ notificationId, userId, role });
  if (!notification) throw Object.assign(new Error("Notification not found"), { status: 404 });
  await repository.markAsRead({ notificationId, userId });
  const unreadCount = await getUnreadCountForUser({ userId, role });
  hub.pushUnreadCount(userId, unreadCount);
  return { success: true, unreadCount };
};

const markAllAsRead = async ({ userId, role }) => {
  await repository.markAllAsRead({ userId, role });
  const unreadCount = await getUnreadCountForUser({ userId, role });
  hub.pushUnreadCount(userId, unreadCount);
  return { success: true, unreadCount };
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
  const existingNotification = replaceExisting
    ? await repository.findExistingNotification({ type, audienceType, audienceUserId, audienceRole, sourceType, sourceId })
    : null;

  let notificationId = existingNotification?.id ?? null;
  if (notificationId) {
    await repository.updateNotification({ notificationId, title, body, href, expiresAt, createdBy, sourceType, sourceId });
  } else {
    notificationId = await repository.createNotification({
      type, title, body, href, audienceType, audienceUserId, audienceRole,
      expiresAt, createdBy, sourceType, sourceId,
    });
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

  if (audienceType === "user" && audienceUserId) {
    const unreadCount = await getUnreadCountForUser({ userId: audienceUserId, role: await repository.getUserRole(audienceUserId) });
    hub.pushNotification(audienceUserId, { type: "notification.created", notification: baseNotification, unreadCount });
  } else {
    hub.pushAudienceChanged({ audienceType, audienceRole });
  }

  return baseNotification;
};

const listAdminNotifications = async ({ page = 1, limit = DEFAULT_LIMIT } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const safePage = Math.max(1, Number(page) || 1);
  const result = await repository.listAdminNotifications({ page: safePage, limit: safeLimit });
  return {
    rows: result.rows.map((row) => ({ ...normaliseNotification(row), creator_name: row.creator_name ?? null })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / safeLimit)),
    },
  };
};

const getAdminStats = async () => {
  const row = await repository.getAdminStats();
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

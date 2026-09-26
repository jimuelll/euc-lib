import repository = require("./notifications.repository");
import outboxRepository = require("../delivery-outbox/outbox.repository");
import hub = require("../../realtime/notificationHub");
import type { PoolConnection } from "mysql2/promise";
import type {
  CreateNotificationInput,
  NotificationContext,
  NotificationListOptions,
  NotificationRecord,
  NotificationRecipient,
  NotificationWrite,
} from "./notifications.types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Notification source columns are part of the database baseline. This remains
// as a compatibility entry point for callers from before the repository split.
const ensureNotificationSourceColumns = async (): Promise<void> => undefined;

const normaliseNotification = (row: NotificationRecord) => ({
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
  audience_user_name: row.audience_user_name ?? null,
  audience_user_identifier: row.audience_user_identifier ?? null,
  read_at: row.read_at ?? null,
  is_read: !!row.read_at,
});

const listForUser = async ({ userId, role, limit = DEFAULT_LIMIT, unreadOnly = false }: Partial<NotificationListOptions> & NotificationContext) => {
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const rows = await repository.listForUser({ userId, role, limit: safeLimit, unreadOnly });
  return rows.map(normaliseNotification);
};

const getUnreadCountForUser = ({ userId, role }: NotificationContext): Promise<number> =>
  repository.getUnreadCountForUser({ userId, role });

const searchNotificationRecipients = (query: string): Promise<NotificationRecipient[]> =>
  repository.searchNotificationRecipients(query);
const findActiveNotificationRecipient = (userId: number): Promise<NotificationRecipient | null> =>
  repository.findActiveNotificationRecipient(userId);

const getByIdForUser = async ({ notificationId, userId, role }: NotificationContext & { notificationId: number }) => {
  const row = await repository.getByIdForUser({ notificationId, userId, role });
  return row ? normaliseNotification(row) : null;
};

const markAsRead = async ({ notificationId, userId, role }: NotificationContext & { notificationId: number }) => {
  const notification = await getByIdForUser({ notificationId, userId, role });
  if (!notification) throw Object.assign(new Error("Notification not found"), { status: 404 });
  await repository.markAsRead({ notificationId, userId });
  const unreadCount = await getUnreadCountForUser({ userId, role });
  hub.pushUnreadCount(userId, unreadCount);
  return { success: true, unreadCount };
};

const markAllAsRead = async ({ userId, role }: NotificationContext) => {
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
  deliveryKey = null,
}: CreateNotificationInput) => {
  const deliveredNotification = deliveryKey ? await repository.findNotificationByDeliveryKey(deliveryKey) : null;
  const existingNotification = deliveredNotification ?? (replaceExisting
    ? await repository.findExistingNotification({ type, audienceType, audienceUserId, audienceRole, sourceType, sourceId })
    : null);

  let notificationId = existingNotification?.id ?? null;
  let shouldPush = !deliveredNotification;
  const write: NotificationWrite = {
    type,
    title,
    body,
    href,
    audienceType,
    audienceUserId,
    audienceRole,
    expiresAt,
    createdBy,
    sourceType,
    sourceId,
  };
  if (notificationId) {
    if (!deliveredNotification) {
      await repository.updateNotification({ notificationId, title, body, href, expiresAt, createdBy, sourceType, sourceId, deliveryKey });
    }
  } else if (deliveryKey) {
    const created = await repository.createNotificationWithDeliveryKey({ ...write, deliveryKey });
    notificationId = created.id;
    shouldPush = created.created;
  } else {
    notificationId = await repository.createNotification(write);
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

  if (shouldPush) {
    try {
      if (audienceType === "user" && audienceUserId) {
        const unreadCount = await getUnreadCountForUser({
          userId: audienceUserId,
          role: await repository.getUserRole(audienceUserId),
        });
        hub.pushNotification(audienceUserId, { type: "notification.created", notification: baseNotification, unreadCount });
      } else {
        hub.pushAudienceChanged({ audienceType, audienceRole });
      }
    } catch (error) {
      // Notification rows are committed first; realtime delivery is an
      // optimization and must never make a saved notification look failed.
      console.error("[notifications] Saved notification but realtime delivery failed:", error);
    }
  }

  return baseNotification;
};

const enqueueNotification = (conn: PoolConnection, payload: Record<string, unknown>): Promise<string> =>
  outboxRepository.enqueue("notification", payload, conn);

const listAdminNotifications = async ({ page = 1, limit = DEFAULT_LIMIT }: { page?: unknown; limit?: unknown } = {}) => {
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

export = {
  ensureNotificationSourceColumns,
  listForUser,
  getUnreadCountForUser,
  searchNotificationRecipients,
  findActiveNotificationRecipient,
  getByIdForUser,
  markAsRead,
  markAllAsRead,
  createNotification,
  enqueueNotification,
  listAdminNotifications,
  getAdminStats,
};

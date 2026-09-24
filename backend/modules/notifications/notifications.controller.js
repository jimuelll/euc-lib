const service = require("./notifications.service");
const { logError } = require("../../logger");

const searchAdminNotificationRecipients = async (req, res) => {
  try {
    const query = String(req.query.q ?? "").trim();
    if (query.length < 2) return res.json({ recipients: [] });
    const recipients = await service.searchNotificationRecipients(query);
    res.json({ recipients });
  } catch (err) {
    logError("[notifications] searchAdminNotificationRecipients:", err);
    res.status(500).json({ message: "Failed to search accounts" });
  }
};

const listMyNotifications = async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const unreadOnly = req.query.unreadOnly === "true";

    const rows = await service.listForUser({
      userId: req.user.id,
      role: req.user.role,
      limit,
      unreadOnly,
    });

    res.json(rows);
  } catch (err) {
    logError("[notifications] listMyNotifications:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await service.getUnreadCountForUser({
      userId: req.user.id,
      role: req.user.role,
    });

    res.json({ unreadCount });
  } catch (err) {
    logError("[notifications] getUnreadCount:", err);
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
};

const markAsRead = async (req, res) => {
  try {
    const notificationId = Number(req.params.notificationId);
    if (!notificationId) {
      return res.status(400).json({ message: "Invalid notification ID" });
    }

    const result = await service.markAsRead({
      notificationId,
      userId: req.user.id,
      role: req.user.role,
    });

    res.json(result);
  } catch (err) {
    logError("[notifications] markAsRead:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to mark notification as read" });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const result = await service.markAllAsRead({
      userId: req.user.id,
      role: req.user.role,
    });

    res.json(result);
  } catch (err) {
    logError("[notifications] markAllAsRead:", err);
    res.status(500).json({ message: "Failed to mark notifications as read" });
  }
};

const createAdminNotification = async (req, res) => {
  try {
    const {
      type = "announcement",
      title,
      body,
      href = null,
      audienceType = "all",
      audienceUserId = null,
      audienceRole = null,
      expiresAt = null,
    } = req.body;

    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ message: "title and body are required" });
    }

    if (!["all", "user", "role"].includes(audienceType)) {
      return res.status(400).json({ message: "Invalid audienceType" });
    }

    if (audienceType === "user" && !audienceUserId) {
      return res.status(400).json({ message: "audienceUserId is required for user notifications" });
    }

    if (audienceType === "user") {
      const recipient = await service.findActiveNotificationRecipient(Number(audienceUserId));
      if (!recipient) return res.status(400).json({ message: "Select an active account for this notification" });
    }

    if (audienceType === "role" && !audienceRole) {
      return res.status(400).json({ message: "audienceRole is required for role notifications" });
    }

    const notification = await service.createNotification({
      type,
      title: title.trim(),
      body: body.trim(),
      href: href?.trim() || null,
      audienceType,
      audienceUserId,
      audienceRole,
      expiresAt,
      createdBy: req.user.id,
    });

    res.status(201).json(notification);
  } catch (err) {
    logError("[notifications] createAdminNotification:", err);
    res.status(500).json({ message: "Failed to create notification" });
  }
};

const listAdminNotifications = async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const [stats, notificationPage] = await Promise.all([
      service.getAdminStats(),
      service.listAdminNotifications({ page, limit }),
    ]);

    res.json({ stats, notifications: notificationPage.rows, pagination: notificationPage.pagination });
  } catch (err) {
    logError("[notifications] listAdminNotifications:", err);
    res.status(500).json({ message: "Failed to fetch admin notifications" });
  }
};

module.exports = {
  searchAdminNotificationRecipients,
  listMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createAdminNotification,
  listAdminNotifications,
};

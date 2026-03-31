const service = require("./notifications.service");

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
    console.error("[notifications] listMyNotifications:", err);
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
    console.error("[notifications] getUnreadCount:", err);
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
    console.error("[notifications] markAsRead:", err);
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
    console.error("[notifications] markAllAsRead:", err);
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
    console.error("[notifications] createAdminNotification:", err);
    res.status(500).json({ message: "Failed to create notification" });
  }
};

const listAdminNotifications = async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const [stats, notifications] = await Promise.all([
      service.getAdminStats(),
      service.listAdminNotifications({ limit }),
    ]);

    res.json({ stats, notifications });
  } catch (err) {
    console.error("[notifications] listAdminNotifications:", err);
    res.status(500).json({ message: "Failed to fetch admin notifications" });
  }
};

module.exports = {
  listMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createAdminNotification,
  listAdminNotifications,
};

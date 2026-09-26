import type { Request, RequestHandler } from "express";
import service = require("./notifications.service");
import logger = require("../../logger");

const { logError } = logger;
type AuthenticatedRequest = Request & { user: { id: number; role: string } };
type ServiceError = { status?: number; message?: string };

const searchAdminNotificationRecipients: RequestHandler = async (req, res) => {
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

const listMyNotifications: RequestHandler = async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const unreadOnly = req.query.unreadOnly === "true";
    const user = (req as AuthenticatedRequest).user;
    const rows = await service.listForUser({ userId: user.id, role: user.role, limit, unreadOnly });
    res.json(rows);
  } catch (err) {
    logError("[notifications] listMyNotifications:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

const getUnreadCount: RequestHandler = async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const unreadCount = await service.getUnreadCountForUser({ userId: user.id, role: user.role });
    res.json({ unreadCount });
  } catch (err) {
    logError("[notifications] getUnreadCount:", err);
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
};

const markAsRead: RequestHandler = async (req, res) => {
  try {
    const notificationId = Number(req.params.notificationId);
    if (!notificationId) return res.status(400).json({ message: "Invalid notification ID" });
    const user = (req as AuthenticatedRequest).user;
    res.json(await service.markAsRead({ notificationId, userId: user.id, role: user.role }));
  } catch (err) {
    logError("[notifications] markAsRead:", err);
    const error = err as ServiceError;
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to mark notification as read" });
  }
};

const markAllAsRead: RequestHandler = async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    res.json(await service.markAllAsRead({ userId: user.id, role: user.role }));
  } catch (err) {
    logError("[notifications] markAllAsRead:", err);
    res.status(500).json({ message: "Failed to mark notifications as read" });
  }
};

const createAdminNotification: RequestHandler = async (req, res) => {
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

    if (!title?.trim() || !body?.trim()) return res.status(400).json({ message: "title and body are required" });
    if (!["all", "user", "role"].includes(audienceType)) return res.status(400).json({ message: "Invalid audienceType" });
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
      createdBy: (req as AuthenticatedRequest).user.id,
    });
    res.status(201).json(notification);
  } catch (err) {
    logError("[notifications] createAdminNotification:", err);
    res.status(500).json({ message: "Failed to create notification" });
  }
};

const listAdminNotifications: RequestHandler = async (req, res) => {
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

export = {
  searchAdminNotificationRecipients,
  listMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createAdminNotification,
  listAdminNotifications,
};

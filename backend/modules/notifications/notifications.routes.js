const express = require("express");
const controller = require("./notifications.controller");
const { authMiddleware } = require("../auth/auth.middleware");

const router = express.Router();

const anyAuthenticatedUser = authMiddleware();
const adminOnly = authMiddleware(["admin", "super_admin"]);

router.get("/notifications/my", anyAuthenticatedUser, controller.listMyNotifications);
router.get("/notifications/unread-count", anyAuthenticatedUser, controller.getUnreadCount);
router.post("/notifications/:notificationId/read", anyAuthenticatedUser, controller.markAsRead);
router.post("/notifications/read-all", anyAuthenticatedUser, controller.markAllAsRead);
router.get("/admin/notifications", adminOnly, controller.listAdminNotifications);
router.post("/admin/notifications", adminOnly, controller.createAdminNotification);

module.exports = router;

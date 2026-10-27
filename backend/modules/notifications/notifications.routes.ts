const express = require("express");
const controller = require("./notifications.controller");
const { authMiddleware } = require("../auth/auth.middleware");
const { limiters } = require("../../middlewares/rateLimiter");

const router = express.Router();
const {parseCatalogImage}=require("../catalog/catalog.image.middleware");

const anyAuthenticatedUser = authMiddleware();
const adminOnly = authMiddleware(["admin", "super_admin"]);

router.get("/notifications/my", anyAuthenticatedUser, controller.listMyNotifications);
router.get("/notifications/:notificationId/details",anyAuthenticatedUser,controller.getNotification);
router.get("/notifications/unread-count", anyAuthenticatedUser, controller.getUnreadCount);
router.post("/notifications/:notificationId/read", anyAuthenticatedUser, controller.markAsRead);
router.post("/notifications/read-all", anyAuthenticatedUser, controller.markAllAsRead);
router.post("/admin/notifications/images",adminOnly,limiters.imageUpload,parseCatalogImage,controller.uploadImage);
router.get("/admin/notifications/recipients", adminOnly, controller.searchAdminNotificationRecipients);
router.get('/admin/notifications/audience-count', adminOnly, controller.countAdminRecipients);
router.get('/admin/notifications/email-preview', adminOnly, controller.previewAdminEmail);
router.get('/admin/notifications/:key/details', adminOnly, controller.notificationDetails);
router.post('/admin/notifications/:key/:action', adminOnly, limiters.adminNotification, controller.notificationAction);
router.get("/admin/notifications", adminOnly, controller.listAdminNotifications);
router.post("/admin/notifications", adminOnly, limiters.adminNotification, controller.createAdminNotification);

module.exports = router;

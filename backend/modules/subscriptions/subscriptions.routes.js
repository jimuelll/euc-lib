const express    = require("express");
const router     = express.Router();
const controller = require("./subscriptions.controller");
const { authMiddleware } = require("../auth/auth.middleware");

const adminOnly = authMiddleware(["admin", "super_admin"]);


// ── Public ────────────────────────────────────────────────────────────────────
router.get("/subscriptions", controller.getPublicSubscriptions);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get(   "/admin/subscriptions",         adminOnly, controller.getAllSubscriptions);
router.get(   "/admin/subscriptions/:id",     adminOnly, controller.getSubscriptionById);
router.patch( "/admin/subscriptions/reorder", adminOnly, controller.reorderSubscriptions);
router.post(  "/admin/subscriptions",         adminOnly, controller.createSubscription);
router.patch( "/admin/subscriptions/:id",     adminOnly, controller.updateSubscription);
router.delete("/admin/subscriptions/:id",     adminOnly, controller.deleteSubscription);

module.exports = router;
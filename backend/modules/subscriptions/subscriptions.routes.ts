import express = require("express");
import controller = require("./subscriptions.controller");
import auth = require("../auth/auth.middleware");

const router = express.Router();
const { authMiddleware } = auth;
const adminOnly = authMiddleware(["admin", "super_admin"]);

// Public
router.get("/subscriptions", authMiddleware(), controller.getPublicSubscriptions);

// Admin
router.get("/admin/subscriptions", adminOnly, controller.getAllSubscriptions);
router.post("/admin/subscriptions", adminOnly, controller.createSubscription);
router.patch("/admin/subscriptions/reorder", adminOnly, controller.reorderSubscriptions); // before /:id
router.get("/admin/subscriptions/:id", adminOnly, controller.getSubscriptionById);
router.patch("/admin/subscriptions/:id", adminOnly, controller.updateSubscription);
router.delete("/admin/subscriptions/:id", adminOnly, controller.deleteSubscription);

export = router;

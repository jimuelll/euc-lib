const express = require("express");
const { authMiddleware } = require("../auth/auth.middleware");
const controller = require("./query.controller");
const { limiters } = require("../../middlewares/rateLimiter");

const router = express.Router();
// Mounted at /api/admin alongside desk features. Gate matching report routes
// only, otherwise staff requests to later routers would be rejected here.
const adminOnly = authMiddleware(["admin", "super_admin"]);
router.get("/query/meta", adminOnly, controller.getMeta);
router.get("/query", adminOnly, controller.list);
router.get("/query/export", adminOnly, limiters.reportExport, controller.exportCsv);
router.get("/query/reports", adminOnly, controller.listReport);
router.get("/query/reports/export", adminOnly, limiters.reportExport, controller.exportReport);

module.exports = router;

const express = require("express");
const { authMiddleware } = require("../auth/auth.middleware");
const controller = require("./query.controller");
const { limiters } = require("../../middlewares/rateLimiter");

const router = express.Router();
router.use(authMiddleware(["admin", "super_admin"]));
router.get("/query/meta", controller.getMeta);
router.get("/query", controller.list);
router.get("/query/export", limiters.reportExport, controller.exportCsv);
router.get("/query/reports", controller.listReport);
router.get("/query/reports/export", limiters.reportExport, controller.exportReport);

module.exports = router;

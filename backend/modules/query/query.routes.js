const express = require("express");
const { authMiddleware } = require("../auth/auth.middleware");
const controller = require("./query.controller");

const router = express.Router();
router.use(authMiddleware(["admin", "super_admin"]));
router.get("/query/meta", controller.getMeta);
router.get("/query", controller.list);
router.get("/query/export", controller.exportCsv);
router.get("/query/reports", controller.listReport);
router.get("/query/reports/export", controller.exportReport);

module.exports = router;

const express = require("express");
const { authMiddleware } = require("../auth/auth.middleware");
const { handleGetAuditLog, handleGetAuditLogMeta, handleGetDashboardOverview } = require("./analytics.controller");

const router = express.Router();

router.get(
  "/dashboard",
  authMiddleware(["admin", "super_admin"]),
  handleGetDashboardOverview
);

router.get(
  "/dashboard/audit",
  authMiddleware(["super_admin"]),
  handleGetAuditLog
);

router.get(
  "/dashboard/audit/meta",
  authMiddleware(["super_admin"]),
  handleGetAuditLogMeta
);

module.exports = router;

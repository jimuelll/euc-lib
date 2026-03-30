const express = require("express");
const { authMiddleware } = require("../auth/auth.middleware");
const { handleGetDashboardOverview } = require("./analytics.controller");

const router = express.Router();

router.get(
  "/dashboard",
  authMiddleware(["staff", "admin", "super_admin"]),
  handleGetDashboardOverview
);

module.exports = router;

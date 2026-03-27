const express    = require("express");
const router     = express.Router();
const controller = require("./about.controller");
const { authMiddleware } = require("../auth/auth.middleware");

const adminOnly = authMiddleware(["admin", "super_admin"]);

// GET /  — when mounted at /api/about → GET /api/about
router.get("/", controller.getAbout);

// PUT /  — when mounted at /api/admin/about → PUT /api/admin/about
router.put("/", adminOnly, controller.updateAbout);

module.exports = router;
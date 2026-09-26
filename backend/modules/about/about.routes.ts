import express = require("express");
import controller = require("./about.controller");
import auth = require("../auth/auth.middleware");

const { authMiddleware } = auth;

const router = express.Router();
const adminOnly = authMiddleware(["admin", "super_admin"]);

// GET /  — when mounted at /api/about → GET /api/about
router.get("/", controller.getAbout);

// PUT /  — when mounted at /api/admin/about → PUT /api/admin/about
router.put("/", adminOnly, controller.updateAbout);

export = router;

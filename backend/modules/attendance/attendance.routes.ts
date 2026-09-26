import express = require("express");
import controller = require("./attendance.controller");
import auth = require("../auth/auth.middleware");

const router = express.Router();
const { authMiddleware } = auth;

const scannerOrAbove = authMiddleware(["scanner", "staff", "admin", "super_admin"]);
const anyAuthenticatedUser = authMiddleware();
const adminOnly = authMiddleware(["admin", "super_admin"]);

router.post("/scan", scannerOrAbove, controller.scan);
router.get("/today", adminOnly, controller.getToday);
router.get("/logs", adminOnly, controller.getLogs);
router.get("/my", anyAuthenticatedUser, controller.getMy);

export = router;

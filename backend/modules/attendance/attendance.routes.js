const express    = require("express");
const router     = express.Router();
const controller = require("./attendance.controller");
const { authMiddleware } = require("../auth/auth.middleware");

const scannerOrAbove = authMiddleware(["scanner", "staff", "admin", "super_admin"]);
const anyAuthenticatedUser = authMiddleware();
const adminOnly = authMiddleware(["admin", "super_admin"]);

router.post("/scan",  scannerOrAbove, controller.scan);
router.get("/today",  adminOnly, controller.getToday);
router.get("/logs",   adminOnly, controller.getLogs);
router.get("/my",     anyAuthenticatedUser, controller.getMy);

module.exports = router;

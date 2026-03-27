const express    = require("express");
const router     = express.Router();
const controller = require("./attendance.controller");
const { authMiddleware } = require("../auth/auth.middleware");

const scannerOrAbove = authMiddleware(["scanner", "staff", "admin", "super_admin"]);

router.post("/scan",  scannerOrAbove, controller.scan);
router.get("/today",  scannerOrAbove, controller.getToday);
router.get("/my",     scannerOrAbove, controller.getMy);

module.exports = router;
const express = require("express");
const router  = express.Router();
const { handleGetBarcodePng } = require("./admin.controller");
const { authMiddleware } = require("../auth/auth.middleware");

const staffOrAbove = authMiddleware(["staff", "admin", "super_admin"]);

router.get("/:student_employee_id/barcode-png", staffOrAbove, handleGetBarcodePng);

module.exports = router;

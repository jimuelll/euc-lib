const express = require("express");
const router  = express.Router();
const { handleGetBarcodePng } = require("./admin.controller");

router.get("/:student_employee_id/barcode-png", handleGetBarcodePng);

module.exports = router;
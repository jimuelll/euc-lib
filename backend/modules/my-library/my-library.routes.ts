const express = require("express");
const controller = require("./my-library.controller");

const router = express.Router();

router.get("/my-library/dashboard", controller.getDashboard);
router.get("/my-library/barcode-png", controller.getBarcodePng);
router.get("/my-library/history", controller.getHistory);
router.get("/my-library/attendance", controller.getAttendanceHistory);

module.exports = router;

const express = require("express");
const controller = require("./myLibrary.controller");

const router = express.Router();

router.get("/my-library/dashboard", controller.getDashboard);
router.get("/my-library/history", controller.getHistory);
router.get("/my-library/attendance", controller.getAttendanceHistory);

module.exports = router;

const express = require("express");
const controller = require("./myLibrary.controller");

const router = express.Router();

router.get("/my-library/dashboard", controller.getDashboard);

module.exports = router;

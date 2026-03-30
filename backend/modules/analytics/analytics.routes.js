const express = require("express");
const { optionalAuthMiddleware } = require("../auth/auth.middleware");
const { handleTrackVisit } = require("./analytics.controller");

const router = express.Router();

router.post("/visit", optionalAuthMiddleware(), handleTrackVisit);

module.exports = router;

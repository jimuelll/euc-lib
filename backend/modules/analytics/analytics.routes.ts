const express = require("express");
const { optionalAuthMiddleware } = require("../auth/auth.middleware");
const { limiters } = require("../../middlewares/rateLimiter");
const { handleTrackVisit } = require("./analytics.controller");

const router = express.Router();

router.post("/visit", limiters.visit, optionalAuthMiddleware(), handleTrackVisit);

module.exports = router;

const express = require("express");
const router  = express.Router();
const ctrl    = require("./circulation.controller");
const { authMiddleware } = require("../auth/auth.middleware");
const { limiters } = require("../../middlewares/rateLimiter");

// Mounted at /api/admin in app.js
// These endpoints expose patron records and can alter borrowing state, so they
// must be protected here as well as by the global authentication middleware.
router.use(authMiddleware(["staff", "admin", "super_admin"]));

router.post("/circulation/renew",    limiters.deskTransaction, ctrl.processRenew);

module.exports = router;

const express = require("express");
const router  = express.Router();
const ctrl    = require("./circulation.controller");
const { authMiddleware } = require("../auth/auth.middleware");

// Mounted at /api/admin in app.js
// These endpoints expose patron records and can alter borrowing state, so they
// must be protected here as well as by the global authentication middleware.
router.use(authMiddleware(["staff", "admin", "super_admin"]));

router.get ("/users/lookup",         ctrl.lookupUser);
router.get ("/books/lookup",         ctrl.lookupBook);

router.get ("/circulation/log",      ctrl.getCirculationLog);
router.post("/circulation/borrow",   ctrl.processBorrow);
router.post("/circulation/return",   ctrl.processReturn);
router.post("/circulation/renew",    ctrl.processRenew);

module.exports = router;

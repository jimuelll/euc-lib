const express = require("express");
const router  = express.Router();
const ctrl    = require("./circulation.controller");

// Mounted at /api/admin in app.js

router.get ("/users/lookup",         ctrl.lookupUser);
router.get ("/books/lookup",         ctrl.lookupBook);

router.get ("/circulation/log",      ctrl.getCirculationLog);
router.post("/circulation/borrow",   ctrl.processBorrow);
router.post("/circulation/return",   ctrl.processReturn);
router.post("/circulation/renew",    ctrl.processRenew);

module.exports = router;
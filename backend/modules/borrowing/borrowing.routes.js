const express    = require("express");
const router     = express.Router();
const controller = require("./borrowing.controller");

// All routes sit under /borrowing (mounted in app.js after authMiddleware)

router.get ("/catalogue/search",          controller.searchCatalogue);
router.get ("/borrows/active",            controller.getActiveBorrows);
router.get ("/borrows/history",           controller.getBorrowHistory);
router.post("/borrows/:bookId",           controller.borrowBook);
router.post("/borrows/:borrowingId/return", controller.returnBook);

module.exports = router;
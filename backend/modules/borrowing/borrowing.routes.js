const express        = require("express");
const router         = express.Router();
const controller     = require("./borrowing.controller");
const { authMiddleware } = require("../auth/auth.middleware");

const staffOrAbove   = authMiddleware(["staff", "admin", "super_admin"]);
const scannerOrAbove = authMiddleware(["scanner", "staff", "admin", "super_admin"]);

// All routes sit under /borrowing (mounted in app.js after authMiddleware)

// ─── Catalogue ────────────────────────────────────────────────────────────────
router.get("/catalogue/search",               controller.searchCatalogue);

// ─── Student-facing borrows ───────────────────────────────────────────────────
router.get ("/borrows/active",                controller.getActiveBorrows);
router.get ("/borrows/history",               controller.getBorrowHistory);
router.post("/borrows/:bookId",               controller.borrowBook);
router.post("/borrows/:borrowingId/return",   controller.returnBook);

// ─── Barcode scan — book copy preview ────────────────────────────────────────
// NOTE: must be defined BEFORE any :barcode-style wildcard if you add more later
router.get ("/scan/copy/:barcode",            scannerOrAbove, controller.getCopyByBarcode);
router.get("/scan/user",                      scannerOrAbove, controller.lookupUser);

// ─── Barcode scan — borrow / return at the desk ───────────────────────────────
router.post("/scan/borrow",                   scannerOrAbove, controller.scanBorrow);
router.post("/scan/return",                   scannerOrAbove, controller.scanReturn);

module.exports = router;
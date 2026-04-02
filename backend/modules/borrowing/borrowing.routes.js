const express        = require("express");
const router         = express.Router();
const controller     = require("./borrowing.controller");
const { authMiddleware } = require("../auth/auth.middleware");

const staffOrAbove   = authMiddleware(["staff", "admin", "super_admin"]);
const scannerOrAbove = authMiddleware(["scanner", "staff", "admin", "super_admin"]);
const adminOnly      = authMiddleware(["admin", "super_admin"]);

// All routes sit under /borrowing (mounted in app.js after authMiddleware)

// ─── Catalogue ────────────────────────────────────────────────────────────────
router.get("/catalogue/search",               controller.searchCatalogue);

// ─── Student-facing borrows ───────────────────────────────────────────────────
router.get ("/borrows/active",                controller.getActiveBorrows);
router.get ("/borrows/history",               controller.getBorrowHistory);
router.post("/borrows/:bookId",               controller.borrowBook);
router.post("/borrows/:borrowingId/return",   controller.returnBook);

// ─── Barcode scan — book copy preview ────────────────────────────────────────
router.get ("/scan/copy/:barcode",            scannerOrAbove, controller.getCopyByBarcode);
router.get("/scan/user",                      scannerOrAbove, controller.lookupUser);

// ─── Barcode scan — borrow / return at the desk ───────────────────────────────
router.post("/scan/borrow",                   scannerOrAbove, controller.scanBorrow);
router.post("/scan/return",                   scannerOrAbove, controller.scanReturn);

// ─── Admin borrowing management ───────────────────────────────────────────────
router.get   ("/admin/borrows",                          adminOnly, controller.adminGetBorrowings);
router.delete("/admin/borrows/:borrowingId",             adminOnly, controller.adminDeleteBorrowing);
router.patch ("/admin/borrows/:borrowingId/restore",     adminOnly, controller.adminRestoreBorrowing);
router.get   ("/admin/payments",                         adminOnly, controller.getAdminPaymentOverview);
router.get   ("/admin/payments/user",                    adminOnly, controller.getUserPaymentOverview);
router.post  ("/admin/payments/settle",                  adminOnly, controller.settleUserPayments);

module.exports = router;

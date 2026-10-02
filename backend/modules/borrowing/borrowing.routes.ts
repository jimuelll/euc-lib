const express        = require("express");
const router         = express.Router();
const controller     = require("./borrowing.controller");
const { authMiddleware } = require("../auth/auth.middleware");
const { limiters } = require("../../middlewares/rateLimiter");

const staffOrAbove   = authMiddleware(["staff", "admin", "super_admin"]);
const scannerOrAbove = authMiddleware(["scanner", "staff", "admin", "super_admin"]);
const adminOnly      = authMiddleware(["admin", "super_admin"]);

// All routes sit under /borrowing (mounted in app.js after authMiddleware)

// ─── Catalogue ────────────────────────────────────────────────────────────────
router.get("/catalogue/search",               limiters.authenticatedCatalogue, controller.searchCatalogue);

// ─── Student-facing borrows ───────────────────────────────────────────────────
router.get ("/borrows/active",                controller.getActiveBorrows);
router.get ("/borrows/history",               controller.getBorrowHistory);
router.post("/borrows/:bookId",               limiters.studentTransaction, controller.borrowBook);
router.post("/borrows/:borrowingId/return",   limiters.studentTransaction, controller.returnBook);

// ─── Barcode scan — book copy preview ────────────────────────────────────────
router.get ("/scan/copy/:barcode",            scannerOrAbove, controller.getCopyByBarcode);
router.get("/scan/user",                      scannerOrAbove, controller.lookupUser);

// ─── Barcode scan — borrow / return at the desk ───────────────────────────────
router.post("/scan/borrow",                   scannerOrAbove, limiters.deskTransaction, controller.scanBorrow);
router.post("/scan/return",                   scannerOrAbove, limiters.deskTransaction, controller.scanReturn);
router.get ("/scan/return-preview/:identifier", scannerOrAbove, controller.getReturnPreview);

// ─── Admin borrowing management ───────────────────────────────────────────────
router.get   ("/admin/borrows",                          staffOrAbove, controller.adminGetBorrowings);
router.delete("/admin/borrows/:borrowingId",             adminOnly, controller.adminDeleteBorrowing);
router.patch ("/admin/borrows/:borrowingId/restore",     adminOnly, controller.adminRestoreBorrowing);
router.get   ("/admin/payments",                         adminOnly, controller.getAdminPaymentOverview);
router.get   ("/admin/payments/user",                    adminOnly, controller.getUserPaymentOverview);
router.post  ("/admin/payments/settle",                  adminOnly, controller.settleUserPayments);

module.exports = router;

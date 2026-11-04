const express        = require("express");
const router         = express.Router();
const controller     = require("./borrowing.controller");
const { authMiddleware } = require("../auth/auth.middleware");
const { limiters } = require("../../middlewares/rateLimiter");

const staffOrAbove   = authMiddleware(["staff", "admin", "super_admin"]);
const adminOnly      = authMiddleware(["admin", "super_admin"]);

// All routes sit under /borrowing (mounted in app.js after authMiddleware)

// ─── Barcode scan — book copy preview ────────────────────────────────────────
router.get ("/scan/copy/:barcode",            staffOrAbove, controller.getCopyByBarcode);
router.get("/scan/user",                      staffOrAbove, controller.lookupUser);

// ─── Barcode scan — borrow / return at the desk ───────────────────────────────
router.post("/scan/borrow",                   staffOrAbove, limiters.deskTransaction, controller.scanBorrow);
router.post("/scan/return",                   staffOrAbove, limiters.deskTransaction, controller.scanReturn);
router.post("/scan/undo", staffOrAbove, limiters.deskTransaction, controller.undoDeskTransaction);
router.get ("/scan/return-preview/:identifier", staffOrAbove, controller.getReturnPreview);

// ─── Admin borrowing management ───────────────────────────────────────────────
router.get   ("/admin/borrows",                          staffOrAbove, controller.adminGetBorrowings);
router.delete("/admin/borrows/:borrowingId",             adminOnly, controller.adminDeleteBorrowing);
router.patch ("/admin/borrows/:borrowingId/restore",     adminOnly, controller.adminRestoreBorrowing);

module.exports = router;

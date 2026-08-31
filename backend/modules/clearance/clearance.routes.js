const express = require("express");
const { authMiddleware } = require("../auth/auth.middleware");
const controller = require("./clearance.controller");
const router = express.Router();
const staffOrAbove = authMiddleware(["staff", "admin", "super_admin"]);

// Clearance records and payment entry are desk operations. These routes are
// mounted behind authentication in app.js, but still need their own role gate
// so regular patrons cannot access them directly.
router.get("/clearance/profile", staffOrAbove, controller.getProfile);
router.post("/clearance/payment", staffOrAbove, controller.recordPayment);
router.post("/clearance/borrowings/:borrowingId/adjust", authMiddleware(["admin", "super_admin"]), controller.adjustFine);
router.post("/clearance/transactions/:transactionId/reverse", authMiddleware(["admin", "super_admin"]), controller.reverseTransaction);
router.get("/clearance/receipts/:receiptNumber", staffOrAbove, controller.getReceipt);
module.exports = router;

const express    = require("express");
const router     = express.Router();
const controller = require("./adminReservation.controller");
const { authMiddleware } = require("../auth/auth.middleware");

// Mounted at /api/admin in app.js — mirrors how circulation.routes.js works
// Full paths become: /api/admin/reservations, /api/admin/reservations/:id/ready, etc.

const adminOnly = authMiddleware(["admin", "super_admin"]);

router.get ("/reservations",                          adminOnly, controller.getAdminReservations);
router.post("/reservations/:reservationId/ready",     adminOnly, controller.markReservationReady);
router.post("/reservations/:reservationId/fulfill",   adminOnly, controller.fulfillReservation);
router.post("/reservations/:reservationId/cancel",    adminOnly, controller.cancelReservationAdmin);

module.exports = router;
const express    = require("express");
const router     = express.Router();
const controller = require("./reservation.controller");
const { limiters } = require("../../middlewares/rateLimiter");

// Mounted at /reservations in app.js — do not repeat the prefix here

router.get ("/catalogue/search",            limiters.authenticatedCatalogue, controller.searchCatalogue);
router.get ("/active",                      controller.getActiveReservations);
router.get ("/history",                     controller.getReservationHistory);
router.post("/:reservationId/cancel",       limiters.studentTransaction, controller.cancelReservation);
router.post("/:bookId",                     limiters.studentTransaction, controller.reserveBook);

module.exports = router;

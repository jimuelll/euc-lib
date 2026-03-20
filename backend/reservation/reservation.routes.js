const express    = require("express");
const router     = express.Router();
const controller = require("./reservation.controller");

// Mounted at /reservations in app.js — do not repeat the prefix here

router.get ("/catalogue/search",            controller.searchCatalogue);
router.get ("/active",                      controller.getActiveReservations);
router.get ("/history",                     controller.getReservationHistory);
router.post("/:reservationId/cancel",       controller.cancelReservation);
router.post("/:bookId",                     controller.reserveBook);

module.exports = router;
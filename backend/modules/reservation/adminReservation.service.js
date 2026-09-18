const reservationService = require("./reservation.service");
const repository = require("./reservation.repository");

async function markReservationReady(reservationId) { await reservationService.markReservationReady(reservationId); return repository.getReservationNotificationTarget(reservationId); }
async function cancelReservationAdmin(reservationId) { await reservationService.cancelReservationAdmin(reservationId); return repository.getReservationNotificationTarget(reservationId); }
async function archiveReservation(reservationId, deletedBy) { return repository.archiveReservation(reservationId, deletedBy); }

module.exports = {
  getAdminReservations: reservationService.getAdminReservations,
  markReservationReady,
  cancelReservationAdmin,
  restoreReservation: reservationService.restoreReservation,
  archiveReservation,
};

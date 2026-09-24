const reservationService = require("./reservation.service");
const repository = require("./reservation.repository");

async function markReservationReady(reservationId, actorId) { await reservationService.markReservationReady(reservationId, actorId); return repository.getReservationNotificationTarget(reservationId); }
async function cancelReservationAdmin(reservationId, actorId) { await reservationService.cancelReservationAdmin(reservationId, actorId); return repository.getReservationNotificationTarget(reservationId); }
async function archiveReservation(reservationId, deletedBy) { return repository.archiveReservation(reservationId, deletedBy); }

module.exports = {
  getAdminReservations: reservationService.getAdminReservations,
  markReservationReady,
  cancelReservationAdmin,
  restoreReservation: reservationService.restoreReservation,
  archiveReservation,
};

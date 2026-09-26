import reservationService = require("./reservation.service");
import repository = require("./reservation.repository");

const markReservationReady = async (reservationId: number, actorId: number) => {
  await reservationService.markReservationReady(reservationId, actorId);
  return repository.getReservationNotificationTarget(reservationId);
};

const cancelReservationAdmin = async (reservationId: number, actorId: number) => {
  await reservationService.cancelReservationAdmin(reservationId, actorId);
  return repository.getReservationNotificationTarget(reservationId);
};

const archiveReservation = async (reservationId: number, deletedBy: number): Promise<void> => repository.archiveReservation(reservationId, deletedBy);

export = {
  getAdminReservations: reservationService.getAdminReservations,
  markReservationReady,
  cancelReservationAdmin,
  restoreReservation: reservationService.restoreReservation,
  archiveReservation,
};

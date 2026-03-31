const service = require("../reservation/reservation.service");
const db      = require("../../db");
const notificationsService = require("../notifications/notifications.service");

const getReservationNotificationTarget = async (reservationId) => {
  const [[row]] = await db.query(
    `SELECT
       r.id,
       r.user_id,
       r.status,
       bk.title
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id
     WHERE r.id = ?
     LIMIT 1`,
    [reservationId]
  );

  return row ?? null;
};

const getAdminReservations = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit  = Math.min(50, parseInt(req.query.limit, 10) || 15);
    const search = req.query.search ?? "";
    const status = req.query.status ?? "all";
    const dateFrom = req.query.dateFrom ?? "";
    const dateTo = req.query.dateTo ?? "";

    const result = await service.getAdminReservations({ search, status, dateFrom, dateTo, page, limit });
    res.json(result);
  } catch (err) {
    console.error("[admin/reservations] getAdminReservations:", err);
    res.status(500).json({ message: "Failed to fetch reservations" });
  }
};

const markReservationReady = async (req, res) => {
  try {
    const reservationId = parseInt(req.params.reservationId, 10);
    if (isNaN(reservationId) || reservationId < 1) {
      return res.status(400).json({ message: "Invalid reservation ID" });
    }
    await service.markReservationReady(reservationId);
    const target = await getReservationNotificationTarget(reservationId);
    if (target) {
      await notificationsService.createNotification({
        type: "reservation_ready",
        title: "Reservation ready for pickup",
        body: `${target.title} is now ready for pickup at the library front desk.`,
        href: "/services/borrowing",
        audienceType: "user",
        audienceUserId: target.user_id,
        createdBy: req.user.id,
      });
    }
    res.json({ message: "Reservation marked as ready" });
  } catch (err) {
    console.error("[admin/reservations] markReservationReady:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Action failed" });
  }
};

const fulfillReservation = async (req, res) => {
  try {
    const reservationId = parseInt(req.params.reservationId, 10);
    if (isNaN(reservationId) || reservationId < 1) {
      return res.status(400).json({ message: "Invalid reservation ID" });
    }
    await service.fulfillReservation(reservationId);
    const target = await getReservationNotificationTarget(reservationId);
    if (target) {
      await notificationsService.createNotification({
        type: "reservation_fulfilled",
        title: "Reservation completed",
        body: `Your reservation for ${target.title} has been fulfilled successfully.`,
        href: "/my-library",
        audienceType: "user",
        audienceUserId: target.user_id,
        createdBy: req.user.id,
      });
    }
    res.json({ message: "Reservation fulfilled" });
  } catch (err) {
    console.error("[admin/reservations] fulfillReservation:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Action failed" });
  }
};

const cancelReservationAdmin = async (req, res) => {
  try {
    const reservationId = parseInt(req.params.reservationId, 10);
    if (isNaN(reservationId) || reservationId < 1) {
      return res.status(400).json({ message: "Invalid reservation ID" });
    }
    await service.cancelReservationAdmin(reservationId);
    const target = await getReservationNotificationTarget(reservationId);
    if (target) {
      await notificationsService.createNotification({
        type: "reservation_cancelled",
        title: "Reservation rejected",
        body: `Your reservation for ${target.title} was rejected by the library staff.`,
        href: "/services/borrowing",
        audienceType: "user",
        audienceUserId: target.user_id,
        createdBy: req.user.id,
      });
    }
    res.json({ message: "Reservation cancelled" });
  } catch (err) {
    console.error("[admin/reservations] cancelReservationAdmin:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Action failed" });
  }
};

const deleteReservationAdmin = async (req, res) => {
  try {
    const reservationId = parseInt(req.params.reservationId, 10);
    if (isNaN(reservationId) || reservationId < 1) {
      return res.status(400).json({ message: "Invalid reservation ID" });
    }

    // Only terminal reservations (cancelled, expired, fulfilled) can be soft-deleted
    const [[row]] = await db.query(
      "SELECT status FROM reservations WHERE id = ? AND deleted_at IS NULL",
      [reservationId]
    );
    if (!row) return res.status(404).json({ message: "Reservation not found" });
    if (["pending", "ready"].includes(row.status)) {
      return res.status(409).json({ message: "Cancel or fulfil the reservation before archiving it" });
    }

    await db.query(
      "UPDATE reservations SET deleted_at = NOW(), deleted_by = ? WHERE id = ?",
      [req.user.id, reservationId]
    );
    res.json({ message: "Reservation archived successfully" });
  } catch (err) {
    console.error("[admin/reservations] deleteReservationAdmin:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Action failed" });
  }
};

const restoreReservationAdmin = async (req, res) => {
  try {
    const reservationId = parseInt(req.params.reservationId, 10);
    if (isNaN(reservationId) || reservationId < 1) {
      return res.status(400).json({ message: "Invalid reservation ID" });
    }
    await service.restoreReservation(reservationId);
    res.json({ message: "Reservation restored successfully" });
  } catch (err) {
    console.error("[admin/reservations] restoreReservationAdmin:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Action failed" });
  }
};

module.exports = {
  getAdminReservations,
  markReservationReady,
  fulfillReservation,
  cancelReservationAdmin,
  deleteReservationAdmin,
  restoreReservationAdmin,
};

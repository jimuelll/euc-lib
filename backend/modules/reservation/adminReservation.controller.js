const service = require("../reservation/reservation.service");
const db      = require("../../db");

const getAdminReservations = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit  = Math.min(50, parseInt(req.query.limit, 10) || 15);
    const search = req.query.search ?? "";
    const status = req.query.status ?? "all";

    const result = await service.getAdminReservations({ search, status, page, limit });
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
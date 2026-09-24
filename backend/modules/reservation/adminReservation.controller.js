const service = require("./adminReservation.service");

const getAdminReservations = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit  = Math.min(50, parseInt(req.query.limit, 10) || 15);
    const search = req.query.search ?? "";
    const status = req.query.status ?? "all";
    const dateFrom = req.query.dateFrom ?? "";
    const dateTo = req.query.dateTo ?? "";
    const archived = req.query.archived === "true";

    const result = await service.getAdminReservations({ search, status, dateFrom, dateTo, archived, page, limit });
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
    await service.markReservationReady(reservationId, req.user.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Reservation marked as ready" });
  } catch (err) {
    console.error("[admin/reservations] markReservationReady:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Action failed" });
  }
};

const fulfillReservation = async (req, res) => {
  res.status(409).json({
    message: "Complete checkout in Circulation to fulfill this reservation.",
  });
};

const cancelReservationAdmin = async (req, res) => {
  try {
    const reservationId = parseInt(req.params.reservationId, 10);
    if (isNaN(reservationId) || reservationId < 1) {
      return res.status(400).json({ message: "Invalid reservation ID" });
    }
    await service.cancelReservationAdmin(reservationId, req.user.id);
    res.locals.auditEnqueued = true;
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

    await service.archiveReservation(reservationId, req.user.id);
    res.locals.auditEnqueued = true;
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
    await service.restoreReservation(reservationId, req.user.id);
    res.locals.auditEnqueued = true;
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

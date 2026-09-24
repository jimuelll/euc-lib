const service = require("./reservation.service");
const { logError } = require("../../logger");

const searchCatalogue = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query?.trim()) {
      return res.status(400).json({ message: "Search query is required" });
    }
    const books = await service.searchCatalogue(query.trim(), { page: req.query.page, limit: req.query.limit });
    res.json(books);
  } catch (err) {
    logError("[reservation] searchCatalogue:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to search catalogue" });
  }
};

const getActiveReservations = async (req, res) => {
  try {
    const rows = await service.getActiveReservations(req.user.id);
    res.json(rows);
  } catch (err) {
    logError("[reservation] getActiveReservations:", err);
    res.status(500).json({ message: "Failed to fetch reservations" });
  }
};

const getReservationHistory = async (req, res) => {
  try {
    const rows = await service.getReservationHistory(req.user.id, { page: req.query.page, limit: req.query.limit });
    res.json(rows);
  } catch (err) {
    logError("[reservation] getReservationHistory:", err);
    res.status(500).json({ message: "Failed to fetch reservation history" });
  }
};

const reserveBook = async (req, res) => {
  try {
    const bookId = parseInt(req.params.bookId, 10);
    if (isNaN(bookId) || bookId < 1) {
      return res.status(400).json({ message: "Invalid book ID" });
    }
    const result = await service.reserveBook(req.user.id, bookId);
    res.locals.auditEnqueued = true;
    res.status(201).json({ message: "Book reserved successfully", ...result });
  } catch (err) {
    logError("[reservation] reserveBook:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to reserve book" });
  }
};

const cancelReservation = async (req, res) => {
  try {
    const reservationId = parseInt(req.params.reservationId, 10);
    if (isNaN(reservationId) || reservationId < 1) {
      return res.status(400).json({ message: "Invalid reservation ID" });
    }
    await service.cancelReservation(reservationId, req.user.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Reservation cancelled" });
  } catch (err) {
    logError("[reservation] cancelReservation:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to cancel reservation" });
  }
};

module.exports = {
  searchCatalogue,
  getActiveReservations,
  getReservationHistory,
  reserveBook,
  cancelReservation,
};

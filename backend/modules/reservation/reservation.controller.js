const service = require("./reservation.service");

const searchCatalogue = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query?.trim()) {
      return res.status(400).json({ message: "Search query is required" });
    }
    const books = await service.searchCatalogue(query.trim());
    res.json(books);
  } catch (err) {
    console.error("[reservation] searchCatalogue:", err);
    res.status(500).json({ message: "Failed to search catalogue" });
  }
};

const getActiveReservations = async (req, res) => {
  try {
    const rows = await service.getActiveReservations(req.user.id);
    res.json(rows);
  } catch (err) {
    console.error("[reservation] getActiveReservations:", err);
    res.status(500).json({ message: "Failed to fetch reservations" });
  }
};

const getReservationHistory = async (req, res) => {
  try {
    const rows = await service.getReservationHistory(req.user.id);
    res.json(rows);
  } catch (err) {
    console.error("[reservation] getReservationHistory:", err);
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
    res.status(201).json({ message: "Book reserved successfully", ...result });
  } catch (err) {
    console.error("[reservation] reserveBook:", err);
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
    res.json({ message: "Reservation cancelled" });
  } catch (err) {
    console.error("[reservation] cancelReservation:", err);
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
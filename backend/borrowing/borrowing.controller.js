const service = require("./borrowing.service");

const getActiveBorrows = async (req, res) => {
  try {
    const rows = await service.getActiveBorrows(req.user.id);
    res.json(rows);
  } catch (err) {
    console.error("[borrowing] getActiveBorrows:", err);
    res.status(500).json({ message: "Failed to fetch borrows" });
  }
};

const getBorrowHistory = async (req, res) => {
  try {
    const rows = await service.getBorrowHistory(req.user.id);
    res.json(rows);
  } catch (err) {
    console.error("[borrowing] getBorrowHistory:", err);
    res.status(500).json({ message: "Failed to fetch history" });
  }
};

const searchCatalogue = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query?.trim()) {
      return res.status(400).json({ message: "Search query is required" });
    }
    const books = await service.searchCatalogueWithAvailability(query.trim());
    res.json(books);
  } catch (err) {
    console.error("[borrowing] searchCatalogue:", err);
    res.status(500).json({ message: "Failed to search catalogue" });
  }
};

const borrowBook = async (req, res) => {
  try {
    const bookId     = parseInt(req.params.bookId, 10);
    const daysAllowed = req.body?.daysAllowed ?? 7;

    if (isNaN(bookId) || bookId < 1) {
      return res.status(400).json({ message: "Invalid book ID" });
    }

    const result = await service.borrowBook(
      req.user.id,
      bookId,
      req.user.id,  // issued_by = self-service; staff override can pass body.issuedBy
      daysAllowed
    );
    res.status(201).json({ message: "Book borrowed successfully", ...result });
  } catch (err) {
    console.error("[borrowing] borrowBook:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to borrow book" });
  }
};

const returnBook = async (req, res) => {
  try {
    const borrowingId = parseInt(req.params.borrowingId, 10);
    if (isNaN(borrowingId) || borrowingId < 1) {
      return res.status(400).json({ message: "Invalid borrowing ID" });
    }
    await service.returnBook(borrowingId, req.user.id);
    res.json({ message: "Book returned successfully" });
  } catch (err) {
    console.error("[borrowing] returnBook:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to return book" });
  }
};

module.exports = {
  getActiveBorrows,
  getBorrowHistory,
  searchCatalogue,
  borrowBook,
  returnBook,
};
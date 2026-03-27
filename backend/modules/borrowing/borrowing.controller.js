const service = require("./borrowing.service");

// ─── Existing endpoints ───────────────────────────────────────────────────────

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

/**
 * POST /borrowings/borrows/:bookId
 * Legacy numeric bookId path — picks any available copy automatically.
 */
const borrowBook = async (req, res) => {
  try {
    const bookId      = parseInt(req.params.bookId, 10);
    const daysAllowed = req.body?.daysAllowed ?? 7;

    if (isNaN(bookId) || bookId < 1) {
      return res.status(400).json({ message: "Invalid book ID" });
    }

    const result = await service.borrowBook(
      req.user.id,
      bookId,
      req.user.id,
      daysAllowed,
      { isCopyBarcode: false, ipAddress: req.ip }
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

// ─── Barcode scan endpoints ───────────────────────────────────────────────────

/**
 * POST /borrowings/scan/borrow
 * Body: { userBarcode, copyBarcode, daysAllowed? }
 * Used by staff/scanner — scan a user's ID card then the book copy.
 */
const scanBorrow = async (req, res) => {
  try {
    const { userBarcode, copyBarcode, daysAllowed = 7 } = req.body;

    if (!userBarcode?.trim() || !copyBarcode?.trim()) {
      return res.status(400).json({ message: "userBarcode and copyBarcode are required" });
    }

    const patron = await service.resolveUserByBarcode(userBarcode.trim());
    if (!patron) {
      return res.status(404).json({ message: "User barcode not recognised" });
    }

    const result = await service.borrowBook(
      patron.id,
      copyBarcode.trim(),
      req.user.id,
      daysAllowed,
      { isCopyBarcode: true, ipAddress: req.ip }
    );

    res.status(201).json({
      message: "Book borrowed successfully",
      patron: { id: patron.id, name: patron.name },
      ...result,
    });
  } catch (err) {
    console.error("[borrowing] scanBorrow:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to borrow book" });
  }
};

/**
 * POST /borrowings/scan/return
 * Body: { copyBarcode }
 * Finds the active borrowing for this copy and marks it returned.
 */
const scanReturn = async (req, res) => {
  try {
    const { copyBarcode } = req.body;
    if (!copyBarcode?.trim()) {
      return res.status(400).json({ message: "copyBarcode is required" });
    }

    const row = await service.getActiveBorrowingByCopyBarcode(copyBarcode.trim());
    if (!row) {
      return res.status(404).json({ message: "No active borrowing found for this copy" });
    }

    await service.returnBook(row.id, row.user_id);
    res.json({ message: "Book returned successfully", borrowingId: row.id });
  } catch (err) {
    console.error("[borrowing] scanReturn:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to return book" });
  }
};

/**
 * GET /borrowings/scan/copy/:barcode
 * Preview copy + book info before confirming a borrow.
 */
const getCopyByBarcode = async (req, res) => {
  try {
    const copy = await service.resolveCopyByBarcode(req.params.barcode);
    if (!copy) return res.status(404).json({ message: "Copy not found" });
    res.json(copy);
  } catch (err) {
    console.error("[borrowing] getCopyByBarcode:", err);
    res.status(500).json({ message: "Failed to resolve barcode" });
  }
};

module.exports = {
  getActiveBorrows,
  getBorrowHistory,
  searchCatalogue,
  borrowBook,
  returnBook,
  scanBorrow,
  scanReturn,
  getCopyByBarcode,
};
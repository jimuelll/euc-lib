const service = require("./borrowing.service");
const { logError } = require("../../logger");

// ─── Existing endpoints ───────────────────────────────────────────────────────

const getActiveBorrows = async (req, res) => {
  try {
    const rows = await service.getActiveBorrows(req.user.id);
    res.json(rows);
  } catch (err) {
    logError("[borrowing] getActiveBorrows:", err);
    res.status(500).json({ message: "Failed to fetch borrows" });
  }
};

const getBorrowHistory = async (req, res) => {
  try {
    const rows = await service.getBorrowHistory(req.user.id, { page: req.query.page, limit: req.query.limit });
    res.json(rows);
  } catch (err) {
    logError("[borrowing] getBorrowHistory:", err);
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
    logError("[borrowing] searchCatalogue:", err);
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
    if (isNaN(bookId) || bookId < 1) {
      return res.status(400).json({ message: "Invalid book ID" });
    }

    const result = await service.borrowBook(
      req.user.id,
      bookId,
      req.user.id,
      { isCopyBarcode: false, ipAddress: req.ip, auditRoute: `/api/borrowing/borrows/${bookId}` }
    );
    res.locals.auditEnqueued = true;
    res.status(201).json({ message: "Book borrowed successfully", ...result });
  } catch (err) {
    logError("[borrowing] borrowBook:", err);
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
    res.locals.auditEnqueued = true;
    res.json({ message: "Book returned successfully" });
  } catch (err) {
    logError("[borrowing] returnBook:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to return book" });
  }
};

// ─── Barcode scan endpoints ───────────────────────────────────────────────────

/**
 * POST /borrowings/scan/borrow
 * Body: { userBarcode, copyBarcode, reservationId? }
 * Used by staff/scanner — scan a user's ID card then the book copy.
 */
const scanBorrow = async (req, res) => {
  try {
    const { userBarcode, copyBarcode, reservationId } = req.body;

    if (!userBarcode?.trim() || !copyBarcode?.trim()) {
      return res.status(400).json({ message: "userBarcode and copyBarcode are required" });
    }

    const parsedReservationId = reservationId === undefined || reservationId === null
      ? null
      : Number.parseInt(reservationId, 10);
    if (parsedReservationId !== null && (!Number.isInteger(parsedReservationId) || parsedReservationId < 1)) {
      return res.status(400).json({ message: "reservationId must be a valid reservation ID" });
    }

    const patron = await service.resolveUserByBarcode(userBarcode.trim());
    if (!patron) {
      return res.status(404).json({ message: "User barcode not recognised" });
    }

    const result = await service.borrowBook(
      patron.id,
      copyBarcode.trim(),
      req.user.id,
      { isCopyBarcode: true, ipAddress: req.ip, reservationId: parsedReservationId, auditRoute: "/api/borrowing/scan/borrow" }
    );
    res.locals.auditEnqueued = true;

    res.status(201).json({
      message: "Book borrowed successfully",
      patron: { id: patron.id, name: patron.name },
      ...result,
    });
  } catch (err) {
    logError("[borrowing] scanBorrow:", err);
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

    const result = await service.returnBook(row.id, row.user_id, { auditRoute: "/api/borrowing/scan/return", actorId: req.user.id });
    res.locals.auditEnqueued = true;
    res.json({ message: "Book returned successfully", borrowingId: row.id, returnedAt: result.returnedAt });
  } catch (err) {
    logError("[borrowing] scanReturn:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to return book" });
  }
};

/**
 * GET /borrowings/scan/return-preview/:identifier
 * Resolves an accession number or copy QR code to its active loan and patron.
 */
const getReturnPreview = async (req, res) => {
  try {
    const identifier = req.params.identifier?.trim();
    if (!identifier) return res.status(400).json({ message: "An accession number or copy QR code is required" });

    const row = await service.getReturnPreviewByIdentifier(identifier);
    if (!row) return res.status(404).json({ message: "No active loan found for this accession number or copy QR code" });
    res.json(row);
  } catch (err) {
    logError("[borrowing] getReturnPreview:", err);
    res.status(500).json({ message: "Failed to look up the active loan" });
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
    logError("[borrowing] getCopyByBarcode:", err);
    res.status(500).json({ message: "Failed to resolve barcode" });
  }
};

const lookupUser = async (req, res) => {
  try {
    const { student_employee_id } = req.query;
    if (!student_employee_id?.trim()) {
      return res.status(400).json({ message: "student_employee_id is required" });
    }
    const result = await service.lookupUserWithBorrows(student_employee_id.trim());
    if (!result) return res.status(404).json({ message: "User not found" });
    res.json(result);
  } catch (err) {
    logError("[borrowing] lookupUser:", err);
    res.status(500).json({ message: "Failed to look up user" });
  }
};

// ─── Admin borrowing management ───────────────────────────────────────────────

const adminGetBorrowings = async (req, res) => {
  try {
    const page         = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit        = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const search       = req.query.search ?? "";
    const status       = req.query.status ?? "all";
    const showArchived = req.query.archived === "true";
    const dateFrom     = req.query.dateFrom ?? "";
    const dateTo       = req.query.dateTo ?? "";

    const result = await service.adminGetBorrowings({
      search,
      status,
      showArchived,
      page,
      limit,
      dateFrom,
      dateTo,
    });
    res.json(result);
  } catch (err) {
    logError("[borrowing] adminGetBorrowings:", err);
    res.status(500).json({ message: "Failed to fetch borrowings" });
  }
};

const adminDeleteBorrowing = async (req, res) => {
  try {
    const borrowingId = parseInt(req.params.borrowingId, 10);
    if (isNaN(borrowingId) || borrowingId < 1) {
      return res.status(400).json({ message: "Invalid borrowing ID" });
    }
    await service.adminDeleteBorrowing(borrowingId, req.user.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Borrowing record archived successfully" });
  } catch (err) {
    logError("[borrowing] adminDeleteBorrowing:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to archive borrowing", ...(err.outstandingAmount !== undefined ? { outstandingAmount: err.outstandingAmount, affectedLoans: err.affectedLoans } : {}) });
  }
};

const adminRestoreBorrowing = async (req, res) => {
  try {
    const borrowingId = parseInt(req.params.borrowingId, 10);
    if (isNaN(borrowingId) || borrowingId < 1) {
      return res.status(400).json({ message: "Invalid borrowing ID" });
    }
    await service.adminRestoreBorrowing(borrowingId, req.user.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Borrowing record restored successfully" });
  } catch (err) {
    logError("[borrowing] adminRestoreBorrowing:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to restore borrowing" });
  }
};

const getAdminPaymentOverview = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const page = req.query.page === undefined ? null : Math.max(1, parseInt(req.query.page, 10) || 1);
    const result = await service.getAdminPaymentOverview({ page, limit });
    res.json(result);
  } catch (err) {
    logError("[borrowing] getAdminPaymentOverview:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to fetch payment overview" });
  }
};

const getUserPaymentOverview = async (req, res) => {
  try {
    const studentEmployeeId = String(req.query.student_employee_id ?? "").trim();

    if (!studentEmployeeId) {
      return res.status(400).json({ message: "student_employee_id is required" });
    }

    const result = await service.getUserPaymentOverview(studentEmployeeId);
    res.json(result);
  } catch (err) {
    logError("[borrowing] getUserPaymentOverview:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to fetch user payment overview" });
  }
};

const settleUserPayments = async (req, res) => {
  res.status(410).json({
    message: "Payments are recorded through Clearance as a full cash settlement. Open the Clearance workspace to continue.",
  });
};

module.exports = {
  getActiveBorrows,
  getBorrowHistory,
  searchCatalogue,
  borrowBook,
  returnBook,
  scanBorrow,
  scanReturn,
  getReturnPreview,
  getCopyByBarcode,
  lookupUser,
  adminGetBorrowings,
  adminDeleteBorrowing,
  adminRestoreBorrowing,
  getAdminPaymentOverview,
  getUserPaymentOverview,
  settleUserPayments,
};

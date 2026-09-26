import type { Request, RequestHandler } from "express";
import service = require("./borrowing.service");
import type { AuthTokenPayload } from "../auth/auth.types";

const { logError } = require("../../logger") as { logError: (...values: unknown[]) => void };

type AuthenticatedRequest = Request & { user: AuthTokenPayload };
type RequestError = { status?: number; message?: string; outstandingAmount?: number; affectedLoans?: number };
const authUser = (req: Request): AuthTokenPayload => (req as AuthenticatedRequest).user;
const routeText = (value: string | string[]): string => String(value);
const parseInteger = (value: unknown): number => Number.parseInt(String(value), 10);
const requestError = (error: unknown): RequestError => error as RequestError;

const getActiveBorrows: RequestHandler = async (req, res) => {
  try {
    const rows = await service.getActiveBorrows(authUser(req).id);
    res.json(rows);
  } catch (error: unknown) {
    logError("[borrowing] getActiveBorrows:", error);
    res.status(500).json({ message: "Failed to fetch borrows" });
  }
};

const getBorrowHistory: RequestHandler = async (req, res) => {
  try {
    const rows = await service.getBorrowHistory(authUser(req).id, { page: req.query.page, limit: req.query.limit });
    res.json(rows);
  } catch (error: unknown) {
    logError("[borrowing] getBorrowHistory:", error);
    res.status(500).json({ message: "Failed to fetch history" });
  }
};

const searchCatalogue: RequestHandler = async (req, res) => {
  try {
    const query = req.query.query as string | undefined;
    if (!query?.trim()) {
      res.status(400).json({ message: "Search query is required" });
      return;
    }
    const books = await service.searchCatalogueWithAvailability(query.trim());
    res.json(books);
  } catch (error: unknown) {
    logError("[borrowing] searchCatalogue:", error);
    res.status(500).json({ message: "Failed to search catalogue" });
  }
};

/**
 * POST /borrowings/borrows/:bookId
 * Legacy numeric bookId path — picks any available copy automatically.
 */
const borrowBook: RequestHandler = async (req, res) => {
  try {
    const bookId = parseInteger(req.params.bookId);
    if (Number.isNaN(bookId) || bookId < 1) {
      res.status(400).json({ message: "Invalid book ID" });
      return;
    }

    const user = authUser(req);
    const result = await service.borrowBook(
      user.id,
      bookId,
      user.id,
      { isCopyBarcode: false, ipAddress: req.ip, auditRoute: `/api/borrowing/borrows/${bookId}` },
    );
    res.locals.auditEnqueued = true;
    res.status(201).json({ message: "Book borrowed successfully", ...result });
  } catch (error: unknown) {
    logError("[borrowing] borrowBook:", error);
    const caught = requestError(error);
    res.status(caught.status ?? 500).json({ message: caught.message ?? "Failed to borrow book" });
  }
};

const returnBook: RequestHandler = async (req, res) => {
  try {
    const borrowingId = parseInteger(req.params.borrowingId);
    if (Number.isNaN(borrowingId) || borrowingId < 1) {
      res.status(400).json({ message: "Invalid borrowing ID" });
      return;
    }
    await service.returnBook(borrowingId, authUser(req).id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Book returned successfully" });
  } catch (error: unknown) {
    logError("[borrowing] returnBook:", error);
    const caught = requestError(error);
    res.status(caught.status ?? 500).json({ message: caught.message ?? "Failed to return book" });
  }
};

/**
 * POST /borrowings/scan/borrow
 * Body: { userBarcode, copyBarcode, reservationId? }
 * Used by staff/scanner — scan a user's ID card then the book copy.
 */
const scanBorrow: RequestHandler = async (req, res) => {
  try {
    const { userBarcode, copyBarcode, reservationId } = req.body;

    if (!userBarcode?.trim() || !copyBarcode?.trim()) {
      res.status(400).json({ message: "userBarcode and copyBarcode are required" });
      return;
    }

    const parsedReservationId = reservationId === undefined || reservationId === null
      ? null
      : Number.parseInt(reservationId, 10);
    if (parsedReservationId !== null && (!Number.isInteger(parsedReservationId) || parsedReservationId < 1)) {
      res.status(400).json({ message: "reservationId must be a valid reservation ID" });
      return;
    }

    const patron = await service.resolveUserByBarcode(userBarcode.trim());
    if (!patron) {
      res.status(404).json({ message: "User barcode not recognised" });
      return;
    }

    const result = await service.borrowBook(
      patron.id,
      copyBarcode.trim(),
      authUser(req).id,
      { isCopyBarcode: true, ipAddress: req.ip, reservationId: parsedReservationId, auditRoute: "/api/borrowing/scan/borrow" },
    );
    res.locals.auditEnqueued = true;

    res.status(201).json({
      message: "Book borrowed successfully",
      patron: { id: patron.id, name: patron.name },
      ...result,
    });
  } catch (error: unknown) {
    logError("[borrowing] scanBorrow:", error);
    const caught = requestError(error);
    res.status(caught.status ?? 500).json({ message: caught.message ?? "Failed to borrow book" });
  }
};

/**
 * POST /borrowings/scan/return
 * Body: { copyBarcode }
 * Finds the active borrowing for this copy and marks it returned.
 */
const scanReturn: RequestHandler = async (req, res) => {
  try {
    const { copyBarcode } = req.body;
    if (!copyBarcode?.trim()) {
      res.status(400).json({ message: "copyBarcode is required" });
      return;
    }

    const row = await service.getActiveBorrowingByCopyBarcode(copyBarcode.trim());
    if (!row) {
      res.status(404).json({ message: "No active borrowing found for this copy" });
      return;
    }

    const result = await service.returnBook(row.id, row.user_id, { auditRoute: "/api/borrowing/scan/return", actorId: authUser(req).id });
    res.locals.auditEnqueued = true;
    res.json({ message: "Book returned successfully", borrowingId: row.id, returnedAt: result.returnedAt });
  } catch (error: unknown) {
    logError("[borrowing] scanReturn:", error);
    const caught = requestError(error);
    res.status(caught.status ?? 500).json({ message: caught.message ?? "Failed to return book" });
  }
};

/**
 * GET /borrowings/scan/return-preview/:identifier
 * Resolves an accession number or copy QR code to its active loan and patron.
 */
const getReturnPreview: RequestHandler = async (req, res) => {
  try {
    const identifier = (req.params.identifier as string | undefined)?.trim();
    if (!identifier) {
      res.status(400).json({ message: "An accession number or copy QR code is required" });
      return;
    }

    const row = await service.getReturnPreviewByIdentifier(identifier);
    if (!row) {
      res.status(404).json({ message: "No active loan found for this accession number or copy QR code" });
      return;
    }
    res.json(row);
  } catch (error: unknown) {
    logError("[borrowing] getReturnPreview:", error);
    res.status(500).json({ message: "Failed to look up the active loan" });
  }
};

/**
 * GET /borrowings/scan/copy/:barcode
 * Preview copy + book info before confirming a borrow.
 */
const getCopyByBarcode: RequestHandler = async (req, res) => {
  try {
    const copy = await service.resolveCopyByBarcode(routeText(req.params.barcode));
    if (!copy) {
      res.status(404).json({ message: "Copy not found" });
      return;
    }
    res.json(copy);
  } catch (error: unknown) {
    logError("[borrowing] getCopyByBarcode:", error);
    res.status(500).json({ message: "Failed to resolve barcode" });
  }
};

const lookupUser: RequestHandler = async (req, res) => {
  try {
    const studentEmployeeId = req.query.student_employee_id as string | undefined;
    if (!studentEmployeeId?.trim()) {
      res.status(400).json({ message: "student_employee_id is required" });
      return;
    }
    const result = await service.lookupUserWithBorrows(studentEmployeeId.trim());
    if (!result) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(result);
  } catch (error: unknown) {
    logError("[borrowing] lookupUser:", error);
    res.status(500).json({ message: "Failed to look up user" });
  }
};

const adminGetBorrowings: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(1, parseInteger(req.query.page) || 1);
    const limit = Math.min(50, parseInteger(req.query.limit) || 20);
    const search = req.query.search ?? "";
    const status = req.query.status ?? "all";
    const showArchived = req.query.archived === "true";
    const dateFrom = req.query.dateFrom ?? "";
    const dateTo = req.query.dateTo ?? "";

    const result = await service.adminGetBorrowings({ search, status, showArchived, page, limit, dateFrom, dateTo });
    res.json(result);
  } catch (error: unknown) {
    logError("[borrowing] adminGetBorrowings:", error);
    res.status(500).json({ message: "Failed to fetch borrowings" });
  }
};

const adminDeleteBorrowing: RequestHandler = async (req, res) => {
  try {
    const borrowingId = parseInteger(req.params.borrowingId);
    if (Number.isNaN(borrowingId) || borrowingId < 1) {
      res.status(400).json({ message: "Invalid borrowing ID" });
      return;
    }
    await service.adminDeleteBorrowing(borrowingId, authUser(req).id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Borrowing record archived successfully" });
  } catch (error: unknown) {
    logError("[borrowing] adminDeleteBorrowing:", error);
    const caught = requestError(error);
    res.status(caught.status ?? 500).json({
      message: caught.message ?? "Failed to archive borrowing",
      ...(caught.outstandingAmount !== undefined ? { outstandingAmount: caught.outstandingAmount, affectedLoans: caught.affectedLoans } : {}),
    });
  }
};

const adminRestoreBorrowing: RequestHandler = async (req, res) => {
  try {
    const borrowingId = parseInteger(req.params.borrowingId);
    if (Number.isNaN(borrowingId) || borrowingId < 1) {
      res.status(400).json({ message: "Invalid borrowing ID" });
      return;
    }
    await service.adminRestoreBorrowing(borrowingId, authUser(req).id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Borrowing record restored successfully" });
  } catch (error: unknown) {
    logError("[borrowing] adminRestoreBorrowing:", error);
    const caught = requestError(error);
    res.status(caught.status ?? 500).json({ message: caught.message ?? "Failed to restore borrowing" });
  }
};

const getAdminPaymentOverview: RequestHandler = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInteger(req.query.limit) || 20));
    const page = req.query.page === undefined ? null : Math.max(1, parseInteger(req.query.page) || 1);
    const result = await service.getAdminPaymentOverview({ page, limit });
    res.json(result);
  } catch (error: unknown) {
    logError("[borrowing] getAdminPaymentOverview:", error);
    const caught = requestError(error);
    res.status(caught.status ?? 500).json({ message: caught.message ?? "Failed to fetch payment overview" });
  }
};

const getUserPaymentOverview: RequestHandler = async (req, res) => {
  try {
    const studentEmployeeId = String(req.query.student_employee_id ?? "").trim();
    if (!studentEmployeeId) {
      res.status(400).json({ message: "student_employee_id is required" });
      return;
    }

    const result = await service.getUserPaymentOverview(studentEmployeeId);
    res.json(result);
  } catch (error: unknown) {
    logError("[borrowing] getUserPaymentOverview:", error);
    const caught = requestError(error);
    res.status(caught.status ?? 500).json({ message: caught.message ?? "Failed to fetch user payment overview" });
  }
};

const settleUserPayments: RequestHandler = async (_req, res) => {
  res.status(410).json({
    message: "Payments are recorded through Clearance as a full cash settlement. Open the Clearance workspace to continue.",
  });
};

export = {
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

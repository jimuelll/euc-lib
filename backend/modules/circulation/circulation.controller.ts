import type { Request, RequestHandler, Response } from "express";
import service = require("./circulation.service");

const { logError } = require("../../logger") as { logError: (...values: unknown[]) => void };

type AuthenticatedRequest = Request & { user: { id: number } };
type RequestError = Error & { status?: number };

const sendError = (res: Response, error: unknown, fallback: string): void => {
  const requestError = error as RequestError;
  res.status(requestError?.status ?? 500).json({ message: requestError?.message ?? fallback });
};

const lookupUser: RequestHandler = async (req, res) => {
  try {
    const studentEmployeeId = req.query.student_employee_id;
    if (typeof studentEmployeeId !== "string" || !studentEmployeeId.trim()) return void res.status(400).json({ message: "student_employee_id is required" });
    res.json(await service.lookupUser(studentEmployeeId));
  } catch (error: unknown) {
    logError("[circulation] lookupUser:", error);
    sendError(res, error, "Failed to look up user");
  }
};

const lookupBook: RequestHandler = async (req, res) => {
  try {
    const isbn = req.query.isbn;
    if (typeof isbn !== "string" || !isbn.trim()) return void res.status(400).json({ message: "ISBN is required" });
    res.json(await service.lookupBook(isbn));
  } catch (error: unknown) {
    logError("[circulation] lookupBook:", error);
    sendError(res, error, "Failed to look up book");
  }
};

const processBorrow: RequestHandler = async (req, res) => {
  try {
    const { userId, bookId } = req.body;
    if (!userId || !bookId) return void res.status(400).json({ message: "userId and bookId are required" });
    const user = req as AuthenticatedRequest;
    const result = await service.processBorrow({ userId, bookId, issuedBy: user.user.id });
    res.locals.auditEnqueued = true;
    res.status(201).json(result);
  } catch (error: unknown) {
    logError("[circulation] processBorrow:", error);
    sendError(res, error, "Failed to process borrow");
  }
};

const processReturn: RequestHandler = async (req, res) => {
  try {
    const { borrowingId } = req.body;
    if (!borrowingId) return void res.status(400).json({ message: "borrowingId is required" });
    const user = req as AuthenticatedRequest;
    await service.processReturn(borrowingId, user.user.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Book returned successfully" });
  } catch (error: unknown) {
    logError("[circulation] processReturn:", error);
    sendError(res, error, "Failed to process return");
  }
};

const processRenew: RequestHandler = async (req, res) => {
  try {
    const { borrowingId } = req.body;
    if (!borrowingId) return void res.status(400).json({ message: "borrowingId is required" });
    const user = req as AuthenticatedRequest;
    const result = await service.processRenew({ borrowingId, renewedBy: user.user.id });
    res.locals.auditEnqueued = true;
    res.json(result);
  } catch (error: unknown) {
    logError("[circulation] processRenew:", error);
    sendError(res, error, "Failed to process renewal");
  }
};

const getCirculationLog: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || ""), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || ""), 10) || 20));
    const result = await service.getCirculationLog({ status: String(req.query.status || ""), search: String(req.query.search || ""), page, limit });
    res.json(result);
  } catch (error: unknown) {
    logError("[circulation] getCirculationLog:", error);
    sendError(res, error, "Failed to fetch circulation log");
  }
};

export = { lookupUser, lookupBook, processBorrow, processReturn, processRenew, getCirculationLog };

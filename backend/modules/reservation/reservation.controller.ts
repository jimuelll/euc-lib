import type { Request, RequestHandler, Response } from "express";
import service = require("./reservation.service");

const { logError } = require("../../logger") as { logError: (...values: unknown[]) => void };

type AuthenticatedRequest = Request & { user: { id: number } };
type RequestError = Error & { status?: number };

const sendError = (res: Response, error: unknown, fallback: string): void => {
  const requestError = error as RequestError;
  res.status(requestError?.status ?? 500).json({ message: requestError?.message ?? fallback });
};

const searchCatalogue: RequestHandler = async (req, res) => {
  try {
    const query = req.query.query;
    if (typeof query !== "string" || !query.trim()) return void res.status(400).json({ message: "Search query is required" });
    const books = await service.searchCatalogue(query.trim(), { page: req.query.page, limit: req.query.limit });
    res.json(books);
  } catch (error: unknown) {
    logError("[reservation] searchCatalogue:", error);
    sendError(res, error, "Failed to search catalogue");
  }
};

const getActiveReservations: RequestHandler = async (req, res) => {
  try {
    const user = req as AuthenticatedRequest;
    res.json(await service.getActiveReservations(user.user.id));
  } catch (error: unknown) {
    logError("[reservation] getActiveReservations:", error);
    res.status(500).json({ message: "Failed to fetch reservations" });
  }
};

const getReservationHistory: RequestHandler = async (req, res) => {
  try {
    const user = req as AuthenticatedRequest;
    res.json(await service.getReservationHistory(user.user.id, { page: req.query.page, limit: req.query.limit }));
  } catch (error: unknown) {
    logError("[reservation] getReservationHistory:", error);
    res.status(500).json({ message: "Failed to fetch reservation history" });
  }
};

const reserveBook: RequestHandler = async (req, res) => {
  try {
    const bookId = Number.parseInt(String(req.params.bookId), 10);
    if (Number.isNaN(bookId) || bookId < 1) return void res.status(400).json({ message: "Invalid book ID" });
    const user = req as AuthenticatedRequest;
    const result = await service.reserveBook(user.user.id, bookId);
    res.locals.auditEnqueued = true;
    res.status(201).json({ message: "Book reserved successfully", ...result });
  } catch (error: unknown) {
    logError("[reservation] reserveBook:", error);
    sendError(res, error, "Failed to reserve book");
  }
};

const cancelReservation: RequestHandler = async (req, res) => {
  try {
    const id = Number.parseInt(String(req.params.reservationId), 10);
    if (Number.isNaN(id) || id < 1) return void res.status(400).json({ message: "Invalid reservation ID" });
    const user = req as AuthenticatedRequest;
    await service.cancelReservation(id, user.user.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Reservation cancelled" });
  } catch (error: unknown) {
    logError("[reservation] cancelReservation:", error);
    sendError(res, error, "Failed to cancel reservation");
  }
};

export = { searchCatalogue, getActiveReservations, getReservationHistory, reserveBook, cancelReservation };

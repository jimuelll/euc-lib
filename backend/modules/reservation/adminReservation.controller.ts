import type { Request, RequestHandler, Response } from "express";
import service = require("./adminReservation.service");

const { logError } = require("../../logger") as { logError: (...values: unknown[]) => void };

type AuthenticatedRequest = Request & { user: { id: number } };
type RequestError = Error & { status?: number };

const sendError = (res: Response, error: unknown, fallback: string): void => {
  const requestError = error as RequestError;
  res.status(requestError?.status ?? 500).json({ message: requestError?.message ?? fallback });
};

const reservationId = (req: Request): number => Number.parseInt(String(req.params.reservationId), 10);

const getAdminReservations: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || ""), 10) || 1);
    const limit = Math.min(50, Number.parseInt(String(req.query.limit || ""), 10) || 15);
    const search = String(req.query.search ?? "");
    const status = String(req.query.status ?? "all");
    const dateFrom = String(req.query.dateFrom ?? "");
    const dateTo = String(req.query.dateTo ?? "");
    const archived = req.query.archived === "true";
    res.json(await service.getAdminReservations({ search, status, dateFrom, dateTo, archived, page, limit }));
  } catch (error: unknown) {
    logError("[admin/reservations] getAdminReservations:", error);
    res.status(500).json({ message: "Failed to fetch reservations" });
  }
};

const markReservationReady: RequestHandler = async (req, res) => {
  try {
    const id = reservationId(req);
    if (Number.isNaN(id) || id < 1) return void res.status(400).json({ message: "Invalid reservation ID" });
    const user = req as AuthenticatedRequest;
    await service.markReservationReady(id, user.user.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Reservation marked as ready" });
  } catch (error: unknown) {
    logError("[admin/reservations] markReservationReady:", error);
    sendError(res, error, "Action failed");
  }
};

const fulfillReservation: RequestHandler = async (_req, res) => {
  res.status(409).json({ message: "Complete checkout in Circulation to fulfill this reservation." });
};

const cancelReservationAdmin: RequestHandler = async (req, res) => {
  try {
    const id = reservationId(req);
    if (Number.isNaN(id) || id < 1) return void res.status(400).json({ message: "Invalid reservation ID" });
    const user = req as AuthenticatedRequest;
    await service.cancelReservationAdmin(id, user.user.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Reservation cancelled" });
  } catch (error: unknown) {
    logError("[admin/reservations] cancelReservationAdmin:", error);
    sendError(res, error, "Action failed");
  }
};

const deleteReservationAdmin: RequestHandler = async (req, res) => {
  try {
    const id = reservationId(req);
    if (Number.isNaN(id) || id < 1) return void res.status(400).json({ message: "Invalid reservation ID" });
    const user = req as AuthenticatedRequest;
    await service.archiveReservation(id, user.user.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Reservation archived successfully" });
  } catch (error: unknown) {
    logError("[admin/reservations] deleteReservationAdmin:", error);
    sendError(res, error, "Action failed");
  }
};

const restoreReservationAdmin: RequestHandler = async (req, res) => {
  try {
    const id = reservationId(req);
    if (Number.isNaN(id) || id < 1) return void res.status(400).json({ message: "Invalid reservation ID" });
    const user = req as AuthenticatedRequest;
    await service.restoreReservation(id, user.user.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Reservation restored successfully" });
  } catch (error: unknown) {
    logError("[admin/reservations] restoreReservationAdmin:", error);
    sendError(res, error, "Action failed");
  }
};

export = { getAdminReservations, markReservationReady, fulfillReservation, cancelReservationAdmin, deleteReservationAdmin, restoreReservationAdmin };

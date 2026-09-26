import type { Request, RequestHandler } from "express";
import service = require("./attendance.service");
import logger = require("../../logger");
import type { AttendanceType } from "./attendance.types";

const { logError } = logger;
type AuthenticatedRequest = Request & { user: { id: number } };
type ControllerError = { status?: number; message?: string; code?: string; user?: unknown; type?: string };

const scan: RequestHandler = async (req, res) => {
  try {
    const { scannedId, type } = req.body;

    if (!scannedId?.trim()) {
      return res.status(400).json({ message: "scannedId is required" });
    }
    if (!["check_in", "check_out"].includes(type)) {
      return res.status(400).json({ message: "type must be 'check_in' or 'check_out'" });
    }

    const result = await service.recordScan({
      scannedId: scannedId.trim(),
      type: type as AttendanceType,
      scannedBy: (req as AuthenticatedRequest).user.id,
      ipAddress: req.ip,
    });

    res.status(201).json(result);
  } catch (err) {
    logError("[attendance] scan:", err);
    const error = err as ControllerError;
    res.status(error.status ?? 500).json({
      message: error.message ?? "Failed to record attendance",
      code: error.code,
      user: error.user,
      type: error.type,
    });
  }
};

const getToday: RequestHandler = async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const lastId = req.query.lastId ? Number(req.query.lastId) : null;
    const rows = await service.getTodayLogs({ limit, lastId });
    res.json(rows);
  } catch (err) {
    logError("[attendance] getToday:", err);
    res.status(500).json({ message: "Failed to fetch today's logs" });
  }
};

const getLogs: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const filters = {
      page,
      limit,
      search: String(req.query.search ?? ""),
      type: String(req.query.type ?? "all"),
      purpose: String(req.query.purpose ?? "all"),
      dateFrom: String(req.query.dateFrom ?? ""),
      dateTo: String(req.query.dateTo ?? ""),
    };

    const result = await service.getLogs(filters);
    if (filters.dateFrom && filters.dateFrom === filters.dateTo
      && (!filters.purpose || filters.purpose === "all" || filters.purpose === "entry_exit")) {
      result.sessions = await service.getSessionsForDate(filters.dateFrom);
    }
    res.json(result);
  } catch (err) {
    logError("[attendance] getLogs:", err);
    res.status(500).json({ message: "Failed to fetch attendance logs" });
  }
};

const getMy: RequestHandler = async (req, res) => {
  try {
    const rows = await service.getMyLogs((req as AuthenticatedRequest).user.id, {
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json(rows);
  } catch (err) {
    logError("[attendance] getMy:", err);
    res.status(500).json({ message: "Failed to fetch your logs" });
  }
};

export = { scan, getToday, getLogs, getMy };

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

const visits:RequestHandler=async(req,res)=>{try{const dateFrom=String(req.query.dateFrom??"");const dateTo=String(req.query.dateTo??"");if([dateFrom,dateTo].some(value=>value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))||dateFrom&&dateTo&&dateFrom>dateTo)return res.status(400).json({message:"Choose a valid date range"});res.json(await service.getVisits({page:Math.max(1,Math.floor(Number(req.query.page)||1)),limit:Math.min(100,Math.max(1,Math.floor(Number(req.query.limit)||25))),search:String(req.query.search??""),type:["inside","arrivals","departures"].includes(String(req.query.type))?String(req.query.type):"all",purpose:["entry_exit","borrowing"].includes(String(req.query.purpose))?String(req.query.purpose):"all",dateFrom,dateTo}));}catch(err){logError("[attendance] visits:",err);res.status(500).json({message:"Could not load visits"});}};
const timeOutAll:RequestHandler=async(req,res)=>{const date=new Date(req.body.cutoff);if(!Number.isFinite(date.getTime())||date.getTime()>Date.now()+60000)return res.status(400).json({message:"Invalid confirmation time"});try{const result=await service.timeOutAll(date.toISOString(),(req as AuthenticatedRequest).user.id,req.ip);res.locals.auditDetails={affectedCount:result.completed};res.json(result);}catch(err){logError("[attendance] timeOutAll:",err);res.status(500).json({message:"Could not time out visitors"});}};

export = {visits,timeOutAll, scan, getToday, getLogs, getMy };

import type { Request, RequestHandler } from "express";
import service = require("./my-library.service");
import logger = require("../../logger");

const { logError } = logger;
type AuthenticatedRequest = Request & { user: { id: number } };
const qr = require("qrcode");

const getBarcodePng: RequestHandler = async (req, res) => {
  try {
    const barcode = await service.getUserBarcode((req as AuthenticatedRequest).user.id);
    if (!barcode) return res.status(404).json({ message: "Library QR code not found" });

    const png = await qr.toBuffer(barcode, {
      type: "png",
      width: 300,
      margin: 2,
      errorCorrectionLevel: "M",
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(png);
  } catch (err) {
    logError("[my-library] getBarcodePng:", err);
    res.status(500).json({ message: "Failed to generate your library QR code" });
  }
};

const getDashboard: RequestHandler = async (req, res) => {
  try {
    res.json(await service.getDashboard((req as AuthenticatedRequest).user.id));
  } catch (err) {
    logError("[my-library] getDashboard:", err);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
};

const getHistory: RequestHandler = async (req, res) => {
  try {
    res.json(await service.getHistory((req as AuthenticatedRequest).user.id, {
      page: req.query.page,
      limit: req.query.limit,
    }));
  } catch (err) {
    logError("[my-library] getHistory:", err);
    res.status(500).json({ message: "Failed to fetch library history" });
  }
};

const getAttendanceHistory: RequestHandler = async (req, res) => {
  try {
    res.json(await service.getAttendanceHistory((req as AuthenticatedRequest).user.id, {
      page: req.query.page,
      limit: req.query.limit,
    }));
  } catch (err) {
    logError("[my-library] getAttendanceHistory:", err);
    res.status(500).json({ message: "Failed to fetch attendance history" });
  }
};

export = { getBarcodePng, getDashboard, getHistory, getAttendanceHistory };

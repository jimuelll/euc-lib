import type { Request, RequestHandler } from "express";
import service = require("./my-library.service");
import logger = require("../../logger");

const { logError } = logger;
type AuthenticatedRequest = Request & { user: { id: number } };
import { renderQrPng } from "../shared/qr-code";

const getBarcodePng: RequestHandler = async (req, res) => {
  try {
    const barcode = await service.getUserBarcode((req as AuthenticatedRequest).user.id);
    if (!barcode) return res.status(404).json({ message: "Library QR code not found" });

    const png = await renderQrPng(barcode);

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

const service = require("./my-library.service");
const { logError } = require("../../logger");
const qr = require("qrcode");

const getBarcodePng = async (req, res) => {
  try {
    const barcode = await service.getUserBarcode(req.user.id);
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

const getDashboard = async (req, res) => {
  try {
    const dashboard = await service.getDashboard(req.user.id);
    res.json(dashboard);
  } catch (err) {
    logError("[my-library] getDashboard:", err);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
};

const getHistory = async (req, res) => {
  try {
    res.json(await service.getHistory(req.user.id, { page: req.query.page, limit: req.query.limit }));
  } catch (err) {
    logError("[my-library] getHistory:", err);
    res.status(500).json({ message: "Failed to fetch library history" });
  }
};

const getAttendanceHistory = async (req, res) => {
  try {
    res.json(await service.getAttendanceHistory(req.user.id, { page: req.query.page, limit: req.query.limit }));
  } catch (err) {
    logError("[my-library] getAttendanceHistory:", err);
    res.status(500).json({ message: "Failed to fetch attendance history" });
  }
};

module.exports = {
  getBarcodePng,
  getDashboard,
  getHistory,
  getAttendanceHistory,
};

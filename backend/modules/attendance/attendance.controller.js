const service = require("./attendance.service");

const scan = async (req, res) => {
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
      type,
      scannedBy: req.user.id,
      ipAddress: req.ip,
    });

    res.status(201).json(result);
  } catch (err) {
    console.error("[attendance] scan:", err);
    res.status(err.status ?? 500).json({
      message: err.message ?? "Failed to record attendance",
      code: err.code,
      user: err.user,
      type: err.type,
    });
  }
};

const getToday = async (req, res) => {
  try {
    // FIX: Accept optional pagination params from query string.
    // e.g. GET /api/attendance/today?limit=50&lastId=1234
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const lastId = req.query.lastId ? Number(req.query.lastId) : null;

    const rows = await service.getTodayLogs({ limit, lastId });
    res.json(rows);
  } catch (err) {
    console.error("[attendance] getToday:", err);
    res.status(500).json({ message: "Failed to fetch today's logs" });
  }
};

const getLogs = async (req, res) => {
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
    res.json(result);
  } catch (err) {
    console.error("[attendance] getLogs:", err);
    res.status(500).json({ message: "Failed to fetch attendance logs" });
  }
};

const getMy = async (req, res) => {
  try {
    const rows = await service.getMyLogs(req.user.id);
    res.json(rows);
  } catch (err) {
    console.error("[attendance] getMy:", err);
    res.status(500).json({ message: "Failed to fetch your logs" });
  }
};

module.exports = { scan, getToday, getLogs, getMy };

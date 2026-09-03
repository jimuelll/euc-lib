const service = require("./myLibrary.service");

const getDashboard = async (req, res) => {
  try {
    const dashboard = await service.getDashboard(req.user.id);
    res.json(dashboard);
  } catch (err) {
    console.error("[my-library] getDashboard:", err);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
};

const getHistory = async (req, res) => {
  try {
    res.json(await service.getHistory(req.user.id, { page: req.query.page, limit: req.query.limit }));
  } catch (err) {
    console.error("[my-library] getHistory:", err);
    res.status(500).json({ message: "Failed to fetch library history" });
  }
};

const getAttendanceHistory = async (req, res) => {
  try {
    res.json(await service.getAttendanceHistory(req.user.id, { page: req.query.page, limit: req.query.limit }));
  } catch (err) {
    console.error("[my-library] getAttendanceHistory:", err);
    res.status(500).json({ message: "Failed to fetch attendance history" });
  }
};

module.exports = {
  getDashboard,
  getHistory,
  getAttendanceHistory,
};

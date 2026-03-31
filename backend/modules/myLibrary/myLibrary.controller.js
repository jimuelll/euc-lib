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

module.exports = {
  getDashboard,
};

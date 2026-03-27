const service = require("./about.service");

// ── GET /api/about ────────────────────────────────────────────────────────────
const getAbout = async (req, res) => {
  try {
    const data = await service.getAboutSettings();
    if (!data) {
      return res.status(404).json({ message: "About settings not found" });
    }
    res.json(data);
  } catch (err) {
    console.error("[about] getAbout:", err);
    res.status(500).json({ message: "Failed to fetch about settings" });
  }
};

// ── PUT /api/admin/about ──────────────────────────────────────────────────────
const updateAbout = async (req, res) => {
  try {
    const {
      library_name,
      established,
      mission_title,
      mission_text,
      history_title,
      history_text,
      policies,
      facilities,
      staff,
      spaces,
    } = req.body;

    if (!library_name?.trim()) {
      return res.status(400).json({ message: "library_name is required" });
    }
    if (!mission_title?.trim()) {
      return res.status(400).json({ message: "mission_title is required" });
    }
    if (!history_title?.trim()) {
      return res.status(400).json({ message: "history_title is required" });
    }

    if (established !== null && established !== undefined) {
      const year = Number(established);
      const currentYear = new Date().getFullYear();
      if (!Number.isInteger(year) || year < 1800 || year > currentYear) {
        return res
          .status(400)
          .json({ message: `established must be a year between 1800 and ${currentYear}` });
      }
    }

    for (const [key, val] of Object.entries({ policies, facilities, staff, spaces })) {
      if (val !== undefined && !Array.isArray(val)) {
        return res.status(400).json({ message: `"${key}" must be an array` });
      }
    }

    const updated = await service.updateAboutSettings(req.body, req.user.id);
    res.json({ message: "About page updated successfully", data: updated });
  } catch (err) {
    console.error("[about] updateAbout:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to update about settings" });
  }
};

module.exports = {
  getAbout,
  updateAbout,
};
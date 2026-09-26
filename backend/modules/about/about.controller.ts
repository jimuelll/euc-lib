import type { Request, RequestHandler } from "express";
import service = require("./about.service");
import logger = require("../../logger");

const { logError } = logger;

type AuthenticatedRequest = Request & { user: { id: number } };

// GET /api/about
const getAbout: RequestHandler = async (_req, res) => {
  try {
    const data = await service.getAboutSettings();
    if (!data) {
      res.status(404).json({ message: "About settings not found" });
      return;
    }
    res.json(data);
  } catch (err) {
    logError("[about] getAbout:", err);
    res.status(500).json({ message: "Failed to fetch about settings" });
  }
};

// PUT /api/admin/about
const updateAbout: RequestHandler = async (req, res) => {
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

    if (established !== null && established !== undefined) {
      const year = Number(established);
      const currentYear = new Date().getFullYear();
      if (!Number.isInteger(year) || year < 1800 || year > currentYear) {
        res
          .status(400)
          .json({ message: `established must be a year between 1800 and ${currentYear}` });
        return;
      }
    }

    for (const [key, val] of Object.entries({ policies, facilities, staff, spaces })) {
      if (val !== undefined && !Array.isArray(val)) {
        res.status(400).json({ message: `"${key}" must be an array` });
        return;
      }
    }

    const updated = await service.updateAboutSettings(
      {
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
      },
      (req as AuthenticatedRequest).user.id,
    );
    res.json({ message: "About page updated successfully", data: updated });
  } catch (err) {
    logError("[about] updateAbout:", err);
    const error = err as { status?: number; message?: string };
    res.status(error.status ?? 500).json({
      message: error.message ?? "Failed to update about settings",
    });
  }
};

export = {
  getAbout,
  updateAbout,
};

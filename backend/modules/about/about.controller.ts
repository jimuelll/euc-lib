import type { RequestHandler } from "express";
import service = require("./about.service");
import logger = require("../../logger");

const { logError } = logger;


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

export = {
  getAbout,
};

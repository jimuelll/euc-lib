import type { RequestHandler } from "express";
import service = require("./site-content.service");

type ServiceError = { status?: number; message?: string };

const getSiteContent: RequestHandler = async (_req, res) => {
  try {
    res.json(await service.get());
  } catch (err) {
    const error = err as ServiceError;
    res.status(error.status || 500).json({ message: error.message || "Failed to load site content" });
  }
};

export = { getSiteContent };

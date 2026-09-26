import type { Request, RequestHandler } from "express";
import service = require("./site-content.service");

type AuthenticatedRequest = Request & { user?: { id: number } };
type ServiceError = { status?: number; message?: string };

const getSiteContent: RequestHandler = async (_req, res) => {
  try {
    res.json(await service.get());
  } catch (err) {
    const error = err as ServiceError;
    res.status(error.status || 500).json({ message: error.message || "Failed to load site content" });
  }
};

const updateSiteContent: RequestHandler = async (req, res) => {
  try {
    res.json(await service.update(req.body, (req as AuthenticatedRequest).user?.id));
  } catch (err) {
    const error = err as ServiceError;
    res.status(error.status || 500).json({ message: error.message || "Failed to save site content" });
  }
};

export = { getSiteContent, updateSiteContent };

import type { Request, RequestHandler, Response } from "express";
import service = require("./circulation.service");

const { logError } = require("../../logger") as { logError: (...values: unknown[]) => void };

type AuthenticatedRequest = Request & { user: { id: number } };
type RequestError = Error & { status?: number };

const sendError = (res: Response, error: unknown, fallback: string): void => {
  const requestError = error as RequestError;
  res.status(requestError?.status ?? 500).json({ message: requestError?.message ?? fallback });
};

const processRenew: RequestHandler = async (req, res) => {
  try {
    const { borrowingId } = req.body;
    if (!borrowingId) return void res.status(400).json({ message: "borrowingId is required" });
    const user = req as AuthenticatedRequest;
    const result = await service.processRenew({ borrowingId, renewedBy: user.user.id });
    res.locals.auditEnqueued = true;
    res.json(result);
  } catch (error: unknown) {
    logError("[circulation] processRenew:", error);
    sendError(res, error, "Failed to process renewal");
  }
};

export = { processRenew };

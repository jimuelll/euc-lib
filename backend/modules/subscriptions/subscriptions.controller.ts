import type { RequestHandler } from "express";
import subscriptionService = require("./subscriptions.service");
import logger = require("../../logger");

const { logError } = logger;

/** GET /api/subscriptions — active only */
const getPublicSubscriptions: RequestHandler = async (_req, res) => {
  try {
    const data = await subscriptionService.getActiveSubscriptions();
    return res.json({ success: true, data });
  } catch (err) {
    logError("[subscriptions] getPublicSubscriptions:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch subscriptions" });
  }
};

export = { getPublicSubscriptions };

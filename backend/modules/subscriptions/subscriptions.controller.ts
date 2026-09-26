import type { Request, RequestHandler } from "express";
import subscriptionService = require("./subscriptions.service");
import logger = require("../../logger");

const { logError } = logger;
type AuthenticatedRequest = Request & { user?: { id: number } };

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

/** GET /api/admin/subscriptions */
const getAllSubscriptions: RequestHandler = async (req, res) => {
  try {
    const data = await subscriptionService.getAllSubscriptions(false, {
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json({ success: true, data });
  } catch (err) {
    logError("[subscriptions] getAllSubscriptions:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch subscriptions" });
  }
};

/** GET /api/admin/subscriptions/:id */
const getSubscriptionById: RequestHandler = async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });

  try {
    const sub = await subscriptionService.getSubscriptionById(id);
    if (!sub) return res.status(404).json({ success: false, message: "Subscription not found" });
    return res.json({ success: true, data: sub });
  } catch (err) {
    logError("[subscriptions] getSubscriptionById:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch subscription" });
  }
};

/** POST /api/admin/subscriptions */
const createSubscription: RequestHandler = async (req, res) => {
  const { title, url, description, category, is_active, sort_order, image_url, image_public_id } = req.body;

  if (!title?.trim()) return res.status(400).json({ success: false, message: "title is required" });
  if (!url?.trim()) return res.status(400).json({ success: false, message: "url is required" });

  try {
    const sub = await subscriptionService.createSubscription({
      title: title.trim(),
      url: url.trim(),
      description: description?.trim() ?? null,
      category: category?.trim() ?? null,
      image_url: image_url?.trim() ?? null,
      image_public_id: image_public_id?.trim() ?? null,
      is_active: is_active !== false && is_active !== "false",
      sort_order: Number(sort_order) || 0,
      created_by: (req as AuthenticatedRequest).user?.id ?? null,
    });

    return res.status(201).json({ success: true, data: sub });
  } catch (err) {
    logError("[subscriptions] createSubscription:", err);
    return res.status(500).json({ success: false, message: "Failed to create subscription" });
  }
};

/** PATCH /api/admin/subscriptions/:id */
const updateSubscription: RequestHandler = async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });

  try {
    const existing = await subscriptionService.getSubscriptionById(id);
    if (!existing) return res.status(404).json({ success: false, message: "Subscription not found" });

    const {
      title, url, description, category,
      is_active, sort_order,
      remove_image, image_url, image_public_id,
    } = req.body;

    let finalImageUrl: string | null | undefined;
    let finalPublicId: string | null | undefined;

    if (remove_image === true || remove_image === "true") {
      await subscriptionService.deleteFromCloudinary(existing.image_public_id);
      finalImageUrl = null;
      finalPublicId = null;
    } else if (image_url !== undefined) {
      if (image_public_id && existing.image_public_id && image_public_id !== existing.image_public_id) {
        await subscriptionService.deleteFromCloudinary(existing.image_public_id);
      }
      finalImageUrl = image_url || null;
      finalPublicId = image_public_id || null;
    }

    const sub = await subscriptionService.updateSubscription(id, {
      ...(title !== undefined && { title: String(title).trim() }),
      ...(url !== undefined && { url: String(url).trim() }),
      ...(description !== undefined && { description: String(description).trim() }),
      ...(category !== undefined && { category: String(category).trim() }),
      ...(finalImageUrl !== undefined && { image_url: finalImageUrl }),
      ...(finalPublicId !== undefined && { image_public_id: finalPublicId }),
      ...(is_active !== undefined && { is_active: is_active === true || is_active === "true" }),
      ...(sort_order !== undefined && { sort_order: Number(sort_order) }),
      updated_by: (req as AuthenticatedRequest).user?.id ?? undefined,
    });

    return res.json({ success: true, data: sub });
  } catch (err) {
    logError("[subscriptions] updateSubscription:", err);
    return res.status(500).json({ success: false, message: "Failed to update subscription" });
  }
};

/** DELETE /api/admin/subscriptions/:id */
const deleteSubscription: RequestHandler = async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });

  try {
    const sub = await subscriptionService.getSubscriptionById(id);
    if (!sub) return res.status(404).json({ success: false, message: "Subscription not found" });

    await subscriptionService.deleteSubscription(id);
    return res.json({ success: true, message: "Subscription deleted" });
  } catch (err) {
    logError("[subscriptions] deleteSubscription:", err);
    return res.status(500).json({ success: false, message: "Failed to delete subscription" });
  }
};

/** PATCH /api/admin/subscriptions/reorder  body: { ids: number[] } */
const reorderSubscriptions: RequestHandler = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "number")) {
    return res.status(400).json({ success: false, message: "ids must be an array of numbers" });
  }

  try {
    await subscriptionService.reorderSubscriptions(ids, (req as AuthenticatedRequest).user?.id ?? undefined);
    return res.json({ success: true, message: "Order updated" });
  } catch (err) {
    logError("[subscriptions] reorderSubscriptions:", err);
    return res.status(500).json({ success: false, message: "Failed to reorder" });
  }
};

export = {
  getPublicSubscriptions,
  getAllSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  reorderSubscriptions,
};

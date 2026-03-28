// subscriptions/subscriptions.controller.js
const SubscriptionService = require("./subscriptions.service");

// ─── Public ───────────────────────────────────────────────────────────────────

/** GET /api/subscriptions — active only */
const getPublicSubscriptions = async (_req, res) => {
  try {
    const data = await SubscriptionService.getActiveSubscriptions();
    return res.json({ success: true, data });
  } catch (err) {
    console.error("[subscriptions] getPublicSubscriptions:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch subscriptions" });
  }
};

// ─── Admin ────────────────────────────────────────────────────────────────────

/** GET /api/admin/subscriptions */
const getAllSubscriptions = async (_req, res) => {
  try {
    const data = await SubscriptionService.getAllSubscriptions();
    return res.json({ success: true, data });
  } catch (err) {
    console.error("[subscriptions] getAllSubscriptions:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch subscriptions" });
  }
};

/** GET /api/admin/subscriptions/:id */
const getSubscriptionById = async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });

  try {
    const sub = await SubscriptionService.getSubscriptionById(id);
    if (!sub) return res.status(404).json({ success: false, message: "Subscription not found" });
    return res.json({ success: true, data: sub });
  } catch (err) {
    console.error("[subscriptions] getSubscriptionById:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch subscription" });
  }
};

/**
 * POST /api/admin/subscriptions
 * Expects image_url + image_public_id already uploaded to Cloudinary on the frontend.
 */
const createSubscription = async (req, res) => {
  const { title, url, description, category, is_active, sort_order, image_url, image_public_id } = req.body;

  if (!title?.trim()) return res.status(400).json({ success: false, message: "title is required" });
  if (!url?.trim())   return res.status(400).json({ success: false, message: "url is required" });

  try {
    const sub = await SubscriptionService.createSubscription({
      title:           title.trim(),
      url:             url.trim(),
      description:     description?.trim()      ?? null,
      category:        category?.trim()          ?? null,
      image_url:       image_url?.trim()         ?? null,
      image_public_id: image_public_id?.trim()   ?? null,
      is_active:       is_active !== false && is_active !== "false",
      sort_order:      Number(sort_order) || 0,
      created_by:      req.user?.id ?? null,
    });

    return res.status(201).json({ success: true, data: sub });
  } catch (err) {
    console.error("[subscriptions] createSubscription:", err);
    return res.status(500).json({ success: false, message: "Failed to create subscription" });
  }
};

/**
 * PATCH /api/admin/subscriptions/:id
 * Passing `remove_image: true` clears the existing Cloudinary image.
 * Passing a new image_url + image_public_id replaces it (old one is cleaned up).
 */
const updateSubscription = async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });

  try {
    const existing = await SubscriptionService.getSubscriptionById(id);
    if (!existing)  return res.status(404).json({ success: false, message: "Subscription not found" });

    const {
      title, url, description, category,
      is_active, sort_order,
      remove_image, image_url, image_public_id,
    } = req.body;

    let finalImageUrl = undefined; // undefined = don't touch the DB column
    let finalPublicId = undefined;

    if (remove_image === true || remove_image === "true") {
      // Wipe the image entirely
      await SubscriptionService.deleteFromCloudinary(existing.image_public_id);
      finalImageUrl = null;
      finalPublicId = null;
    } else if (image_url !== undefined) {
      // Frontend uploaded a new image — clean up the old one if it changed
      if (image_public_id && existing.image_public_id && image_public_id !== existing.image_public_id) {
        await SubscriptionService.deleteFromCloudinary(existing.image_public_id);
      }
      finalImageUrl = image_url || null;
      finalPublicId = image_public_id || null;
    }

    const sub = await SubscriptionService.updateSubscription(id, {
      ...(title       !== undefined && { title:       String(title).trim() }),
      ...(url         !== undefined && { url:         String(url).trim() }),
      ...(description !== undefined && { description: String(description).trim() }),
      ...(category    !== undefined && { category:    String(category).trim() }),
      ...(finalImageUrl !== undefined && { image_url:       finalImageUrl }),
      ...(finalPublicId !== undefined && { image_public_id: finalPublicId }),
      ...(is_active   !== undefined && { is_active:   is_active === true || is_active === "true" }),
      ...(sort_order  !== undefined && { sort_order:  Number(sort_order) }),
      updated_by: req.user?.id ?? undefined,
    });

    return res.json({ success: true, data: sub });
  } catch (err) {
    console.error("[subscriptions] updateSubscription:", err);
    return res.status(500).json({ success: false, message: "Failed to update subscription" });
  }
};

/** DELETE /api/admin/subscriptions/:id */
const deleteSubscription = async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });

  try {
    const sub = await SubscriptionService.getSubscriptionById(id);
    if (!sub) return res.status(404).json({ success: false, message: "Subscription not found" });

    await SubscriptionService.deleteSubscription(id);
    return res.json({ success: true, message: "Subscription deleted" });
  } catch (err) {
    console.error("[subscriptions] deleteSubscription:", err);
    return res.status(500).json({ success: false, message: "Failed to delete subscription" });
  }
};

/** PATCH /api/admin/subscriptions/reorder  body: { ids: number[] } */
const reorderSubscriptions = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "number"))
    return res.status(400).json({ success: false, message: "ids must be an array of numbers" });

  try {
    await SubscriptionService.reorderSubscriptions(ids, req.user?.id ?? undefined);
    return res.json({ success: true, message: "Order updated" });
  } catch (err) {
    console.error("[subscriptions] reorderSubscriptions:", err);
    return res.status(500).json({ success: false, message: "Failed to reorder" });
  }
};

module.exports = {
  getPublicSubscriptions,
  getAllSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  reorderSubscriptions,
};
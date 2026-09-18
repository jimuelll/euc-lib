const repository = require("./subscriptions.repository");
const { v2: cloudinary } = require("cloudinary");

const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.warn("[subscriptions] Cloudinary delete failed for:", publicId, error);
  }
};

const getAllSubscriptions = (showArchived = false, options = {}) => repository.getAllSubscriptions(showArchived, options);
const getActiveSubscriptions = (options = {}) => repository.getActiveSubscriptions(options);
const getSubscriptionById = (id) => repository.getSubscriptionById(id);

const createSubscription = async (dto) => {
  const id = await repository.createSubscription(dto);
  const subscription = await repository.getSubscriptionById(id);
  if (!subscription) throw new Error("Failed to retrieve newly created subscription");
  return subscription;
};

const updateSubscription = async (id, dto) => {
  await repository.updateSubscription(id, dto);
  const subscription = await repository.getSubscriptionById(id);
  if (!subscription) throw new Error("Subscription not found after update");
  return subscription;
};

const deleteSubscription = async (id) => {
  const subscription = await repository.getSubscriptionById(id);
  await repository.deleteSubscription(id);
  if (subscription?.image_public_id) await deleteFromCloudinary(subscription.image_public_id);
};

const restoreSubscription = async (id) => {
  const subscription = await repository.restoreSubscription(id);
  if (!subscription) throw Object.assign(new Error("Archived subscription not found"), { status: 404 });
  return subscription;
};

const reorderSubscriptions = (orderedIds, updatedBy) => repository.reorderSubscriptions(orderedIds, updatedBy);

module.exports = {
  deleteFromCloudinary,
  getAllSubscriptions,
  getActiveSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  restoreSubscription,
  reorderSubscriptions,
};

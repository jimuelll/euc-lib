import repository = require("./subscriptions.repository");
import type {
  CreateSubscriptionInput,
  PaginationOptions,
  SubscriptionPage,
  SubscriptionRecord,
  UpdateSubscriptionInput,
} from "./subscriptions.types";

const { v2: cloudinary } = require("cloudinary");

const deleteFromCloudinary = async (publicId: string | null | undefined): Promise<void> => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.warn("[subscriptions] Cloudinary delete failed for:", publicId, error);
  }
};

function getAllSubscriptions(): Promise<SubscriptionRecord[]>;
function getAllSubscriptions(showArchived: boolean, options: PaginationOptions): Promise<SubscriptionRecord[] | SubscriptionPage>;
function getAllSubscriptions(
  showArchived = false,
  options: PaginationOptions = {},
): Promise<SubscriptionRecord[] | SubscriptionPage> {
  return repository.getAllSubscriptions(showArchived, options);
}

function getActiveSubscriptions(): Promise<SubscriptionRecord[]>;
function getActiveSubscriptions(options: PaginationOptions): Promise<SubscriptionRecord[] | SubscriptionPage>;
function getActiveSubscriptions(options: PaginationOptions = {}): Promise<SubscriptionRecord[] | SubscriptionPage> {
  return repository.getActiveSubscriptions(options);
}

const getSubscriptionById = (id: number): Promise<SubscriptionRecord | null> =>
  repository.getSubscriptionById(id);

const createSubscription = async (dto: CreateSubscriptionInput): Promise<SubscriptionRecord> => {
  const id = await repository.createSubscription(dto);
  const subscription = await repository.getSubscriptionById(id);
  if (!subscription) throw new Error("Failed to retrieve newly created subscription");
  return subscription;
};

const updateSubscription = async (
  id: number,
  dto: UpdateSubscriptionInput,
): Promise<SubscriptionRecord> => {
  await repository.updateSubscription(id, dto);
  const subscription = await repository.getSubscriptionById(id);
  if (!subscription) throw new Error("Subscription not found after update");
  return subscription;
};

const deleteSubscription = async (id: number): Promise<void> => {
  const subscription = await repository.getSubscriptionById(id);
  await repository.deleteSubscription(id);
  if (subscription?.image_public_id) await deleteFromCloudinary(subscription.image_public_id);
};

const restoreSubscription = async (id: number): Promise<SubscriptionRecord> => {
  const subscription = await repository.restoreSubscription(id);
  if (!subscription) throw Object.assign(new Error("Archived subscription not found"), { status: 404 });
  return subscription;
};

const reorderSubscriptions = (orderedIds: number[], updatedBy?: number | null): Promise<void> =>
  repository.reorderSubscriptions(orderedIds, updatedBy);

export = {
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

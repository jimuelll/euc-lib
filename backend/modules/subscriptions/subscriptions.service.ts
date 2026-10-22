import repository = require("./subscriptions.repository");
import type {
  CreateSubscriptionInput,
  PaginationOptions,
  SubscriptionPage,
  SubscriptionRecord,
  UpdateSubscriptionInput,
} from "./subscriptions.types";

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
  await repository.deleteSubscription(id);
};

const restoreSubscription = async (id: number): Promise<SubscriptionRecord> => {
  const subscription = await repository.restoreSubscription(id);
  if (!subscription) throw Object.assign(new Error("Archived subscription not found"), { status: 404 });
  return subscription;
};

const reorderSubscriptions = (orderedIds: number[], updatedBy?: number | null): Promise<void> =>
  repository.reorderSubscriptions(orderedIds, updatedBy);

export = {
  getAllSubscriptions,
  getActiveSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  restoreSubscription,
  reorderSubscriptions,
};

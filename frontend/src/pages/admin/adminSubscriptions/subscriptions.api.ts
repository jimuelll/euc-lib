import axiosInstance from "@/utils/AxiosInstance";
import type {
  Subscription,
  CreateSubscriptionPayload,
  UpdateSubscriptionPayload,
} from "./subscriptions.types";

// ─── Fetch all ────────────────────────────────────────────────────────────────

export async function fetchSubscriptions(): Promise<Subscription[]> {
  const res = await axiosInstance.get("/api/admin/subscriptions");
  return res.data.data ?? [];
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createSubscription(
  payload: CreateSubscriptionPayload
): Promise<Subscription> {
  try {
    const res = await axiosInstance.post("/api/admin/subscriptions", payload);
    return res.data.data;
  } catch (err: any) {
    throw new Error(
      err.response?.data?.message ?? err.message ?? "Failed to create subscription"
    );
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateSubscription(
  id: number,
  payload: UpdateSubscriptionPayload
): Promise<Subscription> {
  try {
    const res = await axiosInstance.patch(
      `/api/admin/subscriptions/${id}`,
      payload
    );
    return res.data.data;
  } catch (err: any) {
    throw new Error(
      err.response?.data?.message ?? err.message ?? "Failed to update subscription"
    );
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteSubscription(id: number): Promise<void> {
  try {
    await axiosInstance.delete(`/api/admin/subscriptions/${id}`);
  } catch (err: any) {
    throw new Error(
      err.response?.data?.message ?? "Failed to delete subscription"
    );
  }
}
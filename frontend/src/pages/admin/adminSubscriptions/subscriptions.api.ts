import axiosInstance from "@/utils/AxiosInstance";
import type {
  Subscription,
  CreateSubscriptionPayload,
  UpdateSubscriptionPayload,
} from "./subscriptions.types";

// ─── Fetch all ────────────────────────────────────────────────────────────────

export async function fetchSubscriptions(page = 1): Promise<{ rows: Subscription[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const res = await axiosInstance.get("/api/admin/subscriptions", { params: { page, limit: 25 } });
  const data = res.data.data;
  return Array.isArray(data) ? { rows: data, pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 } } : { rows: data.rows ?? [], pagination: data.pagination };
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

import axiosInstance from "@/utils/AxiosInstance";
import type { Subscription } from "./types";

export async function fetchSubscriptions(signal?: AbortSignal): Promise<Subscription[]> {
  const res = await axiosInstance.get("/api/subscriptions", { signal });
  return res.data.data ?? [];
}

import axiosInstance from "@/utils/AxiosInstance";
import type { AnalyticsRange, DashboardResponse } from "./AdminAnalytics";

/** Typed boundary for the admin dashboard contract. */
export async function fetchAdminDashboard(range: AnalyticsRange): Promise<DashboardResponse> {
  return (await axiosInstance.get<DashboardResponse>("/api/admin/dashboard", { params: { range } })).data;
}

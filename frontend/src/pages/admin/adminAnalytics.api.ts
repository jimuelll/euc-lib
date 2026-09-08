import axiosInstance from "@/utils/AxiosInstance";
import type { AnalyticsRange, DashboardResponse } from "./AdminAnalytics";

export interface AiReportEvidence {
  range: { dateFrom: string; dateTo: string; days: number };
  previous_range: { dateFrom: string; dateTo: string; days: number };
  activity: {
    circulation: { borrowed: number; returned: number };
    reservations: { created: number; fulfilled: number; cancelled: number };
    attendance: { entry_exit_scans: number; borrowing_scans: number };
    site_activity: { unique_visitors: number; page_hits: number };
    fine_collections: { settled_amount: number };
    top_borrowed_titles: { title: string; borrowings: number }[];
    top_borrower: { name_token: string; borrowings: number } | null;
    daily_activity: {
      date: string; borrowed: number; returned: number; entry_exit_scans: number; library_entries: number;
      unique_library_visitors: number; borrowing_scans: number; unique_visitors: number; page_hits: number;
    }[];
  };
  previous_activity: {
    circulation: { borrowed: number; returned: number };
    reservations: { created: number; fulfilled: number; cancelled: number };
    attendance: { entry_exit_scans: number; borrowing_scans: number };
    site_activity: { unique_visitors: number; page_hits: number };
    fine_collections: { settled_amount: number };
  };
  current_watch_items: { overdue_borrowings: number; ready_reservations: number; outstanding_fines: number };
}

export interface AiAnalyticsReportResponse {
  report: string;
  mode: "answer" | "summary";
  range: AiReportEvidence["range"];
  evidence: AiReportEvidence;
}

/** Typed boundary for the admin dashboard contract. */
export async function fetchAdminDashboard(range: AnalyticsRange): Promise<DashboardResponse> {
  return (await axiosInstance.get<DashboardResponse>("/api/admin/dashboard", { params: { range } })).data;
}

export async function createAiAnalyticsReport(input: { dateFrom: string; dateTo: string; question?: string }): Promise<AiAnalyticsReportResponse> {
  return (await axiosInstance.post<AiAnalyticsReportResponse>("/api/admin/dashboard/ai-report", input)).data;
}

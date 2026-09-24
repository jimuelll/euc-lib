import axiosInstance from "@/utils/AxiosInstance";
import type { AnalyticsRange, DashboardResponse } from "../admin/pages/AdminAnalytics";

export interface AiReportEvidence {
  range: { dateFrom: string; dateTo: string; days: number; allTime?: boolean };
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

export interface AuditItem {
  occurred_at: string;
  category: string;
  action: string;
  actor_name: string | null;
  actor_role: string | null;
  description: string;
  copy_display_description?: string;
  metadata: unknown;
  restore_status: "retained" | "reversed";
  reversed_at: string | null;
}

export interface AuditResponse {
  rows: AuditItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: { category: string; action: string; query?: string; dateFrom: string; dateTo: string };
}

export interface AuditMetaResponse {
  categories: string[];
  actions: string[];
  actionsByCategory: Record<string, string[]>;
}

/** Typed boundary for the admin dashboard contract. */
export async function fetchAdminDashboard(range: AnalyticsRange): Promise<DashboardResponse> {
  return (await axiosInstance.get<DashboardResponse>("/api/admin/dashboard", { params: { range } })).data;
}

export async function createAiAnalyticsReport(input: { dateFrom?: string; dateTo?: string; allTime?: boolean; question?: string }): Promise<AiAnalyticsReportResponse> {
  return (await axiosInstance.post<AiAnalyticsReportResponse>("/api/admin/dashboard/ai-report", input)).data;
}

export async function fetchAuditLogs(params: { page: number; limit: number; category?: string; action?: string; query?: string; dateFrom?: string; dateTo?: string }): Promise<AuditResponse> {
  return (await axiosInstance.get<AuditResponse>("/api/admin/dashboard/audit", { params })).data;
}

export async function fetchAuditMeta(): Promise<AuditMetaResponse> {
  return (await axiosInstance.get<AuditMetaResponse>("/api/admin/dashboard/audit/meta")).data;
}

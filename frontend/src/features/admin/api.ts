import axiosInstance from "@/utils/AxiosInstance";
import type { User } from "./manage/AdminManage.types";

export interface DashboardStats {
  total_books: number; available_book_copies: number; borrowed_book_copies: number; active_users: number;
  overdue_borrowings: number; borrowings_today: number; returns_today: number; ready_reservations: number;
  reservations_today: number; attendance_today: number; damaged_book_copies: number; lost_book_copies: number;
  active_notifications: number; active_subscriptions: number; upcoming_holidays: number; outstanding_fines: number;
}
export interface RecentActivity { occurred_at: string; activity_type: "borrowed" | "returned" | "reserved"; description: string; }
export interface DashboardResponse { stats: DashboardStats; recentActivity: RecentActivity[]; }
export interface QueryResults {
  users: Array<{ id: number; student_employee_id: string; name: string; role: string; is_active: number }>;
  books: Array<{ id: number; title: string; author: string | null; isbn: string | null; category: string | null; copies: number; location: string | null }>;
  borrowings: Array<{ id: number; status: string; borrowed_at: string; due_date: string; returned_at: string | null; user_name: string; student_employee_id: string; book_title: string; copy_barcode: string | null }>;
  reservations: Array<{ id: number; status: string; reserved_at: string; expires_at: string | null; user_name: string; student_employee_id: string; book_title: string }>;
  notifications: Array<{ id: number; type: string; title: string; created_at: string; audience_type: string; audience_role: string | null }>;
}

export const fetchAdminDashboard = async (): Promise<DashboardResponse> => (await axiosInstance.get<DashboardResponse>("/api/admin/dashboard")).data;
export const searchAdminRecords = async (query: string): Promise<QueryResults> => (await axiosInstance.get<QueryResults>("/api/admin/query-tools", { params: { q: query } })).data;
export const fetchUserBarcode = async (studentId: string): Promise<Blob> => (await axiosInstance.get<Blob>(`/api/admin/users/${encodeURIComponent(studentId)}/barcode-png`, { responseType: "blob" })).data;
export const searchAdminUsers = async (query: string): Promise<User[]> => {
  const response = await axiosInstance.get<User[] | { rows?: User[] }>("/api/admin/users", { params: { student_employee_id: query, name: query } });
  return Array.isArray(response.data) ? response.data : response.data.rows ?? [];
};

import axiosInstance from "@/utils/AxiosInstance";
import type { AttendanceLog } from "./AdminAttendanceLogs.types";

export interface AttendanceHistoryRow { id: number; type: "check_in" | "check_out"; purpose: "entry_exit" | "borrowing"; scanned_id: string; timestamp: string; name: string; student_employee_id: string; role: string; scanned_by_name: string | null; }
export interface AttendanceHistoryResponse {
  rows: AttendanceHistoryRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: { total_records: number; check_in_count: number; check_out_count: number; unique_users: number; borrowing_scan_count: number };
  sessions?: Array<{ id: number; name: string; student_employee_id: string; checked_in_at: string; checked_out_at: string | null; duration_minutes: number | null; status: "complete" | "incomplete" }>;
}
export const fetchTodayAttendance = async (params: Record<string, string | number>): Promise<AttendanceLog[]> => (await axiosInstance.get<AttendanceLog[]>("/api/attendance/today", { params })).data;
export const fetchAttendanceHistory = async (params: Record<string, string | number | undefined>): Promise<AttendanceHistoryResponse> => (await axiosInstance.get<AttendanceHistoryResponse>("/api/attendance/logs", { params })).data;

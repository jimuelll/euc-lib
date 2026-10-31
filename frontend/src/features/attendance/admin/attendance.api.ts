import axiosInstance from "@/utils/AxiosInstance";

export interface AttendanceHistoryRow { id: number; type: "check_in" | "check_out"; purpose: "entry_exit" | "borrowing"; scanned_id: string; timestamp: string; name: string; student_employee_id: string; role: string; scanned_by_name: string | null; }

export interface AttendanceVisit extends AttendanceHistoryRow { user_id: number; checked_in_at: string | null; checked_out_at: string | null; duration_minutes: number | null; }
export interface AttendanceVisitsResponse { rows: AttendanceVisit[]; pagination: { page: number; limit: number; total: number; totalPages: number }; summary: { total_visits: number; unique_users: number; arrivals: number; departures: number; inside: number }; }
export const fetchAttendanceVisits = async (params: Record<string, string | number>, signal?: AbortSignal): Promise<AttendanceVisitsResponse> => (await axiosInstance.get("/api/attendance/visits", { params, signal })).data;
export const recordManualAttendance = async (scannedId: string, type: string) => (await axiosInstance.post("/api/attendance/scan", { scannedId, type })).data;
export const timeOutAttendance = async (cutoff: string): Promise<{ completed: number; skipped: number }> => (await axiosInstance.post("/api/attendance/scan/time-out-all", { cutoff })).data;

import type { RowDataPacket } from "mysql2/promise";

export type AttendanceType = "check_in" | "check_out";

export interface AttendanceUser extends RowDataPacket {
  id: number;
  name: string;
  role: string;
  student_employee_id: string;
  barcode: string | null;
}

export interface RecordScanInput {
  scannedId: string;
  type: AttendanceType;
  scannedBy: number;
  ipAddress?: string;
}

export interface AttendanceFilters {
  page: number;
  limit: number;
  search: string;
  type: string;
  purpose: string;
  dateFrom: string;
  dateTo: string;
}

export interface TodayLogInput {
  limit?: number;
  lastId?: number | null;
}

export interface AttendanceLogRow extends RowDataPacket {
  id: number;
  type: AttendanceType;
  purpose?: string;
  scanned_id?: string;
  timestamp: Date | string;
  name?: string;
  student_employee_id?: string;
  role?: string;
  scanned_by_name?: string | null;
}

export interface AttendanceCountRow extends RowDataPacket {
  total: number | string;
}

export interface AttendanceSummaryRow extends RowDataPacket {
  total_records: number | string | null;
  check_in_count: number | string | null;
  check_out_count: number | string | null;
  unique_users: number | string | null;
  borrowing_scan_count: number | string | null;
}

export interface AttendanceSessionRow extends RowDataPacket {
  id: number;
  name: string;
  student_employee_id: string;
  checked_in_at: Date | string;
  checked_out_at: Date | string | null;
}

export interface AttendanceSession extends AttendanceSessionRow {
  duration_minutes: number | null;
  status: "complete" | "incomplete";
}

export interface AttendanceLogsQueryResult {
  rows: AttendanceLogRow[];
  total: number;
  summary: AttendanceSummaryRow | null;
}

export interface AttendanceLogsResult {
  rows: AttendanceLogRow[];
  total: number;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: {
    total_records: number;
    check_in_count: number;
    check_out_count: number;
    unique_users: number;
    borrowing_scan_count: number;
  };
  sessions?: AttendanceSession[];
}

export interface MyLogsOptions {
  paged: boolean;
  limit: number;
  offset: number;
}

export interface MyLogsQueryResult {
  rows: AttendanceLogRow[];
  total: number;
}

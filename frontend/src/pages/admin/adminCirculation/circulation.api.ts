import axiosInstance from "@/utils/AxiosInstance";
import type { BookInfo, UserInfo, ActiveBorrow, ClearanceStatus } from "./circulation.types";

export interface LookupUserResult {
  user: UserInfo;
  activeBorrows: ActiveBorrow[];
  clearance: ClearanceStatus;
}

export interface CirculationLogEntry {
  id: number;
  user_name: string;
  student_employee_id: string;
  book_title: string;
  book_author: string;
  isbn: string | null;
  copy_barcode: string | null;
  is_legacy?: boolean | number;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  fine_amount: number;
  hours_overdue: number;
  status: "borrowed" | "overdue" | "returned";
  issued_by_name: string | null;
  deleted_at: string | null;   // ← NEW: present when archived
}

export interface CirculationLogFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  archived?: boolean;          // ← NEW
}

export interface CirculationLogSummary {
  total_records: number;
  borrowed_count: number;
  overdue_count: number;
  returned_count: number;
  unique_borrowers: number;
}

export interface CirculationLogResult {
  rows: CirculationLogEntry[];
  total: number;
  page: number;
  totalPages: number;
  summary?: CirculationLogSummary;
}

export const lookupUser = async (studentEmployeeId: string): Promise<LookupUserResult> => {
  const res = await axiosInstance.get("/api/borrowing/scan/user", {
    params: { student_employee_id: studentEmployeeId },
  });
  return { user: res.data.user, activeBorrows: res.data.activeBorrows ?? [], clearance: res.data.clearance };
};

export const lookupCopy = async (barcode: string): Promise<BookInfo> => {
  const res = await axiosInstance.get(`/api/borrowing/scan/copy/${encodeURIComponent(barcode)}`);
  return res.data;
};

export const processBorrow = async (
  userBarcode: string,
  copyBarcode: string,
  daysAllowed: number,
  reservationId?: number
) => {
  const res = await axiosInstance.post("/api/borrowing/scan/borrow", {
    userBarcode,
    copyBarcode,
    daysAllowed,
    reservationId,
  });
  return res.data;
};

export const processReturn = async (copyBarcode: string) => {
  const res = await axiosInstance.post("/api/borrowing/scan/return", { copyBarcode });
  return res.data;
};

export const getCirculationLog = async (
  filters: CirculationLogFilters = {}
): Promise<CirculationLogResult> => {
  const res = await axiosInstance.get("/api/borrowing/admin/borrows", { params: filters });
  return res.data;
};

// ── NEW: Soft delete / restore ────────────────────────────────────────────────

export const archiveBorrowing = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/api/borrowing/admin/borrows/${id}`);
};

export const restoreBorrowing = async (id: number): Promise<void> => {
  await axiosInstance.patch(`/api/borrowing/admin/borrows/${id}/restore`);
};

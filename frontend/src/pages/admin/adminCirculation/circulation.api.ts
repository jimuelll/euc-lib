import axiosInstance from "@/utils/AxiosInstance";
import type { BookInfo, UserInfo, ActiveBorrow } from "./circulation.types";

export interface LookupUserResult {
  user: UserInfo;
  activeBorrows: ActiveBorrow[];
}

export interface CirculationLogEntry {
  id: number;
  user_name: string;
  student_employee_id: string;
  book_title: string;
  book_author: string;
  isbn: string | null;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  status: "borrowed" | "overdue" | "returned";
  issued_by_name: string | null;
}

export interface CirculationLogFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CirculationLogResult {
  rows: CirculationLogEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export const lookupUser = async (studentEmployeeId: string): Promise<LookupUserResult> => {
  const res = await axiosInstance.get("/api/admin/users/lookup", {
    params: { student_employee_id: studentEmployeeId },
  });
  return { user: res.data.user, activeBorrows: res.data.activeBorrows ?? [] };
};

export const lookupCopy = async (barcode: string): Promise<BookInfo> => {
  const res = await axiosInstance.get(`/api/borrowing/scan/copy/${encodeURIComponent(barcode)}`);
  return res.data;
};

export const processBorrow = async (
  userBarcode: string,
  copyBarcode: string,
  daysAllowed: number
) => {
  const res = await axiosInstance.post("/api/borrowing/scan/borrow", {
    userBarcode,
    copyBarcode,
    daysAllowed,
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
  const res = await axiosInstance.get("/api/admin/circulation/log", { params: filters });
  return res.data;
};
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
  isbn: string;
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

export const lookupBook = async (isbn: string): Promise<BookInfo> => {
  const res = await axiosInstance.get("/api/admin/books/lookup", {
    params: { isbn },
  });
  return res.data;
};

export const processBorrow = async (userId: number, bookId: number, dueDate: string) => {
  const res = await axiosInstance.post("/api/admin/circulation/borrow", {
    userId, bookId, dueDate,
  });
  return res.data;
};

export const processReturn = async (borrowingId: number) => {
  const res = await axiosInstance.post("/api/admin/circulation/return", { borrowingId });
  return res.data;
};

export const processRenew = async (borrowingId: number, dueDate: string) => {
  const res = await axiosInstance.post("/api/admin/circulation/renew", { borrowingId, dueDate });
  return res.data;
};

export const getCirculationLog = async (
  filters: CirculationLogFilters = {}
): Promise<CirculationLogResult> => {
  const res = await axiosInstance.get("/api/admin/circulation/log", { params: filters });
  return res.data;
};
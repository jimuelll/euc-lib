import type { RowDataPacket } from "mysql2/promise";

export interface UserProfileRow extends RowDataPacket {
  id: number;
  name: string;
  role: string;
  student_employee_id: string;
  email: string | null;
  profile_picture: string | null;
  address: string | null;
  contact: string | null;
}

export interface ActiveBorrowRow extends RowDataPacket {
  id: number;
  title: string;
  author: string | null;
  category: string | null;
  location: string | null;
  borrowed_at: Date | string;
  due_date: Date | string | null;
  status: string;
  notes: string | null;
  copy_barcode: string | null;
  fine_amount?: number | string | null;
}

export interface BorrowHistoryRow extends RowDataPacket {
  id: number;
  title: string;
  author: string | null;
  borrowed_at: Date | string;
  returned_at: Date | string | null;
  due_date: Date | string | null;
  status: string;
  copy_id: number | null;
  copy_barcode: string | null;
  accession_number: string | null;
}

export interface ActiveReservationRow extends RowDataPacket {
  id: number;
  title: string;
  author: string | null;
  location: string | null;
  status: string;
  reserved_at: Date | string;
  expires_at: Date | string | null;
  notes: string | null;
}

export interface ReservationHistoryRow extends RowDataPacket {
  id: number;
  title: string;
  author: string | null;
  status: string;
  reserved_at: Date | string;
  expires_at: Date | string | null;
  fulfilled_at: Date | string | null;
  cancelled_at: Date | string | null;
}

export interface AttendanceLogRow extends RowDataPacket {
  id: number;
  type: "check_in" | "check_out";
  timestamp: Date | string;
}

export interface HistoryItemRow extends RowDataPacket {
  id: number;
  title: string;
  author: string | null;
  kind: "borrowing" | "reservation";
  status: string;
  occurred_at: Date | string;
  borrowed_at: Date | string | null;
  returned_at: Date | string | null;
  reserved_at: Date | string | null;
  copy_id: number | null;
  copy_barcode: string | null;
  accession_number: string | null;
}

export interface AttendanceSession {
  date: string | null;
  time_in: string | null;
  time_out: string | null;
}

export interface PaginationOptions {
  page?: unknown;
  limit?: unknown;
}

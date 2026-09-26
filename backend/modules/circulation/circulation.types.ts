import type { RowDataPacket } from "mysql2/promise";

export interface CirculationUser extends RowDataPacket {
  id: number;
  name: string;
  student_employee_id: string;
  role: string;
  is_active: number | boolean;
}

export interface ActiveBorrow extends RowDataPacket {
  id: number;
  title: string;
  author: string | null;
  due_date: string | Date;
  status: string;
}

export interface CirculationBook extends RowDataPacket {
  id: number;
  title: string;
  author: string | null;
  isbn: string | null;
  copies: number | string;
  material_type: string;
  canReserve: number | boolean;
  canBorrow: number | boolean;
  available: number | string;
}

export interface ReturnBorrowing extends RowDataPacket {
  id: number;
  status: string;
  user_id: number;
  book_id: number;
  copy_id: number | null;
  due_date: string | Date;
  returned_at: string | Date | null;
  fine_per_hour: number | string;
  fine_interval: number | string;
  initial_fine: number | string;
  title: string;
  barcode: string | null;
}

export interface RenewalBorrowing extends RowDataPacket {
  id: number;
  user_id: number;
  status: string;
  due_date: string | Date;
  loan_duration_minutes: number | string | null;
  loan_duration_unit: string | null;
  title: string;
  has_active_policy: number | boolean;
}

export interface BorrowingNotificationTarget extends RowDataPacket {
  id: number;
  user_id: number;
  title: string;
}

export interface CirculationLogRow extends RowDataPacket {
  id: number;
  user_name: string;
  student_employee_id: string;
  book_title: string;
  book_author: string | null;
  isbn: string | null;
  borrowed_at: string | Date;
  due_date: string | Date;
  returned_at: string | Date | null;
  status: string;
  issued_by_name: string | null;
}

export interface CirculationLogOptions {
  status?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface ProcessBorrowInput {
  userId: number;
  bookId: number;
  issuedBy: number;
}

export interface ProcessRenewInput {
  borrowingId: number;
  renewedBy?: number | null;
}

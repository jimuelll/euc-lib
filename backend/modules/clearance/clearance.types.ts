import type { RowDataPacket } from "mysql2/promise";

export interface ClearanceUser extends RowDataPacket {
  id: number;
  name?: string;
  role?: string;
  student_employee_id?: string;
  is_active?: number | boolean;
  program_course?: string | null;
}

export interface OverdueBorrowing extends RowDataPacket {
  id: number;
  title: string;
  due_date: Date | string;
}

export interface FineRow extends RowDataPacket {
  id: number;
  user_id: number;
  user_name?: string;
  student_employee_id?: string;
  unsettled_amount: number | string;
}

export interface FineSummary {
  total_unsettled_amount: number;
}

export interface FineList {
  rows: FineRow[];
  summary: FineSummary;
}

export interface ClearanceStatus {
  status: "blocked" | "eligible";
  reasons: string[];
  overdueItems: OverdueBorrowing[];
  fineRows: FineRow[];
  outstandingAmount: number;
}

export interface ClearanceQueueEntry {
  userId: number;
  name: string;
  studentEmployeeId: string;
  overdueCount: number;
  oldestDueDate: Date | string | null;
  overdueTitles: string[];
  outstandingAmount: number;
  fineRecords: number;
}

export interface QueueOverdueBorrowing extends RowDataPacket {
  user_id: number;
  name: string;
  student_employee_id: string;
  overdue_count: number | string;
  oldest_due_date: Date | string | null;
  overdue_titles: string | null;
}

export interface ClearanceReservation extends RowDataPacket {
  id: number;
  status: string;
  reserved_at: Date | string;
  expires_at: Date | string | null;
  book_title: string;
}

export interface ClearanceUserTransaction extends RowDataPacket {
  id: number;
  receipt_number: string | null;
  transaction_type: string;
  amount: number | string;
  reason: string | null;
  created_at: Date | string;
  corrected: number | boolean;
}

export interface PaymentUser extends ClearanceUser {
  name: string;
  student_employee_id: string;
}

export interface LockedClearanceUser extends ClearanceUser {
  deleted_at: Date | string | null;
}

export interface BorrowingForAdjustment extends RowDataPacket {
  id: number;
  user_id: number;
  deleted_at: Date | string | null;
}

export type ClearanceTransactionType = "payment" | "adjustment" | "reversal";

export interface TransactionAllocation {
  borrowingId: number;
  amount: number | string;
}

export interface CreateTransactionInput {
  userId: number;
  type: ClearanceTransactionType;
  amount: number;
  method?: string | null;
  reason?: string | null;
  createdBy: number;
  reversesTransactionId?: number | null;
  allocations: TransactionAllocation[];
}

export interface ClearanceTransaction extends RowDataPacket {
  id: number;
  user_id: number;
  transaction_type: ClearanceTransactionType;
  amount: number | string;
  receipt_number: string | null;
  [key: string]: unknown;
}

export interface ClearanceTransactionItem extends RowDataPacket {
  borrowing_id: number;
  amount: number | string;
}

export interface ReceiptItem extends RowDataPacket {
  amount: number | string;
  book_title: string;
}

export interface CreateTransactionResult {
  id: number;
  receiptNumber: string | null;
}

export interface ClearanceQueuePage {
  rows: ClearanceQueueEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

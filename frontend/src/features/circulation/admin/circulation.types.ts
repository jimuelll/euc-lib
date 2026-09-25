import { BookOpen, RotateCcw } from "lucide-react";
import type { ElementType } from "react";

export type TransactionType = "borrow" | "return";

export interface BookInfo {
  id: number;       // copy id (bc.id)
  book_id: number;
  title: string;
  author: string;
  copies: number;
  barcode: string;
  accession_number?: string | null;
  accession_voided?: boolean | number;
  condition: string;
  is_active: boolean;
  has_holding?: boolean | number;
  borrow_eligible?: boolean | number;
  needs_policy?: boolean | number;
  is_reserved?: boolean | number;
  has_active_loan?: boolean | number;
}

export interface UserInfo {
  id: number;
  name: string;
  student_employee_id: string;
  barcode: string;
  role: string;
}

export interface ClearanceStatus {
  status: "blocked" | "eligible";
  reasons: string[];
  outstandingAmount: number;
  overdueItems: { id: number; title: string }[];
}

export interface ActiveBorrow {
  id: number;
  book_id: number;
  copy_id: number | null;
  copy_barcode?: string | null;
  accession_number?: string | null;
  title: string;
  author: string;
  borrowed_at: string;
  due_date: string;
  status: "borrowed" | "overdue";
}

export interface ReturnPreview {
  borrowing_id: number;
  borrowed_at: string;
  due_date: string;
  status: "borrowed" | "overdue";
  user_id: number;
  user_name: string;
  student_employee_id: string;
  role: string;
  copy_id: number;
  book_id: number;
  copy_barcode: string;
  copy_condition: string;
  copy_is_active: boolean | number;
  accession_number: string | null;
  title: string;
  author: string;
}

export interface ReturnReceipt extends ReturnPreview {
  returned_at: string;
}

export interface TransactionConfig {
  label: string;
  icon: ElementType;
  color: string;
  bg: string;
}

export const TRANSACTION_CONFIG: Record<TransactionType, TransactionConfig> = {
  borrow: {
    label: "Borrow",
    icon:  BookOpen,
    color: "text-info",
    bg:    "bg-info/10 border-info/20",
  },
  return: {
    label: "Return",
    icon:  RotateCcw,
    color: "text-success",
    bg:    "bg-success/10 border-success/20",
  },
};

export const DEFAULT_LOAN_DAYS = 7;

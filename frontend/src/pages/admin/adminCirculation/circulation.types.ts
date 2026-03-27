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
  condition: string;
  is_active: boolean;
}

export interface UserInfo {
  id: number;
  name: string;
  student_employee_id: string;
  barcode: string;
  role: string;
}

export interface ActiveBorrow {
  id: number;
  book_id: number;
  title: string;
  author: string;
  borrowed_at: string;
  due_date: string;
  status: "borrowed" | "overdue";
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
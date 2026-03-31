import { Clock, CheckCircle2, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ReservationStatus =
  | "pending"
  | "ready"
  | "fulfilled"
  | "cancelled"
  | "expired";

export interface AdminReservation {
  id: number;
  user_name: string;
  student_employee_id: string;
  book_title: string;
  book_author: string;
  book_location: string | null;
  status: ReservationStatus;
  reserved_at: string;
  expires_at: string | null;
  notes: string | null;
}

export interface ReservationsResult {
  rows: AdminReservation[];
  total: number;
  page: number;
  totalPages: number;
  summary?: {
    total_records: number;
    pending_count: number;
    ready_count: number;
    fulfilled_count: number;
    cancelled_count: number;
    expired_count: number;
  };
}

export interface ReservationFilters {
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  archived?: true;
}

export interface StatusConfig {
  label: string;
  className: string;
  icon: LucideIcon;
}

export const RESERVATION_STATUS_CONFIG: Record<ReservationStatus, StatusConfig> = {
  pending: {
    label: "Pending",
    className: "border-warning/30 bg-warning/10 text-warning",
    icon: Clock,
  },
  ready: {
    label: "Ready",
    className: "border-success/30 bg-success/10 text-success",
    icon: CheckCircle2,
  },
  fulfilled: {
    label: "Fulfilled",
    className: "border-info/30 bg-info/10 text-info",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    className: "border-muted/30 bg-muted/10 text-muted-foreground",
    icon: XCircle,
  },
  expired: {
    label: "Expired",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: XCircle,
  },
};

export const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "ready", label: "Ready" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

export const PAGE_SIZE = 15;

import type { LucideIcon } from "lucide-react";

export type ReservationStatus =
  | "pending"
  | "ready"
  | "fulfilled"
  | "cancelled"
  | "expired";

export interface AdminReservation {
  id: number;
  book_id: number;
  user_name: string;
  student_employee_id: string;
  book_title: string;
  book_author: string;
  book_location: string | null;
  status: ReservationStatus;
  reserved_at: string;
  expires_at: string | null;
  notes: string | null;
  patron_email?: string | null;
  patron_contact?: string | null;
  available_copies?: number;
  queue_position?: number;
  reserved_copy_barcode?: string | null;
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
    expiring_count?: number;
    soonest_expiry?: string | null;
  };
}

export interface ReservationFilters {
  recordId?:number;
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



export const PAGE_SIZE = 15;

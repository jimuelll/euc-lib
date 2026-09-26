import type { RowDataPacket } from "mysql2/promise";

export interface ReservationRow extends RowDataPacket {
  id: number;
  user_id?: number;
  book_id?: number;
  status?: string;
  title?: string;
  expires_at?: Date | string | null;
  reserved_copy_id?: number | null;
  barcode?: string | null;
  [key: string]: unknown;
}

export interface ReservationReadyRow extends RowDataPacket {
  id: number;
  book_id: number;
  user_id: number;
  status: string;
  within_deadline: number | boolean;
  title: string;
}

export interface ReservationCancelRow extends RowDataPacket {
  id: number;
  user_id: number;
  status: string;
  title?: string;
}

export interface ReservationAuditRow extends RowDataPacket {
  id: number;
  book_id: number;
  user_id: number;
  status: string;
  reserved_copy_id: number | null;
  expires_at: Date | string | null;
  title: string;
  barcode: string | null;
}

export interface ReservationAdminCancelRow extends RowDataPacket {
  id: number;
  user_id: number;
  book_id: number;
  status: string;
  title: string;
}

export interface ReservationBook extends RowDataPacket {
  id: number;
  title: string;
  material_type: string;
  has_active_policy: number | boolean;
  registered_copy_count: number | string;
}

export interface ReservationIdentity extends RowDataPacket {
  book_id: number;
}

export interface ReservationNotificationTarget extends RowDataPacket {
  id: number;
  user_id: number;
  status: string;
  title: string;
}

export interface ExpiredReservationRow extends RowDataPacket {
  id: number;
  user_id: number;
  reserved_copy_id: number | null;
  barcode: string | null;
  title: string;
}

export interface ReservationCopy extends RowDataPacket {
  id: number;
}

export interface ReservationHistoryOptions {
  page?: unknown;
  limit?: unknown;
}

export interface CatalogueSearchOptions extends ReservationHistoryOptions {
  showUnheldInOpac?: boolean;
}

export interface AdminReservationOptions {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  archived?: boolean;
  page: number;
  limit: number;
}

export interface ReservationAdminPage {
  rows: RowDataPacket[];
  total: number | string;
  page: number;
  totalPages: number;
  summary: {
    total_records: number;
    pending_count: number;
    ready_count: number;
    fulfilled_count: number;
    cancelled_count: number;
    expired_count: number;
  };
}

export interface ReservationError extends Error {
  status?: number;
  code?: string;
}

import type { RowDataPacket } from "mysql2/promise";

export interface RenewalBorrowing extends RowDataPacket {
  id: number;
  user_id: number;
  book_id: number;
  renewal_count: number | string;
  status: string;
  due_date: string | Date;
  loan_duration_minutes: number | string | null;
  loan_duration_unit: string | null;
  title: string;
  has_active_policy: number | boolean;
}

export interface ProcessRenewInput {
  borrowingId: number;
  renewedBy?: number | null;
}

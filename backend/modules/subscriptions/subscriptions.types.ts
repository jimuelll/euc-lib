import type { RowDataPacket } from "mysql2/promise";

export interface SubscriptionRecord extends RowDataPacket {
  id: number;
  title: string;
  url: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  image_public_id: string | null;
  is_active: boolean | number;
  sort_order: number;
  created_by: number | null;
  updated_by: number | null;
  deleted_at?: Date | string | null;
  deleted_by?: number | null;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface PaginationOptions {
  page?: unknown;
  limit?: unknown;
}

export interface SubscriptionPage {
  rows: SubscriptionRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateSubscriptionInput {
  title: string;
  url: string;
  description?: string | null;
  category?: string | null;
  image_url?: string | null;
  image_public_id?: string | null;
  is_active?: boolean;
  sort_order?: number;
  created_by?: number | null;
}

export interface UpdateSubscriptionInput {
  title?: string;
  url?: string;
  description?: string | null;
  category?: string | null;
  image_url?: string | null;
  image_public_id?: string | null;
  is_active?: boolean;
  sort_order?: number;
  updated_by?: number | null;
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface CatalogBook {
  id: number;
  title: string;
  author: string;
  category?: string;
  isbn?: string;
  location?: string;
  copies: number;
  registered_copies?: number;
  available: number;
  material_type?: "book" | "thesis";
  canReserve?: boolean;
  reservations_full?: boolean | number;
}

export interface ActiveReservation {
  book_id: number;
  id: number;
  title: string;
  author: string;
  location?: string;
  status: "pending" | "ready";
  reserved_at: string;
  expires_at: string | null;
  notes?: string;
}

export interface ReservationHistory {
  id: number;
  title: string;
  author: string;
  status: "cancelled" | "expired" | "fulfilled";
  reserved_at: string;
  expires_at: string | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
}

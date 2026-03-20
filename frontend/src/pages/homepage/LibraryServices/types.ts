// ─── Domain types ─────────────────────────────────────────────────────────────

export interface CatalogBook {
  id: number;
  title: string;
  author: string;
  category?: string;
  isbn?: string;
  location?: string;
  copies: number;
  available: number;
}

export interface ActiveReservation {
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

// ─── Status display configs ───────────────────────────────────────────────────

export const reservationStatusConfig: Record<
  ActiveReservation["status"],
  { label: string; className: string }
> = {
  pending: { label: "Pending",    className: "bg-info/10 text-info border-info/20" },
  ready:   { label: "Ready",      className: "bg-success/10 text-success border-success/20" },
};

export const reservationHistoryStatusConfig: Record<
  ReservationHistory["status"],
  { label: string; className: string }
> = {
  fulfilled: { label: "Fulfilled", className: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "Cancelled", className: "bg-muted/50 text-muted-foreground border-border" },
  expired:   { label: "Expired",   className: "bg-warning/10 text-warning border-warning/20" },
};
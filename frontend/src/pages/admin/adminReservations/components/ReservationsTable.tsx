import { Loader2 } from "lucide-react";
import ReservationRow from "./ReservationRow";
import type { AdminReservation } from "../reservations.types";

interface ReservationsTableProps {
  rows:        AdminReservation[];
  loading:     boolean;
  actionId:    number | null;
  onMarkReady: (id: number, title: string) => void;
  onFulfill:   (id: number, title: string) => void;
  onCancel:    (id: number, title: string) => void;
}

const ReservationsTable = ({
  rows,
  loading,
  actionId,
  onMarkReady,
  onFulfill,
  onCancel,
}: ReservationsTableProps) => (
  <div className="rounded-lg border border-border overflow-hidden">

    {/* Column headers */}
    <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-4 py-2.5 bg-muted/40 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
      <span>Book</span>
      <span>Patron</span>
      <span>Status / Expiry</span>
      <span>Actions</span>
    </div>

    {/* Loading state */}
    {loading && (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading reservations…
      </div>
    )}

    {/* Empty state */}
    {!loading && rows.length === 0 && (
      <div className="py-16 text-center text-sm text-muted-foreground">
        No reservations found.
      </div>
    )}

    {/* Data rows */}
    {!loading &&
      rows.map((reservation, idx) => (
        <ReservationRow
          key={reservation.id}
          reservation={reservation}
          index={idx}
          isActing={actionId === reservation.id}
          onMarkReady={onMarkReady}
          onFulfill={onFulfill}
          onCancel={onCancel}
        />
      ))}
  </div>
);

export default ReservationsTable;
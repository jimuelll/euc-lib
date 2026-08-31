import { Loader2, BookMarked } from "lucide-react";
import ReservationRow from "./ReservationRow";
import type { AdminReservation } from "../reservations.types";

interface ReservationsTableProps {
  rows:         AdminReservation[];
  loading:      boolean;
  actionId:     number | null;
  showArchived: boolean;
  onMarkReady:  (id: number, title: string) => void;
  onFulfill:    (reservation: AdminReservation) => void;
  onCancel:     (id: number, title: string) => void;
  onArchive:    (id: number, title: string) => void;
  onRestore:    (id: number, title: string) => void;
}

const ColHeader = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <th className={`px-4 py-2.5 text-left ${className}`}>
    <span
      className="text-xs font-semibold text-muted-foreground"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {children}
    </span>
  </th>
);

const ReservationsTable = ({
  rows, loading, actionId, showArchived,
  onMarkReady, onFulfill, onCancel, onArchive, onRestore,
}: ReservationsTableProps) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-border bg-muted/30">
          <th className="w-[3px] p-0" />
          <ColHeader>Book</ColHeader>
          <ColHeader className="hidden sm:table-cell">Patron</ColHeader>
          <ColHeader className="hidden md:table-cell">Status / Expiry</ColHeader>
          <ColHeader>Actions</ColHeader>
        </tr>
      </thead>

      <tbody>
        {loading && (
          <tr>
            <td colSpan={5} className="px-4 py-14 text-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-warning" />
                <span
                  className="text-sm text-muted-foreground"
                >
                  Loading reservations…
                </span>
              </div>
            </td>
          </tr>
        )}

        {!loading && rows.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-14 text-center">
              <div className="flex flex-col items-center gap-2">
                <BookMarked className="h-7 w-7 text-muted-foreground/15" />
                <span
                  className="text-sm text-muted-foreground"
                >
                  {showArchived ? "No archived reservations found" : "No reservations found"}
                </span>
              </div>
            </td>
          </tr>
        )}

        {!loading && rows.map((reservation, idx) => (
          <ReservationRow
            key={reservation.id}
            reservation={reservation}
            index={idx}
            isActing={actionId === reservation.id}
            showArchived={showArchived}
            onMarkReady={onMarkReady}
            onFulfill={onFulfill}
            onCancel={onCancel}
            onArchive={onArchive}
            onRestore={onRestore}
          />
        ))}
      </tbody>
    </table>
  </div>
);

export default ReservationsTable;

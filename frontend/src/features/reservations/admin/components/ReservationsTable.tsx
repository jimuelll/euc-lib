import { BookMarked, CalendarClock, MapPin, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ReservationRow from "./ReservationRow";
import ReservationRowActions from "./ReservationRowActions";
import { RESERVATION_STATUS_CONFIG, type AdminReservation } from "../reservations.types";

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
  <>
    <div className="divide-y divide-border md:hidden" aria-live="polite">
      {loading && Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="space-y-3 p-4" aria-label="Loading reservation">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      ))}
      {!loading && rows.length === 0 && (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
          {showArchived ? "No archived reservations found" : "No reservations found"}
        </p>
      )}
      {!loading && rows.map((reservation) => {
        const status = RESERVATION_STATUS_CONFIG[reservation.status];
        const StatusIcon = status.icon;
        return (
          <article key={reservation.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-sm font-semibold text-foreground">{reservation.book_title}</h3>
                <p className="text-xs text-muted-foreground">{reservation.book_author}</p>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${status.className}`}>
                <StatusIcon className="h-3 w-3" />{status.label}
              </span>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="flex items-center gap-2"><User className="h-3.5 w-3.5 shrink-0" /><span className="break-words text-foreground">{reservation.user_name}</span><span className="font-mono">{reservation.student_employee_id}</span></p>
              <p className="flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5 shrink-0" />Reserved {new Date(reservation.reserved_at).toLocaleDateString()}</p>
              {reservation.expires_at && (reservation.status === "pending" || reservation.status === "ready") && (
                <p className="pl-[22px]">Expires {new Date(reservation.expires_at).toLocaleString()}</p>
              )}
              {reservation.book_location && <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0" />{reservation.book_location}</p>}
            </div>
            <ReservationRowActions
              id={reservation.id}
              title={reservation.book_title}
              status={reservation.status}
              isActing={actionId === reservation.id}
              showArchived={showArchived}
              onMarkReady={onMarkReady}
              onFulfill={() => onFulfill(reservation)}
              onCancel={onCancel}
              onArchive={onArchive}
              onRestore={onRestore}
            />
          </article>
        );
      })}
    </div>
    <div className="hidden overflow-x-auto md:block">
    <table className="w-full min-w-[800px] text-left">
      <thead>
        <tr className="border-b border-border bg-muted/30">
          <ColHeader>Book</ColHeader>
          <ColHeader >Patron</ColHeader>
          <ColHeader >Status / Expiry</ColHeader>
          <ColHeader>Actions</ColHeader>
        </tr>
      </thead>

      <tbody>
        {loading && (
          <tr>
            <td colSpan={4} className="p-0" aria-label="Loading reservations">
              {Array.from({ length: 4 }, (_, index) => <div className="grid grid-cols-[3px_minmax(10rem,1fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)_7rem] gap-4 border-b border-border px-4 py-4" key={index}><span /><div className="space-y-2"><Skeleton className="h-4 w-3/5" /><Skeleton className="h-3 w-2/5" /></div><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-8 w-full" /></div>)}
            </td>
          </tr>
        )}

        {!loading && rows.length === 0 && (
          <tr>
            <td colSpan={4} className="px-4 py-14 text-center">
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
  </>
);

export default ReservationsTable;

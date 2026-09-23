import { BookMarked, User, CalendarClock, MapPin } from "lucide-react";
import { RESERVATION_STATUS_CONFIG } from "../reservations.types";
import type { AdminReservation } from "../reservations.types";
import ReservationRowActions from "./ReservationRowActions";

interface ReservationRowProps {
  reservation: AdminReservation;
  isActing:    boolean;
  index:       number;
  showArchived: boolean;
  onMarkReady: (id: number, title: string) => void;
  onFulfill:   (reservation: AdminReservation) => void;
  onCancel:    (id: number, title: string) => void;
  onArchive:   (id: number, title: string) => void;
  onRestore:   (id: number, title: string) => void;
}

const ReservationRow = ({
  reservation: r, isActing, index, showArchived,
  onMarkReady, onFulfill, onCancel, onArchive, onRestore,
}: ReservationRowProps) => {
  const cfg        = RESERVATION_STATUS_CONFIG[r.status];
  const StatusIcon = cfg.icon;
  const showExpiry = r.expires_at && (r.status === "pending" || r.status === "ready");

  return (
    <tr className={`group border-b border-border last:border-0 transition-colors hover:bg-muted/50 ${
      index % 2 !== 0 ? "bg-muted/35" : "bg-card"
    } ${showArchived ? "opacity-70" : ""}`}>

      {/* Book */}
      <td className="px-4 py-3 min-w-0">
        <div className="flex items-start gap-2">
          <BookMarked className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p
              className="text-sm font-semibold text-foreground truncate leading-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {r.book_title}
            </p>
            <p className="mt-0.5 text-xs  text-muted-foreground truncate"
              style={{ fontFamily: "var(--font-heading)" }}>
              {r.book_author}
            </p>
            {r.book_location && (
              <p className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                {r.book_location}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Patron */}
      <td className="px-4 py-3 min-w-0 ">
        <div className="flex items-start gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{r.user_name}</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{r.student_employee_id}</p>
            <p className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <CalendarClock className="h-2.5 w-2.5 shrink-0" />
              {new Date(r.reserved_at).toLocaleDateString([], {
                month: "short", day: "numeric", year: "numeric",
              })}
            </p>
          </div>
        </div>
      </td>

      {/* Status + expiry */}
      <td className="px-4 py-3 ">
        <div className="flex flex-col gap-1.5">
          <span
            className={`inline-flex w-fit items-center gap-1 border px-2 py-1 text-xs font-semibold ${cfg.className}`}
            style={{ fontFamily: "var(--font-heading)", borderRadius: 0 }}
          >
            <StatusIcon className="h-3 w-3 shrink-0" />
            {cfg.label}
          </span>
          {showExpiry && (
            <p className="text-xs text-muted-foreground">
              Exp.{" "}
              {new Date(r.expires_at!).toLocaleString([], {
                month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <ReservationRowActions
          id={r.id}
          title={r.book_title}
          status={r.status}
          isActing={isActing}
          showArchived={showArchived}
          onMarkReady={onMarkReady}
          onFulfill={() => onFulfill(r)}
          onCancel={onCancel}
          onArchive={onArchive}
          onRestore={onRestore}
        />
      </td>
    </tr>
  );
};

export default ReservationRow;

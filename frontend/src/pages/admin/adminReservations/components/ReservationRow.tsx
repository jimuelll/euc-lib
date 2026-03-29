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
  onFulfill:   (id: number, title: string) => void;
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

  const accentColor =
    r.status === "ready"     ? "bg-success/60"  :
    r.status === "pending"   ? "bg-warning/60"   :
    r.status === "fulfilled" ? "bg-info/40"      :
    "bg-border";

  return (
    <tr className={`group border-b border-border last:border-0 hover:bg-muted/15 transition-colors ${
      index % 2 !== 0 ? "bg-muted/[0.06]" : ""
    } ${showArchived ? "opacity-70" : ""}`}>

      {/* Status accent — narrow left cell */}
      <td className="w-[3px] p-0">
        <div className={`h-full w-[3px] min-h-[56px] ${accentColor}`} />
      </td>

      {/* Book */}
      <td className="px-4 py-3 min-w-0">
        <div className="flex items-start gap-2">
          <BookMarked className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p
              className="text-[13px] font-bold text-foreground truncate leading-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {r.book_title}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60 truncate"
              style={{ fontFamily: "var(--font-heading)" }}>
              {r.book_author}
            </p>
            {r.book_location && (
              <p className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground/50">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                {r.book_location}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Patron */}
      <td className="px-4 py-3 min-w-0 hidden sm:table-cell">
        <div className="flex items-start gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{r.user_name}</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">{r.student_employee_id}</p>
            <p className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground/50">
              <CalendarClock className="h-2.5 w-2.5 shrink-0" />
              {new Date(r.reserved_at).toLocaleDateString([], {
                month: "short", day: "numeric", year: "numeric",
              })}
            </p>
          </div>
        </div>
      </td>

      {/* Status + expiry */}
      <td className="px-4 py-3 hidden md:table-cell">
        <div className="flex flex-col gap-1.5">
          <span
            className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] w-fit ${cfg.className}`}
            style={{ fontFamily: "var(--font-heading)", borderRadius: 0 }}
          >
            <StatusIcon className="h-3 w-3 shrink-0" />
            {cfg.label}
          </span>
          {showExpiry && (
            <p className="text-[10px] text-muted-foreground/50">
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
          onFulfill={onFulfill}
          onCancel={onCancel}
          onArchive={onArchive}
          onRestore={onRestore}
        />
      </td>
    </tr>
  );
};

export default ReservationRow;
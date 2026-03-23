import { BookMarked, User, CalendarClock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RESERVATION_STATUS_CONFIG } from "../reservations.types";
import type { AdminReservation } from "../reservations.types";
import ReservationRowActions from "./ReservationRowActions";

interface ReservationRowProps {
  reservation: AdminReservation;
  isActing:    boolean;
  index:       number;
  onMarkReady: (id: number, title: string) => void;
  onFulfill:   (id: number, title: string) => void;
  onCancel:    (id: number, title: string) => void;
}

const ReservationRow = ({
  reservation: r,
  isActing,
  index,
  onMarkReady,
  onFulfill,
  onCancel,
}: ReservationRowProps) => {
  const cfg        = RESERVATION_STATUS_CONFIG[r.status];
  const StatusIcon = cfg.icon;
  const showExpiry = r.expires_at && (r.status === "pending" || r.status === "ready");

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-x-4 gap-y-2 px-4 py-3.5 border-b last:border-0 border-border transition-colors hover:bg-muted/20 ${
        index % 2 !== 0 ? "bg-muted/10" : ""
      }`}
    >
      {/* Book column */}
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <BookMarked className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{r.book_title}</p>
            <p className="text-xs text-muted-foreground truncate">{r.book_author}</p>
            {r.book_location && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground/70 mt-0.5">
                <MapPin className="h-3 w-3" />
                {r.book_location}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Patron column */}
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{r.user_name}</p>
            <p className="text-xs text-muted-foreground font-mono">{r.student_employee_id}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground/70 mt-0.5">
              <CalendarClock className="h-3 w-3" />
              {new Date(r.reserved_at).toLocaleDateString([], {
                month: "short", day: "numeric", year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Status + expiry column */}
      <div className="flex flex-col gap-1.5 justify-center">
        <Badge variant="outline" className={`w-fit text-xs ${cfg.className}`}>
          <StatusIcon className="mr-1 h-3 w-3" />
          {cfg.label}
        </Badge>
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

      {/* Actions column */}
      <div className="flex items-center">
        <ReservationRowActions
          id={r.id}
          title={r.book_title}
          status={r.status}
          isActing={isActing}
          onMarkReady={onMarkReady}
          onFulfill={onFulfill}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
};

export default ReservationRow;
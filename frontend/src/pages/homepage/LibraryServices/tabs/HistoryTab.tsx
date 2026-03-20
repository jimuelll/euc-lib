import { BookMarked, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import BookRow from "../components/BookRow";
import type { ReservationHistory } from "../types";
import { reservationHistoryStatusConfig } from "../types";

interface HistoryTabProps {
  history: ReservationHistory[];
  loading: boolean;
}

const HistoryTab = ({ history, loading }: HistoryTabProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading history...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No reservation history yet.
      </div>
    );
  }

  const getDateLabel = (res: ReservationHistory) => {
    if (res.status === "fulfilled" && res.fulfilled_at) {
      return { label: "Fulfilled", date: res.fulfilled_at };
    }
    if (res.status === "cancelled" && res.cancelled_at) {
      return { label: "Cancelled", date: res.cancelled_at };
    }
    if (res.status === "expired" && res.expires_at) {
      return { label: "Expired", date: res.expires_at };
    }
    return { label: "Reserved", date: res.reserved_at };
  };

  return (
    <div className="space-y-3">
      {history.map((res) => {
        const { label, date } = getDateLabel(res);
        const cfg = reservationHistoryStatusConfig[res.status];
        return (
          <BookRow
            key={res.id}
            icon={BookMarked}
            title={res.title}
            author={res.author}
            meta={
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium text-foreground">
                  {new Date(date).toLocaleDateString([], {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </p>
              </div>
            }
            badge={
              <Badge variant="outline" className={cfg.className}>
                {cfg.label}
              </Badge>
            }
          />
        );
      })}
    </div>
  );
};

export default HistoryTab;
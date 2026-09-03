import { BookMarked } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import BookRow from "../components/BookRow";
import type { ReservationHistory } from "../types";
import { reservationHistoryStatusConfig } from "../types";

interface HistoryTabProps {
  history: ReservationHistory[];
  loading: boolean;
  pagination: { page: number; totalPages: number; total: number };
  onPageChange: (page: number) => void;
}

const HistoryTab = ({ history, loading, pagination, onPageChange }: HistoryTabProps) => {

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-20 w-full rounded-none" />)}
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (history.length === 0) {
    return (
      <div className="border border-dashed border-border bg-card flex flex-col items-center justify-center py-16 gap-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-px w-6 bg-border" />
          <BookMarked className="h-4 w-4 text-muted-foreground/30" />
          <div className="h-px w-6 bg-border" />
        </div>
        <p
          className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          No reservation history yet
        </p>
      </div>
    );
  }

  // ── Date label helper ──────────────────────────────────────────────────────
  const getDateLabel = (res: ReservationHistory) => {
    if (res.status === "fulfilled" && res.fulfilled_at)
      return { label: "Fulfilled", date: res.fulfilled_at };
    if (res.status === "cancelled" && res.cancelled_at)
      return { label: "Cancelled", date: res.cancelled_at };
    if (res.status === "expired" && res.expires_at)
      return { label: "Expired", date: res.expires_at };
    return { label: "Reserved", date: res.reserved_at };
  };

  // ── List ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2.5">
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
              <div className="text-right">
                <p
                  className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {label}
                </p>
                <p
                  className="mt-0.5 text-[12px] font-bold text-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {new Date(date).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            }
            badge={
              <Badge
                variant="outline"
                className={`text-[10px] font-bold uppercase tracking-[0.1em] ${cfg.className}`}
                style={{ fontFamily: "var(--font-heading)", borderRadius: 0 }}
              >
                {cfg.label}
              </Badge>
            }
          />
        );
      })}
      {pagination.totalPages > 1 ? <div className="flex items-center justify-between border-t border-border pt-3"><button type="button" className="text-xs font-semibold text-primary disabled:opacity-40" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Previous</button><span className="text-xs text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</span><button type="button" className="text-xs font-semibold text-primary disabled:opacity-40" disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>Next</button></div> : null}
    </div>
  );
};

export default HistoryTab;

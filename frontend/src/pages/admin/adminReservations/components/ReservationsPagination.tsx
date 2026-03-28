import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE } from "../reservations.types";

interface ReservationsPaginationProps {
  page:         number;
  totalPages:   number;
  total:        number;
  loading:      boolean;
  onPageChange: (page: number) => void;
}

const ReservationsPagination = ({
  page, totalPages, total, loading, onPageChange,
}: ReservationsPaginationProps) => (
  <div className="flex items-center justify-between border border-border px-4 py-2.5 bg-muted/10">

    {/* Count */}
    <p
      className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}{" "}
      <span className="text-muted-foreground/30">of</span>{" "}
      {total} reservations
    </p>

    {/* Prev / Next */}
    {totalPages > 1 && (
      <div className="flex items-center gap-3">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-0 border border-border overflow-hidden">
          <button
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            className="flex items-center justify-center h-7 w-7 border-r border-border text-muted-foreground hover:bg-muted/40 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            className="flex items-center justify-center h-7 w-7 text-muted-foreground hover:bg-muted/40 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )}
  </div>
);

export default ReservationsPagination;
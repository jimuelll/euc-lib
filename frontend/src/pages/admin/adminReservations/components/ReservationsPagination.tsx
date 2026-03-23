import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAGE_SIZE } from "../reservations.types";

interface ReservationsPaginationProps {
  page:       number;
  totalPages: number;
  total:      number;
  loading:    boolean;
  onPageChange: (page: number) => void;
}

const ReservationsPagination = ({
  page,
  totalPages,
  total,
  loading,
  onPageChange,
}: ReservationsPaginationProps) => (
  <>
    {/* Results count strip */}
    <p className="text-xs text-muted-foreground">
      Showing{" "}
      <span className="font-medium text-foreground">
        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
      </span>{" "}
      of <span className="font-medium text-foreground">{total}</span> reservations
    </p>

    {/* Prev / Next — only shown when there are multiple pages */}
    {totalPages > 1 && (
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
          className="gap-1"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(page + 1)}
          className="gap-1"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    )}
  </>
);

export default ReservationsPagination;
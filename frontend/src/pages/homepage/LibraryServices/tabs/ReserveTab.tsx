import { useState } from "react";
import { BookMarked, Clock, CheckCircle2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import axiosInstance from "@/utils/AxiosInstance";
import { toast } from "@/components/ui/sonner";
import BookRow from "../components/BookRow";
import CollapsibleSection from "../components/CollapsibleSection";
import type { CatalogBook, ActiveReservation } from "../types";
import { reservationStatusConfig } from "../types";

interface ReserveTabProps {
  catalog: CatalogBook[];
  activeReservations: ActiveReservation[];
  catalogLoading: boolean;
  dataLoading: boolean;
  hasSearched: boolean;
  onReserveSuccess: (reservation: ActiveReservation, bookId: number) => void;
  onCancelSuccess: (reservationId: number) => void;
}

const ReserveTab = ({
  catalog,
  activeReservations,
  catalogLoading,
  dataLoading,
  hasSearched,
  onReserveSuccess,
  onCancelSuccess,
}: ReserveTabProps) => {
  const [reservingId, setReservingId]   = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const reservedBookTitles = new Set(activeReservations.map((r) => r.title));

  const handleReserve = async (book: CatalogBook) => {
    setReservingId(book.id);
    try {
      const res = await axiosInstance.post(`api/reservations/${book.id}`);
      toast.success(`"${book.title}" reserved — pick up before ${
        res.data.expiresAt
          ? new Date(res.data.expiresAt).toLocaleString()
          : "expiry"
      }`);

      const newReservation: ActiveReservation = {
        id:          res.data.reservationId,
        title:       book.title,
        author:      book.author,
        location:    book.location,
        status:      "pending",
        reserved_at: new Date().toISOString(),
        expires_at:  res.data.expiresAt,
      };
      onReserveSuccess(newReservation, book.id);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Failed to reserve book");
    } finally {
      setReservingId(null);
    }
  };

  const handleCancel = async (reservationId: number, title: string) => {
    setCancellingId(reservationId);
    try {
      await axiosInstance.post(`api/reservations/${reservationId}/cancel`);
      toast.success(`Reservation for "${title}" cancelled`);
      onCancelSuccess(reservationId);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Failed to cancel reservation");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-4">

      {/* Info banner */}
      <div className="rounded-lg border border-info/20 bg-info/5 p-3 flex items-start gap-2.5">
        <Clock className="h-4 w-4 text-info shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Reservations are held for <span className="font-medium text-foreground">48 hours</span>.
          Bring your student ID to the front desk to claim your book.
          Unclaimed reservations expire automatically.
        </p>
      </div>

      {/* Catalogue results */}
      <div className="space-y-3">
        {catalogLoading && (
          <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching catalogue...
          </div>
        )}

        {!catalogLoading && !hasSearched && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Search the catalogue above to find a book to reserve.
          </p>
        )}

        {!catalogLoading && hasSearched && catalog.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No books found matching your search.
          </p>
        )}

        {!catalogLoading &&
          catalog.map((book) => {
            const alreadyReserved = reservedBookTitles.has(book.title);
            return (
              <BookRow
                key={book.id}
                icon={BookMarked}
                title={book.title}
                author={book.author}
                meta={
                  <div>
                    <p className="text-xs text-muted-foreground">Available</p>
                    <p className={`text-sm font-medium ${book.available > 0 ? "text-success" : "text-destructive"}`}>
                      {book.available} of {book.copies}{" "}
                      {book.copies === 1 ? "copy" : "copies"}
                    </p>
                    {book.location && (
                      <p className="text-xs text-muted-foreground mt-0.5">{book.location}</p>
                    )}
                  </div>
                }
                action={
                  alreadyReserved ? (
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      Already reserved
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reservingId === book.id}
                      className="shrink-0"
                      onClick={() => handleReserve(book)}
                    >
                      {reservingId === book.id ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Reserving...</>
                      ) : (
                        "Reserve"
                      )}
                    </Button>
                  )
                }
              />
            );
          })}
      </div>

      {/* My active reservations */}
      <CollapsibleSection
        title="My Reservations"
        icon={BookMarked}
        count={activeReservations.length}
        countVariant={activeReservations.some((r) => r.status === "ready") ? "default" : "default"}
      >
        {dataLoading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
          </div>
        ) : activeReservations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No active reservations.</p>
        ) : (
          activeReservations.map((res) => (
            <div key={res.id} className="flex items-center gap-3 py-2.5 border-b last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{res.title}</p>
                <p className="text-xs text-muted-foreground">{res.author}</p>
                {res.location && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{res.location}</p>
                )}
              </div>

              <div className="shrink-0 hidden sm:block text-right">
                <p className="text-xs text-muted-foreground">
                  {res.status === "ready" ? "Pick up by" : "Expires"}
                </p>
                <p className="text-xs font-medium text-foreground">
                  {res.expires_at
                    ? new Date(res.expires_at).toLocaleString([], {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })
                    : "—"}
                </p>
              </div>

              <Badge
                variant="outline"
                className={reservationStatusConfig[res.status].className}
              >
                {res.status === "ready"
                  ? <CheckCircle2 className="mr-1 h-3 w-3" />
                  : <Clock className="mr-1 h-3 w-3" />
                }
                {reservationStatusConfig[res.status].label}
              </Badge>

              {res.status === "pending" && (
                <button
                  onClick={() => handleCancel(res.id, res.title)}
                  disabled={cancellingId === res.id}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  title="Cancel reservation"
                >
                  {cancellingId === res.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <X className="h-4 w-4" />
                  }
                </button>
              )}
            </div>
          ))
        )}
      </CollapsibleSection>
    </div>
  );
};

export default ReserveTab;
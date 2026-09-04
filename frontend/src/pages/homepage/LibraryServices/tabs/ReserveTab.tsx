import { useState } from "react";
import { BookMarked, Clock, CheckCircle2, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  pagination: { page: number; totalPages: number; total: number };
  onPageChange: (page: number) => void;
  onReserveSuccess: (reservation: ActiveReservation, bookId: number) => void;
  onCancelSuccess: (reservationId: number) => void;
}

const ReserveTab = ({
  catalog,
  activeReservations,
  catalogLoading,
  dataLoading,
  hasSearched,
  pagination,
  onPageChange,
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
    <div className="space-y-5">

      {/* Info banner — info/5 tint with left accent bar */}
      <div className="flex gap-0 border border-info/20 bg-info/[0.04] overflow-hidden">
        <div className="w-[3px] bg-info/40 shrink-0" />
        <div className="flex items-start gap-2.5 px-4 py-3">
          <Clock className="h-3.5 w-3.5 text-info shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Reservations are held for{" "}
            <span
              className="font-bold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              48 hours
            </span>
                    . Bring your student or employee ID to the front desk to claim your book.
            Unclaimed reservations expire automatically.
          </p>
        </div>
      </div>

      {/* ── Catalogue results ─────────────────────────────────────────────── */}
      <div className="space-y-2.5">

        {/* Loading */}
        {catalogLoading && (
          <div className="space-y-2.5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-20 w-full rounded-none" />)}</div>
        )}

        {/* Pre-search prompt */}
        {!catalogLoading && !hasSearched && (
          <div className="flex flex-col items-center justify-center py-14 gap-2 border border-dashed border-border bg-card">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-px w-6 bg-border" />
              <BookMarked className="h-4 w-4 text-muted-foreground/30" />
              <div className="h-px w-6 bg-border" />
            </div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Search the catalogue above to find a book
            </p>
          </div>
        )}

        {/* No results */}
        {!catalogLoading && hasSearched && catalog.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 gap-2 border border-dashed border-border bg-card">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              No books found matching your search
            </p>
          </div>
        )}

        {/* Results list */}
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
                  <div className="text-right">
                    <p
                      className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      Available
                    </p>
                    <p
                      className={`mt-0.5 text-[12px] font-bold ${
                        book.available > 0 ? "text-success" : "text-destructive"
                      }`}
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {book.available} / {book.copies}
                    </p>
                    {book.location && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                        {book.location}
                      </p>
                    )}
                  </div>
                }
                action={
                  alreadyReserved ? (
                    <span
                      className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      Reserved
                    </span>
                  ) : (
                    <button
                      disabled={reservingId === book.id}
                      onClick={() => handleReserve(book)}
                      className="flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {reservingId === book.id ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Reserving…</span>
                        </>
                      ) : (
                        "Reserve"
                      )}
                    </button>
                  )
                }
              />
            );
          })}
        {!catalogLoading && pagination.totalPages > 1 ? <div className="flex items-center justify-between gap-2 border-t border-border pt-3"><button type="button" className="min-h-11 px-3 text-xs font-semibold text-primary disabled:opacity-40" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Previous</button><span className="text-center text-xs text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</span><button type="button" className="min-h-11 px-3 text-xs font-semibold text-primary disabled:opacity-40" disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>Next</button></div> : null}
      </div>

      {/* ── My active reservations ────────────────────────────────────────── */}
      <CollapsibleSection
        title="My Reservations"
        icon={BookMarked}
        count={activeReservations.length}
      >
        {dataLoading ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.15em]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Loading…
            </span>
          </div>
        ) : activeReservations.length === 0 ? (
          <p
            className="py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            No active reservations
          </p>
        ) : (
          activeReservations.map((res) => (
            <div
              key={res.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0 sm:flex-nowrap"
            >
              {/* Title + author */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] font-bold text-foreground truncate"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {res.title}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80 truncate"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {res.author}
                </p>
                {res.location && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground/70">{res.location}</p>
                )}
              </div>

              {/* Expiry — hidden on mobile */}
              <div className="order-3 w-full border-t border-border/60 pt-2 sm:order-none sm:w-auto sm:shrink-0 sm:border-0 sm:pt-0 sm:text-right">
                <p
                  className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {res.status === "ready" ? "Pick up by" : "Expires"}
                </p>
                <p
                  className="mt-0.5 text-[11px] font-bold text-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {res.expires_at
                    ? new Date(res.expires_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </p>
              </div>

              {/* Status badge */}
              <Badge
                variant="outline"
                className={`text-[10px] font-bold uppercase tracking-[0.1em] shrink-0 ${reservationStatusConfig[res.status].className}`}
                style={{ fontFamily: "var(--font-heading)", borderRadius: 0 }}
              >
                {res.status === "ready"
                  ? <CheckCircle2 className="mr-1 h-3 w-3" />
                  : <Clock className="mr-1 h-3 w-3" />
                }
                {reservationStatusConfig[res.status].label}
              </Badge>

              {/* Cancel button */}
              {res.status === "pending" && (
                <button
                  onClick={() => handleCancel(res.id, res.title)}
                  disabled={cancellingId === res.id}
                  className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground/65 transition-colors duration-200 hover:bg-destructive/5 hover:text-destructive disabled:opacity-30"
                  title="Cancel reservation"
                  aria-label={`Cancel reservation for ${res.title}`}
                >
                  {cancellingId === res.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <X className="h-3.5 w-3.5" />
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

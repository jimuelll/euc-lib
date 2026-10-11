import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Clock, CheckCircle2, Loader2 } from "@/components/ui/library-glyphs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { getApiErrorMessage } from "@/utils/apiError";
import type { CatalogBook, ActiveReservation } from "../types";
import { cancelReservation, reserveBook } from "../api";
import ReservationPagination from "../components/ReservationPagination";

interface ReserveTabProps {
  catalog: CatalogBook[]; activeReservations: ActiveReservation[]; catalogLoading: boolean; dataLoading: boolean; hasSearched: boolean;
  catalogError: string | null; activeError: string | null; onRetryCatalog: () => void; onRetryActive: () => void; searchField: ReactNode;
  pagination: { page: number; totalPages: number; total: number }; onPageChange: (page: number) => void;
  onReserveSuccess: (reservation: ActiveReservation, bookId: number) => void; onCancelSuccess: (id: number) => void;
}
const colors = ["#7a0000", "#5c1a1a", "#3d2b3d", "#4a2c1c", "#2b3a42"];
function expiryLabel(value: string | null, now: number) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const minutes = Math.floor((timestamp - now) / 60000);
  return { date: new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), remaining: minutes <= 0 ? "Expired" : minutes >= 1440 ? `in ${Math.floor(minutes / 1440)} d ${Math.floor(minutes % 1440 / 60)} h` : `in ${Math.floor(minutes / 60)} h ${minutes % 60} m` };
}
export default function ReserveTab(props: ReserveTabProps) {
  const { catalog, activeReservations, catalogLoading, dataLoading, hasSearched, pagination, onPageChange, onReserveSuccess, onCancelSuccess } = props;
  const [reservingId, setReservingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  const reserveMutation = useMutation({ mutationFn: reserveBook });
  const cancelMutation = useMutation({ mutationFn: cancelReservation });
  const reservedTitles = new Set(activeReservations.map(res => res.title));
  const busy = reservingId !== null || cancellingId !== null;
  const handleReserve = async (book: CatalogBook) => {
    setReservingId(book.id); setMessage("");
    try {
      const result = await reserveMutation.mutateAsync(book.id);
      const notice = `Reserved “${book.title}”. Check your reservation for its pickup deadline.`;
      setMessage(notice); toast.success(notice);
      onReserveSuccess({ id: result.reservationId, title: book.title, author: book.author, location: book.location, status: "pending", reserved_at: new Date().toISOString(), expires_at: result.expiresAt }, book.id);
    } catch (error) { const notice = getApiErrorMessage(error, "Failed to reserve book"); setMessage(notice); toast.error(notice); }
    finally { setReservingId(null); }
  };
  const handleCancel = async (res: ActiveReservation) => {
    setCancellingId(res.id); setMessage("");
    try { await cancelMutation.mutateAsync(res.id); onCancelSuccess(res.id); setConfirmId(null); setMessage(`Reservation for “${res.title}” cancelled.`); toast.success("Reservation cancelled"); }
    catch (error) { const notice = getApiErrorMessage(error, "Failed to cancel reservation"); setMessage(notice); toast.error(notice); }
    finally { setCancellingId(null); }
  };
  return <div className="reservation-layout"><section className="reservation-catalogue" aria-label="Books to reserve">
    {props.searchField}<p className="reservation-message" role="status">{message}</p>
    <h2 className="reservation-section-label">{hasSearched ? `${pagination.total} result${pagination.total === 1 ? "" : "s"}` : "Browse books to reserve"}</h2>
    {props.catalogError ? <div className="service-error" role="alert"><p>{props.catalogError}</p><button className="service-link" onClick={props.onRetryCatalog}>Try again</button></div> : catalogLoading ? <div className="service-loading" role="status" aria-label="Loading books">{[0, 1, 2].map(id => <Skeleton key={id} className="h-24 w-full" />)}</div> : catalog.length === 0 ? <p className="service-empty">{hasSearched ? "No titles match. Try a title, an author, or an ISBN." : "No books are currently listed for reservation."}</p> : catalog.map(book => {
      const reserved = reservedTitles.has(book.title);
      const eligible = book.material_type !== "thesis" && book.canReserve !== false && Number(book.canReserve) !== 0 && Number(book.registered_copies ?? book.copies) > 0;
      const initials = book.title.replace(/^(the|a)\s/i, "").split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
      return <article className="reservation-book" key={book.id}>
        <div className="reservation-cover" aria-hidden="true" style={{ "--reservation-cover-color": colors[book.id % colors.length] } as CSSProperties}>{initials}</div>
        <div className="reservation-book-copy"><h3>{book.title}</h3><small>{book.author || "Unknown author"}</small><p className={"reservation-book-availability " + (book.available > 0 ? "is-available" : "")}>{book.material_type === "thesis" ? "Reference only" : book.registered_copies === 0 ? "Not on the shelf yet" : `${book.available} of ${book.registered_copies ?? book.copies} copies available`}</p>{book.location && <small>{book.location}</small>}</div>
        <button className="service-button" disabled={busy || dataLoading || !!props.activeError || reserved || !eligible} onClick={() => void handleReserve(book)}>{reservingId === book.id ? <><Loader2 className="animate-spin" aria-hidden="true" />Reserving…</> : reserved ? "Reserved" : !eligible ? "Unavailable" : "Reserve"}</button>
      </article>;
    })}
    {!catalogLoading && !props.catalogError && <ReservationPagination pagination={pagination} onPageChange={onPageChange} />}
  </section><aside className="reservation-sidebar" aria-label="Your reservations">
    <div className="reservation-sidebar-heading"><h2>Your reservations <span className="service-chip">{dataLoading || props.activeError ? "—" : activeReservations.length}</span></h2><p>Held for 48 hours. Bring your student or employee ID to the front desk to claim a book. Unclaimed reservations expire automatically.</p></div>
    {props.activeError ? <div className="service-error" role="alert"><p>{props.activeError}</p><button className="service-link" onClick={props.onRetryActive}>Try again</button></div> : dataLoading ? <p className="service-empty" role="status">Loading your reservations…</p> : !activeReservations.length ? <p className="service-empty">No active reservations. Reserve a book from the list.</p> : activeReservations.map(res => {
      const expiry = expiryLabel(res.expires_at, now);
      return <div className="reservation-held" key={res.id}><h3>{res.title}</h3><small>{res.author}</small>{res.location && <small>{res.location}</small>}
        <div className="reservation-held-meta"><div><small>{res.status === "ready" ? "Pick up by" : "Expires"}</small><br /><strong>{expiry?.date ?? "Not yet set"}</strong>{expiry && <small> · {expiry.remaining}</small>}</div><span className={"reservation-status " + (res.status === "ready" ? "is-ready" : "")}>{res.status === "ready" ? <CheckCircle2 aria-hidden="true" /> : <Clock aria-hidden="true" />}{res.status === "ready" ? "Ready" : "Pending"}</span></div>
        {res.notes && <p className="reservation-notes">{res.notes}</p>}
        {res.status === "pending" && (confirmId === res.id ? <div className="reservation-confirm"><span>Cancel this reservation?</span><button className="service-button is-outline" disabled={busy} onClick={() => void handleCancel(res)}>{cancellingId === res.id ? "Cancelling…" : "Yes, cancel"}</button><button className="service-link" disabled={busy} onClick={() => setConfirmId(null)}>Keep it</button></div> : <button className="service-link" disabled={busy} aria-label={`Cancel reservation for ${res.title}`} onClick={() => setConfirmId(res.id)}>Cancel reservation</button>)}
      </div>;
    })}
  </aside></div>;
}

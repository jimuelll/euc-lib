import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, Loader2 } from "@/components/ui/library-glyphs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatLibraryDateTime } from "@/utils/libraryTime";
import type { CatalogBook, ActiveReservation } from "../types";
import { cancelReservation, reserveBook } from "../api";
import ReservationPagination from "../components/ReservationPagination";

interface ReserveTabProps {
  selected?: boolean; onClearSelection?: () => void;
  catalog: CatalogBook[]; activeReservations: ActiveReservation[]; catalogLoading: boolean; dataLoading: boolean; hasSearched: boolean;
  catalogError: string | null; activeError: string | null; onRetryCatalog?: () => void; onRetryActive: () => void; searchField: ReactNode;
  pagination: { page: number; totalPages: number; total: number }; onPageChange: (page: number) => void;
  onReserveSuccess: (reservation: ActiveReservation, bookId: number) => void; onCancelSuccess: (id: number) => void;
}
const isReservable = (book: CatalogBook) => Number(book.reservations_full) !== 1 && book.material_type !== "thesis" && book.canReserve !== false && Number(book.canReserve) !== 0 && Number(book.registered_copies ?? book.copies) > 0 && Number(book.available) > 0;
const colors = ["#7a0000", "#5c1a1a", "#3d2b3d", "#4a2c1c", "#2b3a42"];
function expiryLabel(value: string | null, now: number) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const minutes = Math.floor((timestamp - now) / 60000);
  return { date: formatLibraryDateTime(value), remaining: minutes <= 0 ? "Expired" : minutes >= 1440 ? `in ${Math.floor(minutes / 1440)} d ${Math.floor(minutes % 1440 / 60)} h` : `in ${Math.floor(minutes / 60)} h ${minutes % 60} m` };
}
export default function ReserveTab(props: ReserveTabProps) {
  const { catalog, activeReservations, catalogLoading, dataLoading, hasSearched, pagination, onPageChange, onReserveSuccess, onCancelSuccess } = props;
  const [reservingId, setReservingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [confirmationBook, setConfirmationBook] = useState<CatalogBook | null>(null);
  const [confirmationError, setConfirmationError] = useState("");
  const messageRef = useRef<HTMLParagraphElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const reservationInFlight = useRef(false);
  const focusSuccess = useRef(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  const reserveMutation = useMutation({ mutationFn: reserveBook });
  const cancelMutation = useMutation({ mutationFn: cancelReservation });
  const reservedIds = new Set(activeReservations.map(res => res.book_id));
  const hasActiveReservation = activeReservations.length > 0;
  const { hash } = useLocation();
  const targetId = /^#reservation-([1-9]\d*)$/.exec(hash)?.[1];
  const targetPresent = activeReservations.some(res => String(res.id) === targetId);
  useEffect(() => {
    if (dataLoading || props.activeError || !targetId || !targetPresent) return;
    const card = document.getElementById(`reservation-${targetId}`);
    card?.focus();
    card?.scrollIntoView?.({ block: "center", behavior: "auto" });
  }, [targetId, targetPresent, dataLoading, props.activeError]);
  const busy = reservingId !== null || cancellingId !== null;
  const currentConfirmationBook = catalog.find(book => book.id === confirmationBook?.id);
  const confirmationEligible = !!currentConfirmationBook && isReservable(currentConfirmationBook) && !hasActiveReservation && !dataLoading && !props.activeError;
  const handleReserve = async () => {
    if (reservationInFlight.current || !confirmationEligible || !currentConfirmationBook) return;
    const book = currentConfirmationBook;
    reservationInFlight.current = true;
    setReservingId(book.id); setMessage(""); setConfirmationError("");
    try {
      const result = await reserveMutation.mutateAsync(book.id);
      const notice = "Reservation submitted. Wait for a Ready notification before visiting the library.";
      setMessage(notice); toast.success(notice);
      focusSuccess.current = true;
      setConfirmationBook(null);
      onReserveSuccess({ id: result.reservationId, book_id: book.id, title: book.title, author: book.author, status: "pending", reserved_at: new Date().toISOString(), expires_at: result.expiresAt }, book.id);
    } catch (error) { setConfirmationError(getApiErrorMessage(error, "Failed to reserve book. Please try again.")); }
    finally { reservationInFlight.current = false; setReservingId(null); }
  };
  const handleCancel = async (res: ActiveReservation) => {
    setCancellingId(res.id); setMessage("");
    try { await cancelMutation.mutateAsync(res.id); onCancelSuccess(res.id); setConfirmId(null); setMessage(`Reservation for “${res.title}” cancelled.`); toast.success("Reservation cancelled"); }
    catch (error) { const notice = getApiErrorMessage(error, "Failed to cancel reservation"); setMessage(notice); toast.error(notice); }
    finally { setCancellingId(null); }
  };
  return <div className={`reservation-layout${props.selected ? " is-selected" : ""}`}><section className="reservation-catalogue" aria-label="Books to reserve">
    {props.searchField}<p className="reservation-message" role="status" tabIndex={-1} ref={messageRef}>{message}</p>
    <h2 className="reservation-section-label">{hasSearched || props.selected ? catalogLoading ? "Searching…" : `${pagination.total} result${pagination.total === 1 ? "" : "s"}` : "Browse books to reserve"}</h2>
    {props.selected && <button className="service-link" onClick={props.onClearSelection}>Browse all books</button>}
    {hasActiveReservation && <p className="text-sm text-muted-foreground">You can reserve one book at a time. Complete or cancel your current reservation before reserving another.</p>}
    {props.catalogError ? <div className="service-error" role="alert"><p>{props.catalogError}</p>{props.onRetryCatalog && <button className="service-link" onClick={props.onRetryCatalog}>Try again</button>}</div> : catalogLoading ? <div className="service-loading" role="status" aria-label="Loading books">{[0, 1, 2].map(id => <Skeleton key={id} className="h-24 w-full" />)}</div> : catalog.length === 0 ? <p className="service-empty">{props.selected ? "This book is no longer available in the reservation catalogue. Browse all books to choose another title." : hasSearched ? "No titles match. Try a title, an author, or an ISBN." : "No books are currently listed for reservation."}</p> : catalog.map(book => {
      const reserved = reservedIds.has(book.id);
      const full = Number(book.reservations_full) === 1;
      const eligible = isReservable(book);
      const initials = book.title.replace(/^(the|a)\s/i, "").split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
      return <article className="reservation-book" key={book.id}>
        <div className="reservation-cover" aria-hidden="true" style={{ "--reservation-cover-color": colors[book.id % colors.length] } as CSSProperties}>{initials}</div>
        <div className="reservation-book-copy"><h3>{book.title}</h3><small>{book.author || "Unknown author"}</small><p className={"reservation-book-availability " + (book.available > 0 ? "is-available" : "")}>{book.material_type === "thesis" ? "Reference only" : book.registered_copies === 0 ? "Not on the shelf yet" : `${book.available} of ${book.registered_copies ?? book.copies} copies available`}</p></div>
        <button className="service-button" disabled={busy || dataLoading || !!props.activeError || hasActiveReservation || !eligible} onClick={event => { triggerRef.current = event.currentTarget; focusSuccess.current = false; setConfirmationError(""); setConfirmationBook(book); }}>{reservingId === book.id ? <><Loader2 className="animate-spin" aria-hidden="true" />Reserving…</> : reserved ? "Reserved" : full ? "Reservations full" : Number(book.available) === 0 && Number(book.registered_copies ?? book.copies) > 0 ? "No copies available" : !eligible ? "Unavailable" : "Reserve"}</button>
      </article>;
    })}
    {!props.selected && !catalogLoading && !props.catalogError && <ReservationPagination pagination={pagination} onPageChange={onPageChange} />}
  </section><aside className="reservation-sidebar" aria-label="Your reservations">
    <div className="reservation-sidebar-heading"><h2>Your reservations <span className="service-chip">{dataLoading || props.activeError ? "—" : activeReservations.length}</span></h2><p>Once marked ready, you have 24 hours to pick up your book. Bring your student or employee ID to the front desk.</p></div>
    {targetId && !dataLoading && !props.activeError && !targetPresent && <p role="status">This reservation is no longer active.</p>}
    {props.activeError ? <div className="service-error" role="alert"><p>{props.activeError}</p><button className="service-link" onClick={props.onRetryActive}>Try again</button></div> : dataLoading ? <p className="service-empty" role="status">Loading your reservations…</p> : !activeReservations.length ? <p className="service-empty">No active reservations. Reserve a book from the list.</p> : activeReservations.map(res => {
      const expiry = expiryLabel(res.expires_at, now);
      return <div className="reservation-held" id={`reservation-${res.id}`} tabIndex={-1} aria-label={`Reservation for ${res.title}`} key={res.id}><h3>{res.title}</h3><small>{res.author}</small>
        <div className="reservation-held-meta"><div><small>{res.status === "ready" ? "Pick up by" : "Waiting expires"}</small><br /><strong>{expiry?.date ?? "Not yet set"}</strong>{expiry && <small> · {expiry.remaining}</small>}</div><span className={"reservation-status " + (res.status === "ready" ? "is-ready" : "")}>{res.status === "ready" ? <CheckCircle2 aria-hidden="true" /> : <Clock aria-hidden="true" />}{res.status === "ready" ? "Ready" : "Pending"}</span></div>
        {res.notes && <p className="reservation-notes">{res.notes}</p>}
        {res.status === "pending" && (confirmId === res.id ? <div className="reservation-confirm"><span>Cancel this reservation?</span><button className="service-button is-outline" disabled={busy} onClick={() => void handleCancel(res)}>{cancellingId === res.id ? "Cancelling…" : "Yes, cancel"}</button><button className="service-link" disabled={busy} onClick={() => setConfirmId(null)}>Keep it</button></div> : <button className="service-link" disabled={busy} aria-label={`Cancel reservation for ${res.title}`} onClick={() => setConfirmId(res.id)}>Cancel reservation</button>)}
      </div>;
    })}
  </aside>
    <AlertDialog open={confirmationBook !== null} onOpenChange={open => { if (!open && !reservationInFlight.current) setConfirmationBook(null); }}>
      <AlertDialogContent className="reservation-confirmation max-h-[calc(100dvh-2rem)] overflow-y-auto"
        onEscapeKeyDown={event => { if (reservationInFlight.current) event.preventDefault(); }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (focusSuccess.current) { messageRef.current?.focus(); focusSuccess.current = false; }
          else triggerRef.current?.focus();
        }}>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm reservation</AlertDialogTitle>
          <AlertDialogDescription>Review your book and pickup instructions before submitting.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="reservation-confirmation-book"><h3>{confirmationBook?.title}</h3><p>{confirmationBook?.author || "Unknown author"}</p></div>
        <div className="reservation-confirmation-guidance">
          <p>Your reservation starts as <strong>Pending</strong>. Wait until the library marks it <strong>Ready</strong> before heading to the library.</p>
          <p>You’ll receive a library notification when it’s ready.</p>
          <p>Once ready, collect it within <strong>24 hours</strong> and bring your student or employee ID.</p>
          <p>Pending reservations expire after 24 hours unless marked ready.</p>
        </div>
        {confirmationError && <p className="text-sm text-destructive" role="alert">{confirmationError}</p>}
        {confirmationBook && !confirmationEligible && !busy && <p className="text-sm text-destructive" role="alert">This book cannot be reserved right now. Go back to review its availability and your reservations.</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Go back</AlertDialogCancel>
          <Button disabled={busy || !confirmationEligible} onClick={() => void handleReserve()}>
            {reservingId !== null ? <><Loader2 className="animate-spin" aria-hidden="true" />Reserving…</> : "Confirm reservation"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

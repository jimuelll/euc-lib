import { LibraryAvailability } from "@/components/ui/library-patterns";
import {useSearchParams} from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

import { Skeleton } from "@/components/ui/skeleton";
import { AdminDetailDrawer, AdminIcon, CompactPanel, AdminPageHeader, AdminSummaryTile, AdminFilterChips, AdminStatusBadge, AdminSelectionCheckbox } from "@/features/admin";
import ReservationRowActions from "./components/ReservationRowActions";
import { useReservations } from "./hooks/useReservations";
import type { AdminReservation } from "./reservations.types";
import "@/features/admin/compact-admin.css";
import "./reservations.css";

const day = (value: string) => new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
const stamp = (value: string) => new Date(value).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const closed = (row: AdminReservation) => ["fulfilled", "cancelled", "expired"].includes(row.status);
export function reservationTiming(row: AdminReservation, now = Date.now()) {
  if (closed(row)) return { text: row.status === "fulfilled" ? "Pickup completed" : row.status === "cancelled" ? "Hold cancelled" : "Pickup window ended", tone: row.status === "expired" ? "red" : "neutral" };
  if (row.expires_at) {
    const hours = (new Date(row.expires_at).getTime() - now) / 3_600_000;
    return { text: hours <= 0 ? "Pickup window ended" : hours < 1 ? "Expires in under an hour" : hours < 24 ? `Expires in ${Math.ceil(hours)} hours` : `Expires in ${Math.ceil(hours / 24)} days`, tone: hours <= 6 ? "red" : hours <= 24 ? "amber" : "green" };
  }
  const days = Math.max(0, Math.floor((now - new Date(row.reserved_at).getTime()) / 86_400_000));
  return { text: row.status === "pending" ? days ? `Waiting ${days} ${days === 1 ? "day" : "days"}` : "Requested today" : "No pickup deadline set", tone: row.status === "pending" ? days >= 7 ? "amber" : "neutral" : "green" };
}
export function preparationBlocker(row: AdminReservation) {
  if (row.status !== "pending") return undefined;
  if (row.available_copies === undefined) return "Copy availability is unavailable. Refresh before preparing this hold.";
  return Number(row.available_copies) > 0 ? undefined : "No copy available. Wait for a copy to be returned before marking ready.";
}
const labels = { pending: "Pending", ready: "Ready", fulfilled: "Fulfilled", cancelled: "Cancelled", expired: "Expired" };

export default function AdminReservations() {
  const desk = useReservations();
  const [auditParams]=useSearchParams(),openedRecord=useRef(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [detail, setDetail] = useState<AdminReservation | null>(null);
  const [cancelRows, setCancelRows] = useState<AdminReservation[]>([]);
  const [reason, setReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => setSelected([]), [desk.statusFilter, desk.page, desk.search, desk.showArchived]);
  const rows = desk.data?.rows ?? [];
  useEffect(()=>{const id=Number(auditParams.get("recordId"));if(id&&openedRecord.current!==id){const match=rows.find(row=>row.id===id);if(match){openedRecord.current=id;setDetail(match);}}},[rows,auditParams]);
  const summary = desk.data?.summary;
  const busy = desk.actionId !== null || desk.bulkBusy || cancelBusy;
  const selectedRows = rows.filter(row => selected.includes(row.id) && !closed(row));
  const preparableRows = selectedRows.filter(row => row.status === "pending" && !preparationBlocker(row));
  const ready = rows.filter(row => row.status === "ready").sort((a, b) => (a.expires_at ? new Date(a.expires_at).getTime() : Infinity) - (b.expires_at ? new Date(b.expires_at).getTime() : Infinity));
  const pending = rows.filter(row => row.status === "pending").sort((a, b) => new Date(a.reserved_at).getTime() - new Date(b.reserved_at).getTime());
  const terminal = rows.filter(closed);
  const closedCount = summary ? summary.fulfilled_count + summary.cancelled_count + summary.expired_count : undefined;
  const counts: Record<string, number | undefined> = { needs_action: summary ? summary.pending_count + summary.ready_count : undefined, pending: summary?.pending_count, ready: summary?.ready_count, attention: summary?.expiring_count !== undefined ? summary.expiring_count + summary.expired_count : undefined, closed: closedCount, all: summary?.total_records };
  const openCancel = (items: AdminReservation[]) => { opener.current = document.getElementById(`reservation-detail-${items[0]?.id}`) || document.activeElement as HTMLElement; setReason(""); setCancelRows(items); };
  const showDetails = (row: AdminReservation) => { opener.current = document.getElementById(`reservation-detail-${row.id}`) || document.activeElement as HTMLElement; setDetail(row); };
  const onCancel = (id: number) => { const row = rows.find(item => item.id === id); if (row) openCancel([row]); };
  const actions = (row: AdminReservation) => <ReservationRowActions id={row.id} title={row.book_title} status={row.status} isActing={busy || desk.loading} showArchived={desk.showArchived} preparationBlocker={preparationBlocker(row)} onMarkReady={desk.handleMarkReady} onFulfill={() => void desk.handleFulfill(row)} onCancel={onCancel} onArchive={desk.handleArchive} onRestore={desk.handleRestore} onDetails={() => showDetails(row)} />;
  const renderRows = (items: AdminReservation[]) => <ul className="reservation-list">{items.map(row => {
    const timing = reservationTiming(row);
    return <li key={row.id} className="reservation-row" onClick={event => { if (!(event.target as HTMLElement).closest("button,input,label,a")) showDetails(row); }}>
      <div className="reservation-book">
        {!desk.showArchived && !closed(row) && <AdminSelectionCheckbox label={`Select reservation ${row.id} for ${row.user_name}`} checked={selected.includes(row.id)} disabled={busy || desk.loading} onChange={checked => setSelected(ids => checked ? [...ids, row.id] : ids.filter(id => id !== row.id))} />}
        <span className="reservation-book-icon"><AdminIcon name="catalog" /></span><div><button id={`reservation-detail-${row.id}`} className="reservation-title" title={row.book_title} onClick={() => showDetails(row)}>{row.book_title}</button><p className="reservation-secondary">{row.book_author}</p>
          {row.status === "pending" && <p className="reservation-secondary">{row.available_copies === undefined ? <>Copy availability unavailable{row.queue_position !== undefined && Number(row.queue_position) > 1 ? ` · Queue #${row.queue_position}` : ""}</> : <LibraryAvailability available={Number(row.available_copies)}><span data-unavailable={Number(row.available_copies) === 0 ? true : undefined}>{Number(row.available_copies) === 0 ? "No copy available" : `${row.available_copies} ${Number(row.available_copies) === 1 ? "copy" : "copies"} available`}{row.queue_position !== undefined && Number(row.queue_position) > 1 ? ` · Queue #${row.queue_position}` : ""}</span></LibraryAvailability>}</p>}
        </div>
      </div>
      <div className="reservation-patron"><strong>{row.user_name}</strong><span className="reservation-id">{row.student_employee_id}</span><span className="reservation-secondary">Reserved {day(row.reserved_at)}</span></div>
      <div className="reservation-state"><AdminStatusBadge status={row.status}><AdminIcon name={row.status === "ready" ? "reservations" : row.status === "pending" ? "clock" : row.status === "fulfilled" ? "borrow" : "close"} />{labels[row.status]}</AdminStatusBadge><span className="reservation-timing" data-tone={timing.tone} title={row.expires_at ? `Expires ${stamp(row.expires_at)}` : undefined}>{timing.text}</span></div>
      {actions(row)}
    </li>;
  })}</ul>;
  const group = (title: string, id: string, items: AdminReservation[]) => items.length ? <CompactPanel title={`${title} · ${items.length}`} id={id}>{renderRows(items)}</CompactPanel> : null;
  return <div className="reservations-page" aria-busy={desk.loading}>
    {desk.confirmDialog}
    <AdminPageHeader title="Reservations" subtitle="Prepare holds and process patron pickups through Borrow & Return." updatedAt={desk.updatedAt} loading={desk.loading || busy} onRefresh={() => void desk.fetchReservations()} actions={<Button variant="outline" className="admin-compact-button" disabled={busy} onClick={desk.handleToggleArchived}><AdminIcon name="archive" />{desk.showArchived ? "View active reservations" : "View archive"}</Button>} />
    {desk.error && <div role="alert" className="reservation-error"><span>{desk.error}{desk.data && " Showing the last available records."}</span><Button variant="outline" onClick={() => void desk.fetchReservations()}>Try again</Button></div>}
    {!desk.showArchived && <section aria-label="Outstanding reservations" className="reservation-summary">{[
      { label: "Ready for pickup", filter: "ready", tone: "green", icon: "reservations" as const, count: counts.ready, hint: summary?.soonest_expiry ? `Soonest expiry ${stamp(summary.soonest_expiry)}` : "Prepared holds awaiting pickup" },
      { label: "Pending to prepare", filter: "pending", tone: "amber", icon: "clock" as const, count: counts.pending, hint: "Oldest requests first" },
      { label: "Expiring soon / expired", filter: "attention", tone: "red", icon: "expiring" as const, count: counts.attention, hint: "Pickup deadlines within 24 hours or ended" },
    ].map(tile => <AdminSummaryTile key={tile.filter} label={tile.label} value={tile.count} tone={tile.tone as "red" | "green" | "amber"} icon={tile.icon} ariaLabel={`${tile.label}: ${tile.count === undefined ? "unavailable" : tile.count}`} hint={tile.hint} selected={desk.statusFilter === tile.filter} disabled={busy} onSelect={() => desk.handleStatusChange(tile.filter)} />)}</section>}
    <div className="reservation-filters">{!desk.showArchived && <AdminFilterChips label="Reservation status" value={desk.statusFilter} disabled={busy} onChange={desk.handleStatusChange} items={[{value:"needs_action",label:"Needs action",count:counts.needs_action},{value:"closed",label:"Closed",count:counts.closed},{value:"all",label:"All",count:counts.all}]} />}<label className="reservation-search"><AdminIcon name="search" /><span className="sr-only">Search reservations</span><input placeholder="Search patron, ID, book or author" value={desk.search} disabled={busy} onChange={event => desk.handleSearchChange(event.target.value)} /></label></div>
    {desk.showArchived && <p className="reservation-secondary">Archived records can be restored to the reservation list.</p>}
    {!!selectedRows.length && <div className="reservation-bulk" role="region" aria-label="Selected reservations"><strong aria-live="polite">{selectedRows.length} selected</strong><Button className="admin-compact-button" disabled={busy || desk.loading || !preparableRows.length} onClick={async () => { await desk.handleBulk("ready", preparableRows); setSelected([]); }}>Mark ready</Button><Button variant="outline" disabled={busy || desk.loading} onClick={() => openCancel(selectedRows)}>Cancel…</Button><Button variant="ghost" disabled={busy} onClick={() => setSelected([])}>Clear</Button></div>}
    {desk.initialLoading ? <div aria-label="Loading reservations" className="reservation-loading">{[0,1,2].map(id => <Skeleton key={id} className="h-24 w-full" />)}</div> : desk.data && <>
      {group(desk.showArchived ? "Archived ready reservations" : "Ready for pickup", "reservation-ready", ready)}
      {group("Waiting to be prepared", "reservation-pending", pending)}
      {!rows.length && <div className="reservation-empty"><AdminIcon name="reservations" /><h2>{desk.statusFilter === "needs_action" && !desk.showArchived && !desk.search ? "All caught up" : "No reservations found"}</h2><p className="reservation-secondary">{desk.search ? "Try another patron, ID or book title." : desk.showArchived ? "Closed reservations appear here after archiving." : "No reservations need action. Ready and pending holds will appear here."}</p>{desk.statusFilter === "needs_action" && !desk.showArchived && !desk.search && <Button variant="outline" onClick={() => desk.handleStatusChange("closed")}>View closed reservations</Button>}</div>}
      {(terminal.length > 0 || (!desk.showArchived && desk.statusFilter === "needs_action")) && <details className="reservation-closed admin-compact-panel" open={desk.statusFilter === "closed" || desk.showArchived || undefined}><summary><span>Closed <span className="reservation-secondary">{closedCount ?? "—"}</span></span>{!desk.showArchived && <Button variant="outline" className="admin-compact-button reservation-archive-closed" disabled={busy || desk.loading || !closedCount} onClick={event => { event.preventDefault(); event.stopPropagation(); void desk.handleArchiveClosed(); }}>Archive all closed{desk.search ? " matching search" : ""}…</Button>}</summary>{terminal.length ? renderRows(terminal) : <div className="reservation-closed-body"><Button variant="outline" className="admin-compact-button" disabled={busy} onClick={() => desk.handleStatusChange("closed")}>View closed reservations</Button></div>}</details>}
      <footer className="reservation-footer"><span className="reservation-secondary">{desk.data.total ? `${(desk.page - 1) * 15 + 1}–${Math.min(desk.page * 15, desk.data.total)} of ${desk.data.total}` : "0 records"}{desk.loading && " · Updating…"}</span><div><Button variant="outline" disabled={desk.page <= 1 || desk.loading || busy} onClick={() => desk.setPage(desk.page - 1)}>Previous</Button><span className="reservation-secondary">Page {desk.page} of {Math.max(1, desk.data.totalPages)}</span><Button variant="outline" disabled={desk.page >= desk.data.totalPages || desk.loading || busy} onClick={() => desk.setPage(desk.page + 1)}>Next</Button></div></footer>
    </>}
    <Dialog open={!!cancelRows.length} onOpenChange={open => { if (!open && !cancelBusy) setCancelRows([]); }}><DialogContent className="reservation-dialog" onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }}><DialogHeader><DialogTitle>Cancel {cancelRows.length === 1 ? "reservation" : `${cancelRows.length} reservations`}?</DialogTitle><DialogDescription>This releases the hold and notifies the patron. Add a reason for the reservation record.</DialogDescription></DialogHeader><label htmlFor="reservation-cancel-reason">Cancellation reason</label><textarea id="reservation-cancel-reason" maxLength={500} rows={3} value={reason} disabled={cancelBusy} onChange={event => setReason(event.target.value)} placeholder="Why is this hold being cancelled?" /><DialogFooter><Button variant="outline" disabled={cancelBusy} onClick={() => setCancelRows([])}>Keep reservation</Button><Button variant="destructive" disabled={!reason.trim() || cancelBusy} onClick={async () => { setCancelBusy(true); try { if (cancelRows.length === 1) await desk.handleCancel(cancelRows[0].id, cancelRows[0].book_title, reason.trim()); else await desk.handleBulk("cancel", cancelRows, reason.trim()); setCancelRows([]); setSelected([]); } finally { setCancelBusy(false); } }}>{cancelBusy ? "Cancelling…" : "Cancel reservation"}</Button></DialogFooter></DialogContent></Dialog>
    <AdminDetailDrawer open={!!detail} onClose={() => setDetail(null)} title="Reservation details" description="Request, pickup deadline and patron information." className="reservation-detail" footer={detail ? actions(detail) : undefined} onAfterClose={() => opener.current?.focus()}>{detail && <><h3>{detail.book_title}</h3><p className="reservation-secondary">{detail.book_author}</p><dl><div><dt>Patron</dt><dd>{detail.user_name}<span className="reservation-id">{detail.student_employee_id}</span></dd></div><div><dt>Contact</dt><dd>{detail.patron_email || detail.patron_contact ? <>{detail.patron_email && <span>{detail.patron_email}</span>}{detail.patron_contact && <span>{detail.patron_contact}</span>}</> : "Not provided"}</dd></div><div><dt>Status</dt><dd>{labels[detail.status]}</dd></div><div><dt>Notes</dt><dd className="reservation-notes">{detail.notes || "No notes recorded"}</dd></div></dl><section className="reservation-request-history" aria-label="Request history"><h4>Request history</h4><ol><li><strong>Reserved</strong><time>{stamp(detail.reserved_at)}</time></li>{detail.expires_at && <li><strong>Pickup deadline</strong><time>{stamp(detail.expires_at)}</time></li>}<li><strong>Current status</strong><span>{labels[detail.status]}</span></li></ol></section></>}</AdminDetailDrawer>
  </div>;
}

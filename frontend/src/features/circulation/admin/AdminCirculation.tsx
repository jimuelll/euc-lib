import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { AdminIcon, CompactPanel, useAdminUrlState, AdminPageHeader, AdminPageTabs } from "@/features/admin";
import { TabsContent } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCirculationLog } from "./circulation.api";
import { fetchCirculationExport, circulationCsv } from "./circulation.export";
import { circulationKeys } from "./circulation.keys";
import { toast } from "@/components/ui/sonner";
import CirculationOverview from "./components/CirculationOverview";
import CirculationPatronCard from "./components/CirculationPatronCard";
import { Button } from "@/components/ui/button";
import { useCirculation } from "./hooks/useCirculation";
import BookLookup from "./components/BookLookup";
import ReturnLookup from "./components/ReturnLookup";
import CirculationLog from "./components/CirculationLog";
import TransactionTypePicker from "./components/TransactionTypePicker";
import UserLookup from "./components/UserLookup";
import "@/features/admin/compact-admin.css";
import "./circulation.css";

const date = (value: string) => new Date(value).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const currency = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);

export default function AdminCirculation() {
  const location = useLocation();
  const [params, patchParams] = useAdminUrlState();
  const history = params.get("tab") === "history";
  const client = useQueryClient();
  const overviewFilters = { page: 1, limit: 1 };
  const overview = useQuery({ queryKey: circulationKeys.log(overviewFilters), queryFn: ({ signal }) => getCirculationLog(overviewFilters, signal) });
  const [exporting, setExporting] = useState(false);
  const exportController = useRef<AbortController | null>(null);
  useEffect(() => () => exportController.current?.abort(), []);
  const exportRecords = async () => {
    if (exporting) return;
    setExporting(true);
    const controller = new AbortController(); exportController.current = controller;
    try {
      const filters = { status: history && params.get("archived") !== "true" ? (params.get("filter") ?? params.get("status")) || "needs_action" : undefined, archived: history && params.get("archived") === "true" || undefined, search: params.get("search") || undefined, dateFrom: params.get("dateFrom") || undefined, dateTo: params.get("dateTo") || undefined, limit: 50 };
      const rows = await fetchCirculationExport(filters, controller.signal);
      const csv = circulationCsv(rows);
      const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `circulation-${new Date().toISOString().slice(0,10)}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${rows.length} records exported`);
    } catch { if (!controller.signal.aborted) toast.error("Could not export records. Please retry."); } finally { setExporting(false); }
  };
  const [now, setNow] = useState(Date.now());

  const [fineBusy, setFineBusy] = useState(false);
  const [logRevision, setLogRevision] = useState(0);
  const checkout = (location.state as { checkoutReservation?: Parameters<typeof useCirculation>[0] } | null)?.checkoutReservation ?? null;
  const desk = useCirculation(checkout, () => setLogRevision(value => value + 1));
  const borrowing = desk.type === "borrow";
  const undoDeadline = Math.max(0, ...desk.sessionTransactions.filter(item => !item.undone).map(item => item.undoExpiresAt ? new Date(item.undoExpiresAt).getTime() : 0));
  useEffect(() => {
    if (undoDeadline <= Date.now()) return;
    setNow(Date.now());
    const timer = window.setInterval(() => { setNow(Date.now()); if (Date.now() >= undoDeadline) window.clearInterval(timer); }, 1000);
    return () => window.clearInterval(timer);
  }, [undoDeadline]);
  useEffect(() => { if (!history && desk.foundUser && !desk.foundCopy) document.getElementById("circulation-copy-input")?.focus(); }, [history, desk.foundUser, desk.foundCopy]);
  useEffect(() => { if (!history && desk.canSubmit && !fineBusy) { const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".circulation-confirm")); buttons.find(button => button.offsetParent !== null)?.focus(); } }, [history, desk.canSubmit, fineBusy]);
  useEffect(() => { if (!history && !desk.submitting && !desk.foundUser && !desk.returnPreview) document.getElementById(desk.type === "return" ? "circulation-accession-input" : "circulation-patron")?.focus(); }, [history, desk.submitting, desk.type, desk.foundUser, desk.returnPreview]);
  const loan = desk.returnPreview;
  const copy = desk.foundCopy;
  const copyBlocker = !copy ? null : desk.reservationCheckout && copy.book_id !== desk.reservationCheckout.book_id ? "Select a copy of the reserved book." : !copy.is_active ? "This copy is inactive." : !copy.accession_number ? "Add an accession number before borrowing." : copy.needs_policy ? "Configure this copy’s loan policy." : copy.accession_voided ? "This accession number has been voided." : copy.has_active_loan ? "This copy is already on loan." : copy.condition === "lost" ? "This copy is marked lost." : copy.is_reserved && !desk.reservationCheckout ? "This copy is prepared for a reservation." : copy.borrow_eligible === false || copy.borrow_eligible === 0 ? "This copy is unavailable for checkout." : null;
  const confirmationReason = desk.undoing ? "Undoing transaction…" : desk.submitting ? "Recording transaction…" : fineBusy ? "Finish recording the fine payment or waiver." : desk.lookingUpUser || desk.lookingUpCopy ? "Waiting for the lookup to finish." : borrowing
    ? !desk.foundUser && !copy ? "Select a patron and copy to continue." : !desk.foundUser ? "Select a patron to continue." : desk.clearance?.status === "blocked" ? "Resolve clearance before borrowing." : !copy ? "Select a copy to continue." : copyBlocker || (desk.clearance?.status !== "eligible" ? "Check patron clearance to continue." : "")
    : !loan ? "Scan a copy to find an active loan." : "";
  const transactions = borrowing ? desk.sessionTransactions.slice(0, 6) : desk.sessionTransactions.filter(item => item.type === "return");
  return <div className="circulation-page" data-mode={desk.type}>
    <AdminPageHeader title="Borrow & Return" subtitle="Record loans and returns, or review circulation history." updatedAt={history ? overview.dataUpdatedAt : undefined} loading={overview.isFetching} onRefresh={history ? () => void client.invalidateQueries({ queryKey: circulationKeys.logs() }) : undefined} actions={history ? <><Button variant="outline" onClick={() => patchParams({ tab: "history", archived: params.get("archived") === "true" ? null : "true" })}><AdminIcon name="archive" />{params.get("archived") === "true" ? "View history" : "View archive"}</Button><Button variant="outline" disabled={exporting} onClick={() => void exportRecords()}><AdminIcon name="reports" />{exporting ? "Exporting..." : "Export"}</Button></> : undefined} />
    <AdminPageTabs value={history ? "history" : "transaction"} onChange={tab => patchParams({ tab, mode: desk.type, transaction: null })} label="Circulation views" items={[{ value: "transaction", label: "Desk transaction", icon: "circulation" }, { value: "history", label: "Transaction history", icon: "transactions", badge: overview.data?.summary?.overdue_count, badgeTone: "attention", badgeDescription: "overdue loans", descriptionId: "circulation-history-overdue" }]}>
      <TabsContent value="history" className="circulation-tab-content">
        {history && <>

          {overview.isError && <p role="alert" className="circulation-error">{overview.data ? "Could not refresh totals. Showing the last loaded data." : "Could not load loan totals."} <button type="button" onClick={() => void overview.refetch()}>Retry</button></p>}
          <CirculationOverview summary={overview.data?.summary} loading={overview.isPending} />
          <CirculationLog refreshKey={logRevision} />
        </>}
      </TabsContent>
      <TabsContent value="transaction" className="circulation-tab-content">
    {!history && <div className="circulation-desk-grid">
      <div className="circulation-desk-main"><CompactPanel title="Desk transaction" id="desk-transaction-heading" actions={<TransactionTypePicker value={desk.type} onChange={desk.handleTypeChange} disabled={desk.submitting || desk.undoing || fineBusy || Boolean(desk.reservationCheckout)} />}>
        <div className="circulation-panel-body">
          <p className="circulation-secondary">{borrowing ? "Identify the patron and copy, then confirm the loan." : "Scan each copy and confirm its return. The borrower is identified automatically."}</p>
          {desk.reservationCheckout && <p className="circulation-notice">Reservation checkout for <strong>{desk.reservationCheckout.user_name}</strong> · {desk.reservationCheckout.book_title}</p>}
          {borrowing ? <>
            <section className="circulation-step" aria-labelledby="patron-step"><h3 id="patron-step"><span>1</span>Patron</h3><UserLookup studentId={desk.studentId} onStudentIdChange={desk.setStudentId} onLookup={desk.handleLookupUser} lookingUp={desk.lookingUpUser} foundUser={desk.foundUser} disabled={desk.submitting || desk.undoing || fineBusy || Boolean(desk.reservationCheckout)} />{desk.foundUser && <CirculationPatronCard patron={{ user: desk.foundUser, activeBorrows: desk.activeBorrows, clearance: desk.clearance! }} />}{desk.userLookupError && <p role="alert" className="circulation-error">{desk.userLookupError} <button type="button" disabled={desk.submitting} onClick={() => void desk.handleLookupUser(desk.reservationCheckout?.student_employee_id)}>Retry</button></p>}</section>
            <section className="circulation-step" aria-labelledby="copy-step"><h3 id="copy-step"><span>2</span>Copy</h3><BookLookup copyBarcode={desk.copyBarcode} onCopyBarcodeChange={desk.setCopyBarcode} onLookup={desk.handleLookupCopy} onSelectCopy={value => { desk.setCopyBarcode(value); void desk.handleLookupCopy(value); }} lookingUp={desk.lookingUpCopy} disabled={desk.submitting || desk.undoing} foundCopy={desk.foundCopy} />{desk.copyLookupError && <p role="alert" className="circulation-error">{desk.copyLookupError}</p>}</section>
          </> : <ReturnLookup identifier={desk.copyBarcode} onIdentifierChange={desk.handleReturnIdentifierChange} onLookup={value => void desk.handleLookupReturn(value, true)} onConfirm={() => { if (desk.canSubmit && !fineBusy) void desk.handleSubmit(); }} lookingUp={desk.lookingUpCopy} submitting={desk.submitting || desk.undoing || fineBusy} onFineBusyChange={setFineBusy} preview={desk.returnPreview} receipt={desk.returnReceipt} error={desk.returnLookupError} />}
        {!borrowing && loan && <CirculationPatronCard returnPatronId={loan.student_employee_id} />}
        </div>
      </CompactPanel>
      </div>
      <CompactPanel title="Transaction summary" id="circulation-summary-heading" className="circulation-summary"><div className="circulation-panel-body">
        <dl className="circulation-summary-details"><div><dt>Patron</dt><dd className={(borrowing ? !desk.foundUser : !loan) ? "circulation-summary-placeholder" : undefined}>{borrowing ? desk.foundUser?.name || "Not selected" : loan?.user_name || "Identified after scan"}{borrowing && desk.foundUser && <span className="circulation-secondary">{desk.activeBorrows.length} active {desk.activeBorrows.length === 1 ? "loan" : "loans"}{desk.clearance ? ` · ${desk.clearance.outstandingAmount > 0 ? currency(desk.clearance.outstandingAmount) + " unpaid" : "no unpaid fines"}` : " · clearance unavailable"}</span>}{!borrowing && loan && <span className="circulation-mono">{loan.student_employee_id}</span>}</dd></div>
          <div><dt>Copy</dt><dd className={(borrowing ? !copy : !loan) ? "circulation-summary-placeholder" : undefined}>{borrowing ? copy?.title || "Not selected" : loan?.title || "Not selected"}{(borrowing ? copy : loan) && <span className="circulation-secondary">{borrowing ? copy?.accession_number || copy?.barcode : loan?.accession_number || loan?.copy_barcode}</span>}</dd></div>
          <div><dt>{borrowing ? "Estimated due" : "Due"}</dt><dd className={(borrowing ? !copy?.due_date_preview : !loan) ? "circulation-summary-placeholder" : undefined}>{borrowing ? copy?.due_date_preview ? date(copy.due_date_preview) : copy ? "Unavailable until checkout" : "Set after copy is selected" : loan ? date(loan.due_date) : "Shown after scan"}</dd></div>
        </dl>
        {borrowing && desk.clearance?.status === "eligible" && <p className="circulation-success"><AdminIcon name="clearance" />Patron cleared to borrow</p>}
        {borrowing && desk.clearance?.status === "blocked" && <div className="circulation-blocker"><strong>Clearance required</strong>{desk.clearance.reasons.map(reason => <p key={reason}>{reason}</p>)}<Link to={`/admin/clearance?student_employee_id=${encodeURIComponent(desk.foundUser!.student_employee_id)}`}>Open clearance</Link></div>}
        {borrowing && copyBlocker && <p className="circulation-blocker"><AdminIcon name="warning" />{copyBlocker}</p>}
        {borrowing && copy?.condition === "damaged" && <p className="circulation-notice">Damaged copy. Confirmation includes an inspection check.</p>}
        {desk.submissionError && <p role="alert" className="circulation-error">{desk.submissionError}</p>}
        <Button aria-describedby={confirmationReason ? "circulation-confirm-reason" : undefined} className="circulation-confirm" data-mode={desk.type} onClick={() => void desk.handleSubmit()} disabled={!desk.canSubmit || fineBusy}><AdminIcon name={desk.submitting ? "refresh" : desk.type} className={desk.submitting ? "animate-spin" : ""} />{desk.submitting ? "Recording…" : borrowing ? "Confirm borrow" : "Confirm return"}</Button>
        {confirmationReason && <p id="circulation-confirm-reason" className="circulation-secondary circulation-confirm-reason" aria-live="polite">{confirmationReason}</p>}
        <p className="circulation-secondary circulation-summary-hint">{borrowing ? "The book’s loan policy sets the final due date at checkout." : "Returning a copy does not settle unpaid fines."}</p>
        {borrowing && desk.completed && <p role="status" className="circulation-success">{desk.completed}</p>}
      </div></CompactPanel>
    <CompactPanel title={borrowing ? "Recently processed this session" : "Returned this session"} id="circulation-session-heading" className="circulation-session">
        {transactions.length ? <ul tabIndex={0} aria-label={borrowing ? "Recent session transactions" : "Session returns"}>{transactions.map((item, index) => <li key={`${item.occurredAt}-${index}`}><AdminIcon name={item.type} className={item.type === "return" ? "circulation-success" : "circulation-borrowed"} /><div><strong>{item.patron}</strong> {item.type === "return" ? "returned" : "borrowed"} {item.title}{item.undone && <span className="circulation-secondary"> · Undone</span>}<time className="circulation-secondary">{new Date(item.occurredAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</time></div>{item.undoToken && !item.undone && item.undoExpiresAt && new Date(item.undoExpiresAt).getTime() > now && <Button variant="outline" size="sm" disabled={desk.submitting || desk.undoing || fineBusy} title="Undo is available for 60 seconds and only while the record is unchanged" onClick={() => void desk.handleUndo(item.borrowingId)}>Undo · {Math.max(1, Math.ceil((new Date(item.undoExpiresAt).getTime() - now) / 1000))}s</Button>}</li>)}</ul> : <p className="circulation-panel-body circulation-secondary">{borrowing ? "No transactions yet this shift." : "No returns yet this session."}</p>}
      </CompactPanel>
    </div>}
    {!history && <div className="circulation-mobile-confirm" role="region" aria-label="Transaction confirmation"><div><strong>{borrowing ? desk.foundUser?.name || "Select a patron" : loan?.user_name || "Scan a copy"}</strong><span className="circulation-secondary">{borrowing && desk.clearance?.status === "blocked" ? "Clearance required" : borrowing ? copy?.title || "Select a copy to continue" : loan?.title || "Find a loan to continue"}</span></div><Button data-mode={desk.type} className="circulation-confirm" disabled={!desk.canSubmit || fineBusy} onClick={() => void desk.handleSubmit()}>{desk.submitting ? "Recording…" : borrowing ? "Confirm borrow" : "Confirm return"}</Button></div>}
      </TabsContent>
    </AdminPageTabs>
  </div>;
}

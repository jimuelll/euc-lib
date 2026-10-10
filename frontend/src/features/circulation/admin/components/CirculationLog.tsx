import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

import { AdminDetailDrawer, AdminIcon, AdminFilterChips, AdminStatusBadge, CompactPanel, useAdminConfirmDialog, useAdminUrlState } from "@/features/admin";
import { useAuth } from "@/context/AuthContext";
import CirculationDateRange from "./CirculationDateRange";
import { toast } from "@/components/ui/sonner";
import { getApiErrorMessage } from "@/utils/apiError";
import { useDebounce } from "@/hooks/use-debounce";
import { getCirculationLog, archiveBorrowing, restoreBorrowing, type CirculationLogEntry, type CirculationLogResult } from "../circulation.api";
import { circulationKeys } from "../circulation.keys";

const day = (value: string) => new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
const time = (value: string) => new Date(value).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
const statusLabel = { borrowed: "Active", overdue: "Overdue", returned: "Returned" } as const;
const statusIcon = { borrowed: "borrow", overdue: "overdue", returned: "return" } as const;
const overdueDays = (row: CirculationLogEntry) => Math.max(1, Math.ceil(Number(row.hours_overdue) / 24 || (Date.now() - new Date(row.due_date).getTime()) / 86_400_000));
const statuses = [{ value: "needs_action", label: "Needs action", count: "needs_action" }, { value: "overdue", label: "Overdue", count: "overdue_count" }, { value: "borrowed", label: "Active", count: "borrowed_count" }, { value: "returned", label: "Returned", count: "returned_count" }, { value: "all", label: "All", count: "total_records" }] as const;

export default function CirculationLog({ refreshKey = 0 }: { refreshKey?: number }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [params, patchParams] = useAdminUrlState();
  const { user } = useAuth();
  const canArchive = user?.role === "admin" || user?.role === "super_admin";
  const status = (params.get("filter") ?? params.get("status")) || "needs_action";
  const search = params.get("search") || "";
  const dateFrom = params.get("dateFrom") || "";
  const dateTo = params.get("dateTo") || "";
  const archived = params.get("archived") === "true";
  const policyId = Number(params.get('policyId')) || undefined;
  const previousTerms = params.get('previousTerms') === 'true';
  const setStatus = (value: string) => patchParams({ filter: value, status: null });
  const setSearch = (value: string) => patchParams({ search: value || null }, true);
  const [actionId, setActionId] = useState<number | null>(null);
  const detailRowId = useRef<number | null>(null);
  const [selected, setSelected] = useState<CirculationLogEntry | null>(null);
  const openDetails = (row: CirculationLogEntry) => { detailRowId.current = row.id; setSelected(row); };
  const { confirm, confirmDialog } = useAdminConfirmDialog();
  const debouncedSearch = useDebounce(search, 300);
  const invalidRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const common = { search: debouncedSearch || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, archived: archived || undefined, policyId, previousTerms:previousTerms||undefined };
  const filters = { ...common, status: !archived && status !== "all" ? status : undefined, page, limit: 20 };
  const log = useQuery({ queryKey: circulationKeys.log(filters), queryFn: ({ signal }) => getCirculationLog(filters, signal), placeholderData: previous => previous, enabled: !invalidRange });
  // Counts must ignore the selected status, but respect search, dates and archive view.
  const countFilters = { ...common, page: 1, limit: 1 };
  const counts = useQuery({ queryKey: circulationKeys.log(countFilters), queryFn: ({ signal }) => getCirculationLog(countFilters, signal), enabled: !invalidRange });
  const rows = log.data?.rows ?? [];
  const pages = log.data?.totalPages ?? 1;
  useEffect(() => { setPage(1); }, [status, debouncedSearch, archived, dateFrom, dateTo, policyId, previousTerms]);
  useEffect(() => { if (refreshKey > 0) void client.invalidateQueries({ queryKey: circulationKeys.logs() }); }, [client, refreshKey]);
  const snapshot = async (id: number) => {
    await client.cancelQueries({ queryKey: circulationKeys.logs() });
    const previous = client.getQueriesData<CirculationLogResult>({ queryKey: circulationKeys.logs() });
    previous.forEach(([key, data]) => { if (data?.rows.some(row => row.id === id)) client.setQueryData(key, { ...data, rows: data.rows.filter(row => row.id !== id), total: Math.max(0, data.total - 1) }); });
    return previous;
  };
  const rollback = (_err: unknown, _id: number, previous?: Array<[QueryKey, CirculationLogResult | undefined]>) => previous?.forEach(([key, data]) => { if (data) client.setQueryData(key, data); });
  const archive = useMutation({ mutationFn: archiveBorrowing, onMutate: snapshot, onError: rollback, onSettled: () => client.invalidateQueries({ queryKey: circulationKeys.logs() }) });
  const restore = useMutation({ mutationFn: restoreBorrowing, onMutate: snapshot, onError: rollback, onSettled: () => client.invalidateQueries({ queryKey: circulationKeys.logs() }) });
  const changeArchive = async (row: CirculationLogEntry) => {
    if (actionId !== null || !await confirm({ title: `${archived ? "Restore" : "Archive"} “${row.book_title}” record?`, description: archived ? "The record will return to circulation history." : "The returned loan will move to archived records and can be restored later.", actionLabel: archived ? "Restore record" : "Archive record", tone: archived ? undefined : "danger" })) return;
    setActionId(row.id);
    try { await (archived ? restore : archive).mutateAsync(row.id); setSelected(null); toast.success(archived ? "Record restored" : "Record archived"); } catch (err) { toast.error(getApiErrorMessage(err, "Could not update the record. Please retry.")); } finally { setActionId(null); }
  };
  const returnLoan = (row: CirculationLogEntry) => { if (row.copy_barcode) navigate(`/admin/circulation?tab=transaction&mode=return&copy=${encodeURIComponent(row.copy_barcode)}`); };
  const menu = (row: CirculationLogEntry) => <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${row.user_name}, ${row.book_title}`} disabled={actionId !== null}><AdminIcon name={actionId === row.id ? "refresh" : "more"} className={actionId === row.id ? "animate-spin" : ""} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => openDetails(row)}>View details</DropdownMenuItem>{!archived && row.status !== "returned" && <DropdownMenuItem disabled={!row.copy_barcode} onSelect={() => returnLoan(row)}><AdminIcon name="return" className="mr-2 h-4 w-4" />Return copy</DropdownMenuItem>}{canArchive && (archived || row.status === "returned") && <DropdownMenuItem className={archived ? "" : "text-destructive"} onSelect={() => void changeArchive(row)}>{archived ? "Restore record" : "Archive record"}</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>;
  const badge = (row: CirculationLogEntry) => <AdminStatusBadge status={row.status}><AdminIcon name={statusIcon[row.status]} />{statusLabel[row.status]}</AdminStatusBadge>;
  return <>
    {confirmDialog}<CompactPanel title={archived ? "Archived transactions" : "Circulation history"} id="circulation-history-heading">
      <div className="circulation-history-filters">
        {policyId && <p>Showing {previousTerms?'active loans using previous terms':'loans'} for policy #{policyId}. <Button variant="ghost" onClick={()=>patchParams({policyId:null,previousTerms:null})}>Clear policy filter</Button></p>}
        {!archived && <div className="circulation-status-filters"><AdminFilterChips label="Loan status" value={status} onChange={setStatus} items={statuses.map(item => { const summary = counts.data?.summary; return { value: item.value, label: item.label, count: summary ? item.count === "needs_action" ? summary.borrowed_count + summary.overdue_count : summary[item.count] : undefined }; })} />{status === "today" && <button type="button" aria-pressed="true" onClick={() => setStatus("needs_action")}>Today's activity / Clear</button>}</div>}
        <div className="circulation-search-row"><div className="circulation-history-search"><label className="sr-only" htmlFor="circulation-history-search">Search circulation history</label><AdminIcon name="search" /><input id="circulation-history-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patron, book, ID or ISBN" /></div><CirculationDateRange from={dateFrom} to={dateTo} onChange={(from, to) => patchParams({ dateFrom: from, dateTo: to })} /></div>
      </div>
      {invalidRange && <p role="alert" className="circulation-error circulation-history-message">Choose an end date on or after the start date.</p>}
      {(log.isError || counts.isError) && <p role="alert" className="circulation-error circulation-history-message">{log.data ? "Could not refresh history. Showing the last loaded records." : "Could not load circulation history."} <button type="button" onClick={() => { void log.refetch(); void counts.refetch(); }}>Retry</button></p>}
      <div className="circulation-loan-groups" aria-busy={log.isFetching}>
        {log.isPending && !log.isError && <div className="circulation-panel-body">{Array.from({ length: 4 }, (_, i) => <div key={i} className="circulation-table-skeleton" aria-label="Loading transactions" />)}</div>}
        {log.isSuccess && !rows.length && <p className="circulation-empty">{archived ? "No archived records found." : status === "needs_action" ? "No loans need action." : "No transactions match these filters."}</p>}
        {[
          { label: "Overdue loans", tone: "red", items: rows.filter(row => row.status === "overdue").sort((a, b) => overdueDays(b) - overdueDays(a)) },
          { label: "Due within 24 hours", tone: "amber", items: rows.filter(row => row.status === "borrowed" && new Date(row.due_date).getTime() <= Date.now() + 86_400_000) },
          { label: "Active loans", tone: "blue", items: rows.filter(row => row.status === "borrowed" && new Date(row.due_date).getTime() > Date.now() + 86_400_000) },
          { label: "Returned", tone: "neutral", items: rows.filter(row => row.status === "returned") },
        ].filter(group => group.items.length).map(group => {
          const content = <ul className="circulation-loan-list">{group.items.map(row => <li key={row.id} data-tone={group.tone} onClick={event => { if (!(event.target as HTMLElement).closest("button,a,[role=menuitem]")) openDetails(row); }}>
            <span className="circulation-loan-icon"><AdminIcon name={statusIcon[row.status]} /></span>
            <div className="circulation-loan-book"><button type="button" title={row.book_title} onClick={() => openDetails(row)}>{row.book_title}</button><span className="circulation-secondary">{row.status === "overdue" ? `${overdueDays(row)} days overdue` : row.status === "returned" ? `Returned ${row.returned_at ? day(row.returned_at) : "date unavailable"}` : `Due ${day(row.due_date)}`} {row.status === "overdue" && <strong className="circulation-danger"> · {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(row.fine_amount)} fine</strong>}</span><span className="circulation-secondary">{row.isbn ? `ISBN ${row.isbn}` : row.is_legacy ? "Legacy loan" : "ISBN not recorded"}</span></div>
            <div className="circulation-loan-patron"><button type="button" id={`circulation-history-row-${row.id}`} title={row.user_name} onClick={() => openDetails(row)}>{row.user_name}</button><span className="circulation-mono" title={row.student_employee_id}>{row.student_employee_id}</span><time className="circulation-secondary">Borrowed {day(row.borrowed_at)}</time></div>
            <div className="circulation-loan-actions" onClick={event => event.stopPropagation()}>{!archived && row.status !== "returned" && <Button disabled={!row.copy_barcode} onClick={() => returnLoan(row)}><AdminIcon name="return" />Return</Button>}{!archived && row.status === "overdue" && <Button variant="outline" onClick={() => navigate(`/admin/clearance?student_employee_id=${encodeURIComponent(row.student_employee_id)}`)}>View fine</Button>}{menu(row)}</div>
          </li>)}</ul>;
          return group.label === "Returned" && status !== "returned" && !archived ? <details className="circulation-loan-group" key={group.label}><summary>Returned <span>{group.items.length} on this page</span></summary>{content}</details> : <section key={group.label} className="circulation-loan-group" aria-label={group.label}><header><h3>{group.label}</h3><span>{group.items.length} on this page</span></header>{content}</section>;
        })}
      </div>
      <div className="circulation-history-footer"><span className="circulation-secondary">{log.data ? `${log.data.total.toLocaleString("en-PH")} records${log.isFetching ? " · Updating…" : ""}` : "Records unavailable"}</span>{pages > 1 && <div><Button variant="outline" disabled={page <= 1 || log.isFetching} onClick={() => setPage(value => value - 1)}>Previous</Button><span>Page {page} of {pages}</span><Button variant="outline" disabled={page >= pages || log.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button></div>}</div>
    </CompactPanel>
    <AdminDetailDrawer open={Boolean(selected)} onClose={() => setSelected(null)} title="Transaction details" description="Loan, return and staff record" className="circulation-detail" footer={selected && <div className="circulation-inline-actions">{!archived && selected.status !== "returned" && <Button className="circulation-confirm" data-mode="return" disabled={!selected.copy_barcode} onClick={() => returnLoan(selected)}><AdminIcon name="return" />Return copy</Button>}<Button variant="outline" onClick={() => navigate(`/admin/clearance?student_employee_id=${encodeURIComponent(selected.student_employee_id)}`)}>Open clearance</Button>{canArchive && (archived || selected.status === "returned") && <Button variant="ghost" disabled={actionId !== null} onClick={() => void changeArchive(selected)}>{archived ? "Restore record" : "Archive record"}</Button>}</div>} onAfterClose={() => (document.getElementById(`circulation-history-row-${detailRowId.current}`) || document.getElementById("circulation-history-search"))?.focus()}>{selected && <><div className="circulation-detail-heading"><h3>{selected.book_title}</h3>{badge(selected)}</div><dl className="circulation-detail-fields"><div><dt>Patron</dt><dd>{selected.user_name}<span className="circulation-mono">{selected.student_employee_id}</span></dd></div><div><dt>Contact</dt><dd>{selected.user_email ? <a href={`mailto:${selected.user_email}`}>{selected.user_email}</a> : "Not recorded"}</dd></div><div><dt>Author</dt><dd>{selected.book_author || "Not recorded"}</dd></div><div><dt>ISBN</dt><dd>{selected.isbn || "Not recorded"}</dd></div><div><dt>Copy QR code</dt><dd className="circulation-mono">{selected.copy_barcode || "Legacy loan · no linked copy"}</dd></div><div><dt>Borrowed</dt><dd>{day(selected.borrowed_at)} · {time(selected.borrowed_at)}</dd></div><div><dt>Due</dt><dd>{day(selected.due_date)} · {time(selected.due_date)}</dd></div><div><dt>Returned</dt><dd>{selected.returned_at ? `${day(selected.returned_at)} · ${time(selected.returned_at)}` : "Still on loan"}</dd></div><div><dt>Renewals</dt><dd>Renewal history is not recorded for this loan.</dd></div>{selected.notes && <div><dt>Notes</dt><dd>{selected.notes.split("\n").filter(line => !line.startsWith("Desk undo ")).join("\n")}</dd></div>}<div><dt>Issued by</dt><dd>{selected.issued_by_name || "Not recorded"}</dd></div><div><dt>Calculated fine</dt><dd>{new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(selected.fine_amount)}<span className="circulation-secondary">Payment and waiver records are available in clearance.</span></dd></div></dl></>}</AdminDetailDrawer>
  </>;
}

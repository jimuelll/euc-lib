import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Download, ExternalLink, FileBarChart, RefreshCcw, ScrollText, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AdminPage,
  AdminPanel,
  AdminStatCard,
  AdminStatGrid,
} from "./components/AdminPage";
import {
  getCirculationLog,
  type CirculationLogEntry,
  type CirculationLogResult,
  type CirculationLogSummary,
} from "./adminCirculation/circulation.api";
import { getAdminReservations } from "./adminReservations/reservations.api";
import type { AdminReservation, ReservationsResult } from "./adminReservations/reservations.types";
import { fetchClearanceQueue, type ClearanceQueueEntry } from "./adminReports.api";
import { getApiErrorMessage } from "@/utils/apiError";
import { useAuth } from "@/context/AuthContext";

const emptyCirculationSummary: CirculationLogSummary = {
  total_records: 0,
  borrowed_count: 0,
  overdue_count: 0,
  returned_count: 0,
  unique_borrowers: 0,
};

const emptyReservationSummary = {
  total_records: 0,
  pending_count: 0,
  ready_count: 0,
  fulfilled_count: 0,
  cancelled_count: 0,
  expired_count: 0,
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const downloadCsv = (filename: string, headers: string[], rows: unknown[][]) => { const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"); const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url); };
const dateRangeError = (from: string, to: string) => from && to && from > to ? "The start date must be on or before the end date." : null;
const reportFilename = (name: string) => `${name}-${new Date().toISOString().slice(0, 10)}.csv`;

const ClearanceMobileRows = ({ rows }: { rows: ClearanceQueueEntry[] }) => (
  <div className="space-y-3 sm:hidden">
    {rows.map((row) => (
      <article key={row.userId} className="border border-border/70 bg-background p-4">
        <div className="min-w-0">
          <h3 className="break-words font-medium text-foreground">{row.name}</h3>
          <p className="mt-0.5 break-all text-xs text-muted-foreground">{row.studentEmployeeId}</p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/70 pt-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Overdue returns</dt>
            <dd className={row.overdueCount ? "mt-1 font-medium text-destructive" : "mt-1 text-muted-foreground"}>{row.overdueCount || "None"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Unpaid fines</dt>
            <dd className="mt-1 font-medium text-foreground">{row.outstandingAmount ? money.format(row.outstandingAmount) : "None"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Fine records</dt>
            <dd className="mt-1 text-foreground">{row.fineRecords || "—"}</dd>
          </div>
          {row.overdueTitles.length > 0 && (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Overdue titles</dt>
              <dd className="mt-1 break-words text-foreground">{row.overdueTitles.join(", ")}</dd>
            </div>
          )}
        </dl>
      </article>
    ))}
  </div>
);

const AdminReport = () => {
  const { user } = useAuth();
  const [circulationStatus, setCirculationStatus] = useState("all");
  const [circulationSearch, setCirculationSearch] = useState("");
  const [circulationDateFrom, setCirculationDateFrom] = useState("");
  const [circulationDateTo, setCirculationDateTo] = useState("");
  const [circulationSummary, setCirculationSummary] = useState<CirculationLogSummary>(emptyCirculationSummary);
  const [circulationRows, setCirculationRows] = useState<CirculationLogEntry[]>([]);
  const [circulationLoading, setCirculationLoading] = useState(true);
  const [circulationPagination, setCirculationPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  const [reservationSearch, setReservationSearch] = useState("");
  const [reservationStatus, setReservationStatus] = useState("all");
  const [reservationDateFrom, setReservationDateFrom] = useState("");
  const [reservationDateTo, setReservationDateTo] = useState("");
  const [reservationSummary, setReservationSummary] = useState(emptyReservationSummary);
  const [reservationRows, setReservationRows] = useState<AdminReservation[]>([]);
  const [reservationPagination, setReservationPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [reservationLoading, setReservationLoading] = useState(true);
  const [clearanceRows, setClearanceRows] = useState<ClearanceQueueEntry[]>([]);
  const [clearanceLoading, setClearanceLoading] = useState(true);
  const [clearancePagination, setClearancePagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [reportError, setReportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"circulation" | "reservations" | "clearance" | null>(null);

  const circulationFilters = useMemo(() => ({ search: circulationSearch || undefined, status: circulationStatus === "all" ? undefined : circulationStatus, dateFrom: circulationDateFrom || undefined, dateTo: circulationDateTo || undefined }), [circulationDateFrom, circulationDateTo, circulationSearch, circulationStatus]);
  const reservationFilters = useMemo(() => ({ search: reservationSearch || undefined, status: reservationStatus, dateFrom: reservationDateFrom || undefined, dateTo: reservationDateTo || undefined }), [reservationDateFrom, reservationDateTo, reservationSearch, reservationStatus]);

  const loadCirculationReport = useCallback(async (page = 1) => {
    setCirculationLoading(true);
    try {
      const result: CirculationLogResult = await getCirculationLog({
        ...circulationFilters,
        page,
        limit: 20,
      });

      setCirculationRows(result.rows);
      setCirculationSummary(result.summary ?? emptyCirculationSummary);
      setCirculationPagination({ page: result.page, limit: 20, total: result.total, totalPages: result.totalPages });
    } catch (error) {
      setReportError(getApiErrorMessage(error, "Unable to load circulation records. Try again."));
    } finally {
      setCirculationLoading(false);
    }
  }, [circulationFilters]);

  const loadReservationReport = useCallback(async (page = 1) => {
    setReservationLoading(true);
    try {
      const result: ReservationsResult = await getAdminReservations({
        ...reservationFilters,
        page,
        limit: 20,
      });

      setReservationRows(result.rows);
      setReservationSummary(result.summary ?? emptyReservationSummary);
      setReservationPagination({
        page: result.page,
        limit: 20,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (error) {
      setReportError(getApiErrorMessage(error, "Unable to load reservation records. Try again."));
    } finally {
      setReservationLoading(false);
    }
  }, [reservationFilters]);

  const loadClearanceReport = useCallback(async (page = 1) => {
    setClearanceLoading(true);
    try { const response = await fetchClearanceQueue(page); setClearanceRows(response.rows ?? []); setClearancePagination(response.pagination); }
    catch (error) { setReportError(getApiErrorMessage(error, "Unable to load clearance exceptions. Try again.")); }
    finally { setClearanceLoading(false); }
  }, []);

  useEffect(() => {
    void Promise.all([loadCirculationReport(), loadReservationReport(), loadClearanceReport()]);
  }, [loadCirculationReport, loadClearanceReport, loadReservationReport]);

  const handleCirculationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = dateRangeError(circulationDateFrom, circulationDateTo);
    if (error) { setReportError(error); return; }
    setReportError(null);
    await loadCirculationReport(1);
  };

  const handleReservationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = dateRangeError(reservationDateFrom, reservationDateTo);
    if (error) { setReportError(error); return; }
    setReportError(null);
    await loadReservationReport(1);
  };

  const exportCirculation = async () => {
    setExporting("circulation"); setReportError(null);
    try {
      const first = await getCirculationLog({ ...circulationFilters, page: 1, limit: 50 });
      const rows = [...first.rows];
      for (let page = 2; page <= first.totalPages; page += 1) rows.push(...(await getCirculationLog({ ...circulationFilters, page, limit: 50 })).rows);
      downloadCsv(reportFilename("circulation-report"), ["Student", "Student ID", "Book", "Borrowed at", "Due at", "Returned at", "Status"], rows.map((row) => [row.user_name, row.student_employee_id, row.book_title, row.borrowed_at, row.due_date, row.returned_at, row.status]));
    } catch (error) { setReportError(getApiErrorMessage(error, "Unable to export all circulation records. Try again.")); }
    finally { setExporting(null); }
  };

  const exportReservations = async () => {
    setExporting("reservations"); setReportError(null);
    try {
      const first = await getAdminReservations({ ...reservationFilters, page: 1, limit: 50 });
      const rows = [...first.rows];
      for (let page = 2; page <= first.totalPages; page += 1) rows.push(...(await getAdminReservations({ ...reservationFilters, page, limit: 50 })).rows);
      downloadCsv(reportFilename("reservations-report"), ["Student", "Student ID", "Book", "Author", "Reserved at", "Expires at", "Status"], rows.map((row) => [row.user_name, row.student_employee_id, row.book_title, row.book_author, row.reserved_at, row.expires_at, row.status]));
    } catch (error) { setReportError(getApiErrorMessage(error, "Unable to export all reservation records. Try again.")); }
    finally { setExporting(null); }
  };

  const exportClearance = async () => {
    setExporting("clearance"); setReportError(null);
    try {
      const first = await fetchClearanceQueue(1, 100);
      const rows = [...first.rows];
      for (let page = 2; page <= first.pagination.totalPages; page += 1) rows.push(...(await fetchClearanceQueue(page, 100)).rows);
      downloadCsv(reportFilename("clearance-exceptions-report"), ["Patron", "Student / employee ID", "Overdue returns", "Oldest due date", "Overdue titles", "Unpaid fines", "Fine records"], rows.map((row) => [row.name, row.studentEmployeeId, row.overdueCount, row.oldestDueDate, row.overdueTitles.join("; "), row.outstandingAmount, row.fineRecords]));
    } catch (error) { setReportError(getApiErrorMessage(error, "Unable to export all clearance exceptions. Try again.")); }
    finally { setExporting(null); }
  };

  return (
    <AdminPage
      title="Reports"
      description="Export complete, filtered operational records and move to the right report when you need trends, attendance, or system accountability."
      contentWidth="wide"
    >
      {reportError ? <div role="alert" className="flex flex-col gap-3 border border-destructive/40 bg-destructive/5 px-4 py-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"><span>{reportError}</span><Button type="button" variant="outline" size="sm" className="w-fit rounded-none border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { setReportError(null); void Promise.all([loadCirculationReport(), loadReservationReport(), loadClearanceReport()]); }}>Try again</Button></div> : null}

      <AdminPanel title="Report workspace" description="Choose a report based on the question you need answered. Exports include every record matching the active filters, not only the page on screen.">
        <div className="space-y-4">
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Choose a report based on the question you need answered. Exports include every record matching the active filters, not only the page on screen.</p>
          <div className="grid gap-px border border-border/70 bg-border/70 md:grid-cols-3">
            <Link to="/admin/analytics" className="group bg-card p-4 transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><FileBarChart className="h-5 w-5 text-primary" /><p className="mt-5 font-semibold text-foreground">Analytics</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Collection health, trends, patron activity, and fine collections.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">Open analytics <ExternalLink className="h-3.5 w-3.5" /></span></Link>
            <Link to="/admin/attendance-logs" className="group bg-card p-4 transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><UsersRound className="h-5 w-5 text-primary" /><p className="mt-5 font-semibold text-foreground">Attendance logs</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Visitor and entry activity with its own date and purpose filters.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">Open attendance logs <ExternalLink className="h-3.5 w-3.5" /></span></Link>
            {user?.role === "super_admin" ? <Link to="/admin/audit-logs" className="group bg-card p-4 transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ScrollText className="h-5 w-5 text-primary" /><p className="mt-5 font-semibold text-foreground">Audit logs</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Accountability trail for sensitive administrative actions.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">Open audit logs <ExternalLink className="h-3.5 w-3.5" /></span></Link> : <div className="bg-card p-4"><ScrollText className="h-5 w-5 text-muted-foreground" /><p className="mt-5 font-semibold text-foreground">Audit logs</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Sensitive administrative accountability records are available to super administrators.</p></div>}
          </div>
        </div>
      </AdminPanel>

      <Tabs defaultValue="circulation" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start rounded-none border border-border/70 bg-background p-1">
          <TabsTrigger value="circulation" className="rounded-none">Circulation</TabsTrigger>
          <TabsTrigger value="reservations" className="rounded-none">Reservations</TabsTrigger>
          <TabsTrigger value="clearance" className="rounded-none">Clearance</TabsTrigger>
        </TabsList>

        <TabsContent value="circulation" className="space-y-6">
          <AdminPanel title="Circulation filters" description="Search circulation activity by status and date range.">
            <form className="space-y-4" onSubmit={handleCirculationSubmit}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="circulation-search" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Search
                  </Label>
                  <Input id="circulation-search" className="rounded-none" placeholder="Student, ID, or book title" value={circulationSearch} onChange={(event) => setCirculationSearch(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="circulation-status" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Status
                  </Label>
                  <Select value={circulationStatus} onValueChange={setCirculationStatus}>
                    <SelectTrigger id="circulation-status" className="rounded-none">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="borrowed">Borrowed</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="circulation-from" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Start date
                  </Label>
                  <Input id="circulation-from" type="date" className="rounded-none" value={circulationDateFrom} onChange={(event) => setCirculationDateFrom(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="circulation-to" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    End date
                  </Label>
                  <Input id="circulation-to" type="date" className="rounded-none" value={circulationDateTo} onChange={(event) => setCirculationDateTo(event.target.value)} />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-4">
                <Button type="button" variant="ghost" className="rounded-none" onClick={() => { setCirculationSearch(""); setCirculationStatus("all"); setCirculationDateFrom(""); setCirculationDateTo(""); setReportError(null); }}>Reset filters</Button>
                <Button type="button" variant="outline" className="rounded-none" disabled={circulationLoading || exporting !== null} onClick={() => void exportCirculation()}><Download className="mr-2 h-4 w-4" />{exporting === "circulation" ? "Preparing export…" : "Export all matching CSV"}</Button>
                <Button type="button" variant="outline" className="rounded-none" onClick={() => void loadCirculationReport()} disabled={circulationLoading}>
                  <RefreshCcw className={`mr-2 h-4 w-4 ${circulationLoading ? "animate-spin" : ""}`} />
                  Refresh circulation
                </Button>
                <Button type="submit" disabled={circulationLoading}>Search records</Button>
              </div>
            </form>
          </AdminPanel>

          <AdminStatGrid>
            <AdminStatCard label="Records" value={String(circulationSummary.total_records)} helperText="Transactions matching the selected filters." />
            <AdminStatCard label="Borrowed" value={String(circulationSummary.borrowed_count)} helperText="Active borrowed records in these results." />
            <AdminStatCard label="Overdue" value={String(circulationSummary.overdue_count)} helperText="Overdue records in the selected range." />
            <AdminStatCard label="Returned" value={String(circulationSummary.returned_count)} helperText={`${circulationSummary.unique_borrowers} unique borrower(s) included.`} />
          </AdminStatGrid>

          <AdminPanel title="Circulation records" description="Paged circulation records matching the current filters.">
            {circulationRows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      {["Student", "Book", "Borrowed At", "Due At", "Returned At", "Status"].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {circulationRows.map((row) => (
                      <tr key={row.id} className="border-b border-border/70 last:border-b-0">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{row.user_name}</div>
                          <div className="text-xs text-muted-foreground">{row.student_employee_id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{row.book_title}</div>
                          <div className="text-xs text-muted-foreground">{row.copy_barcode ?? row.isbn ?? "-"}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.borrowed_at)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.due_date)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.returned_at)}</td>
                        <td className="px-4 py-3 text-foreground">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">No circulation records matched the selected filters.</p>
              </div>
            )}
            {circulationPagination.totalPages > 1 ? <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-4"><Button type="button" variant="outline" className="rounded-none" disabled={circulationLoading || circulationPagination.page <= 1} onClick={() => void loadCirculationReport(circulationPagination.page - 1)}>Previous</Button><p className="text-sm text-muted-foreground">Page {circulationPagination.page} of {circulationPagination.totalPages} with {circulationPagination.total} record(s)</p><Button type="button" variant="outline" className="rounded-none" disabled={circulationLoading || circulationPagination.page >= circulationPagination.totalPages} onClick={() => void loadCirculationReport(circulationPagination.page + 1)}>Next</Button></div> : null}
          </AdminPanel>
        </TabsContent>

        <TabsContent value="reservations" className="space-y-6">
          <AdminPanel title="Reservation filters" description="Search reservation history by person, title, status, and date range.">
            <form className="space-y-4" onSubmit={handleReservationSubmit}>
              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="reservation-search" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Search
                  </Label>
                  <Input id="reservation-search" className="rounded-none" placeholder="Student, ID, or book title" value={reservationSearch} onChange={(event) => setReservationSearch(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reservation-status" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Status
                  </Label>
                  <Select value={reservationStatus} onValueChange={setReservationStatus}>
                    <SelectTrigger id="reservation-status" className="rounded-none">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="fulfilled">Fulfilled</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reservation-from" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Start date
                  </Label>
                  <Input id="reservation-from" type="date" className="rounded-none" value={reservationDateFrom} onChange={(event) => setReservationDateFrom(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reservation-to" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    End date
                  </Label>
                  <Input id="reservation-to" type="date" className="rounded-none" value={reservationDateTo} onChange={(event) => setReservationDateTo(event.target.value)} />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-4">
                <Button type="button" variant="ghost" className="rounded-none" onClick={() => { setReservationSearch(""); setReservationStatus("all"); setReservationDateFrom(""); setReservationDateTo(""); setReportError(null); }}>Reset filters</Button>
                <Button type="button" variant="outline" className="rounded-none" disabled={reservationLoading || exporting !== null} onClick={() => void exportReservations()}><Download className="mr-2 h-4 w-4" />{exporting === "reservations" ? "Preparing export…" : "Export all matching CSV"}</Button>
                <Button type="button" variant="outline" className="rounded-none" onClick={() => void loadReservationReport(1)} disabled={reservationLoading}>
                  <RefreshCcw className={`mr-2 h-4 w-4 ${reservationLoading ? "animate-spin" : ""}`} />
                  Refresh reservations
                </Button>
                <Button type="submit" disabled={reservationLoading}>Search records</Button>
              </div>
            </form>
          </AdminPanel>

          <AdminStatGrid>
            <AdminStatCard label="Records" value={String(reservationSummary.total_records)} helperText="Reservations matching the selected filters." />
            <AdminStatCard label="Pending" value={String(reservationSummary.pending_count)} helperText="Reservations still waiting for action." />
            <AdminStatCard label="Ready" value={String(reservationSummary.ready_count)} helperText="Reservations ready for pickup." />
            <AdminStatCard label="Completed" value={String(reservationSummary.fulfilled_count + reservationSummary.cancelled_count + reservationSummary.expired_count)} helperText={`${reservationSummary.fulfilled_count} fulfilled, ${reservationSummary.cancelled_count} cancelled, ${reservationSummary.expired_count} expired.`} />
          </AdminStatGrid>

          <AdminPanel title="Reservation records" description="Historical reservation records ordered by most recent request first.">
            {reservationRows.length ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        {["Student", "Book", "Reserved At", "Expires At", "Status"].map((heading) => (
                          <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reservationRows.map((row) => (
                        <tr key={row.id} className="border-b border-border/70 last:border-b-0">
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{row.user_name}</div>
                            <div className="text-xs text-muted-foreground">{row.student_employee_id}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{row.book_title}</div>
                            <div className="text-xs text-muted-foreground">{row.book_author}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.reserved_at)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.expires_at)}</td>
                          <td className="px-4 py-3 text-foreground">{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none"
                    disabled={reservationLoading || reservationPagination.page <= 1}
                    onClick={() => void loadReservationReport(reservationPagination.page - 1)}
                  >
                    Previous
                  </Button>

                  <p className="text-sm text-muted-foreground">
                    Page {reservationPagination.page} of {reservationPagination.totalPages} with {reservationPagination.total} record(s)
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none"
                    disabled={reservationLoading || reservationPagination.page >= reservationPagination.totalPages}
                    onClick={() => void loadReservationReport(reservationPagination.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">No reservation records matched the selected filters.</p>
              </div>
            )}
          </AdminPanel>
        </TabsContent>

        <TabsContent value="clearance" className="space-y-6">
          <AdminPanel title="Clearance exceptions" description="Live patrons with overdue returns, unpaid fines, or both. Use the Clearance workspace to review an individual patron’s payment record or take action." actions={<div className="flex gap-2"><Button type="button" variant="outline" className="rounded-none" disabled={clearanceLoading || exporting !== null} onClick={() => void exportClearance()}><Download className="mr-2 h-4 w-4" />{exporting === "clearance" ? "Preparing export…" : "Export all exceptions"}</Button><Button type="button" variant="outline" className="rounded-none" onClick={() => void loadClearanceReport(clearancePagination.page)} disabled={clearanceLoading}><RefreshCcw className={`mr-2 h-4 w-4 ${clearanceLoading ? "animate-spin" : ""}`} />Refresh</Button></div>}>
            {clearanceRows.length ? <><ClearanceMobileRows rows={clearanceRows} /><div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border bg-muted/20">{["Patron", "Overdue returns", "Unpaid fines", "Fine records"].map((heading) => <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{heading}</th>)}</tr></thead><tbody>{clearanceRows.map((row) => <tr key={row.userId} className="border-b border-border/70 last:border-b-0"><td className="px-4 py-3"><div className="font-medium text-foreground">{row.name}</div><div className="text-xs text-muted-foreground">{row.studentEmployeeId}</div></td><td className="px-4 py-3">{row.overdueCount ? <><div className="font-medium text-destructive">{row.overdueCount} item{row.overdueCount === 1 ? "" : "s"}</div><div className="mt-1 max-w-[30ch] truncate text-xs text-muted-foreground" title={row.overdueTitles.join(", ")}>{row.overdueTitles.join(", ")}</div></> : <span className="text-muted-foreground">None</span>}</td><td className="px-4 py-3 font-medium text-foreground">{row.outstandingAmount ? money.format(row.outstandingAmount) : "None"}</td><td className="px-4 py-3 text-muted-foreground">{row.fineRecords || "-"}</td></tr>)}</tbody></table></div>{clearancePagination.totalPages > 1 ? <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4"><Button type="button" variant="outline" className="min-h-11 rounded-none" disabled={clearanceLoading || clearancePagination.page <= 1} onClick={() => void loadClearanceReport(clearancePagination.page - 1)}>Previous</Button><p className="text-sm text-muted-foreground">Page {clearancePagination.page} of {clearancePagination.totalPages} with {clearancePagination.total} patron(s)</p><Button type="button" variant="outline" className="min-h-11 rounded-none" disabled={clearanceLoading || clearancePagination.page >= clearancePagination.totalPages} onClick={() => void loadClearanceReport(clearancePagination.page + 1)}>Next</Button></div> : null}</> : <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center"><p className="text-sm text-muted-foreground">{clearanceLoading ? "Loading clearance exceptions..." : "No overdue returns or unpaid fines are waiting for review."}</p></div>}
          </AdminPanel>
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
};

export default AdminReport;

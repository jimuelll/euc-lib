import { useEffect, useState, type FormEvent } from "react";
import { RefreshCcw } from "lucide-react";
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

const AdminReport = () => {
  const [circulationStatus, setCirculationStatus] = useState("all");
  const [circulationDateFrom, setCirculationDateFrom] = useState("");
  const [circulationDateTo, setCirculationDateTo] = useState("");
  const [circulationSummary, setCirculationSummary] = useState<CirculationLogSummary>(emptyCirculationSummary);
  const [circulationRows, setCirculationRows] = useState<CirculationLogEntry[]>([]);
  const [circulationLoading, setCirculationLoading] = useState(true);

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

  const loadCirculationReport = async () => {
    setCirculationLoading(true);
    try {
      const result: CirculationLogResult = await getCirculationLog({
        status: circulationStatus === "all" ? undefined : circulationStatus,
        dateFrom: circulationDateFrom || undefined,
        dateTo: circulationDateTo || undefined,
        page: 1,
        limit: 50,
      });

      setCirculationRows(result.rows);
      setCirculationSummary(result.summary ?? emptyCirculationSummary);
    } finally {
      setCirculationLoading(false);
    }
  };

  const loadReservationReport = async (page = 1) => {
    setReservationLoading(true);
    try {
      const result: ReservationsResult = await getAdminReservations({
        search: reservationSearch || undefined,
        status: reservationStatus,
        dateFrom: reservationDateFrom || undefined,
        dateTo: reservationDateTo || undefined,
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
    } finally {
      setReservationLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadCirculationReport(), loadReservationReport()]);
  }, []);

  const handleCirculationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadCirculationReport();
  };

  const handleReservationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadReservationReport(1);
  };

  return (
    <AdminPage
      eyebrow="Reports"
      title="Reports"
      description="Review historical circulation and reservation records without jumping into the operational pages."
      contentWidth="wide"
    >
      <Tabs defaultValue="circulation" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start rounded-none border border-border/70 bg-background p-1">
          <TabsTrigger value="circulation" className="rounded-none">Circulation</TabsTrigger>
          <TabsTrigger value="reservations" className="rounded-none">Reservations</TabsTrigger>
        </TabsList>

        <TabsContent value="circulation" className="space-y-6">
          <AdminPanel title="Circulation filters" description="Search circulation activity by status and date range.">
            <form className="space-y-4" onSubmit={handleCirculationSubmit}>
              <div className="grid gap-4 md:grid-cols-3">
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

          <AdminPanel title="Circulation records" description="The latest 50 matching circulation records from the current data.">
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
      </Tabs>
    </AdminPage>
  );
};

export default AdminReport;

import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
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
import { AdminPage, AdminPanel, AdminStatCard, AdminStatGrid } from "../components/AdminPage";
import { useAttendanceLogs } from "./useAttendanceLogs";
import {
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  LoadMoreButton,
  StatsStrip,
  TableFooter,
  TableHeader,
  TableRow,
} from "./components/AdminAttendanceLogs.components";

interface AttendanceHistoryRow {
  id: number;
  type: "check_in" | "check_out";
  purpose: "entry_exit" | "borrowing";
  scanned_id: string;
  timestamp: string;
  name: string;
  student_employee_id: string;
  role: string;
  scanned_by_name: string | null;
}

interface AttendanceHistoryResponse {
  rows: AttendanceHistoryRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    total_records: number;
    check_in_count: number;
    check_out_count: number;
    unique_users: number;
    borrowing_scan_count: number;
  };
}

const emptyHistorySummary = {
  total_records: 0,
  check_in_count: 0,
  check_out_count: 0,
  unique_users: 0,
  borrowing_scan_count: 0,
};

const emptyHistoryFilters = {
  search: "",
  type: "all",
  purpose: "all",
  dateFrom: "",
  dateTo: "",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const AdminAttendanceLogs = () => {
  const [mode, setMode] = useState("today");

  const {
    logs,
    visible,
    stats,
    fetchState,
    search,
    filter,
    setSearch,
    setFilter,
    handleRefresh,
    handleLoadMore,
  } = useAttendanceLogs();

  const [historyRows, setHistoryRows] = useState<AttendanceHistoryRow[]>([]);
  const [historyFilters, setHistoryFilters] = useState(emptyHistoryFilters);
  const [historySummary, setHistorySummary] = useState(emptyHistorySummary);
  const [historyPagination, setHistoryPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const loadHistoryLogs = async (
    loadMode: "initial" | "refresh" = "initial",
    nextPage = historyPagination.page,
    nextFilters = historyFilters,
  ) => {
    if (loadMode === "initial") setHistoryLoading(true);
    if (loadMode === "refresh") setHistoryRefreshing(true);
    setHistoryError("");

    try {
      const res = await axiosInstance.get<AttendanceHistoryResponse>("/api/attendance/logs", {
        params: {
          page: nextPage,
          limit: 25,
          search: nextFilters.search || undefined,
          type: nextFilters.type,
          purpose: nextFilters.purpose,
          dateFrom: nextFilters.dateFrom || undefined,
          dateTo: nextFilters.dateTo || undefined,
        },
      });

      setHistoryRows(res.data.rows);
      setHistorySummary(res.data.summary ?? emptyHistorySummary);
      setHistoryPagination(res.data.pagination);
    } catch (err: any) {
      setHistoryError(err.response?.data?.message || err.message || "Failed to load attendance history");
    } finally {
      if (loadMode === "initial") setHistoryLoading(false);
      if (loadMode === "refresh") setHistoryRefreshing(false);
    }
  };

  useEffect(() => {
    void loadHistoryLogs();
  }, []);

  const isFiltered = Boolean(search || filter !== "all");
  const showLoadMore = !fetchState.loading && !fetchState.error && fetchState.hasMore && visible.length > 0 && !search && filter === "all";

  const applyHistoryFilters = () => {
    void loadHistoryLogs("refresh", 1, historyFilters);
  };

  const resetHistoryFilters = () => {
    setHistoryFilters(emptyHistoryFilters);
    void loadHistoryLogs("refresh", 1, emptyHistoryFilters);
  };

  const refreshActiveMode = () => {
    if (mode === "today") {
      handleRefresh();
      return;
    }

    void loadHistoryLogs("refresh", 1, historyFilters);
  };

  return (
    <AdminPage
      eyebrow="Reports"
      title="Attendance Logs"
      description="Open today&apos;s visitor log by default, then switch to history when you need broader attendance reporting."
      contentWidth="wide"
      actions={(
        <Button
          type="button"
          variant="outline"
          className="rounded-none"
          onClick={refreshActiveMode}
          disabled={mode === "today" ? fetchState.loading : historyLoading || historyRefreshing}
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${
            mode === "today"
              ? (fetchState.loading ? "animate-spin" : "")
              : (historyRefreshing ? "animate-spin" : "")
          }`} />
          {mode === "today" ? "Refresh today" : "Refresh history"}
        </Button>
      )}
    >
      <Tabs value={mode} onValueChange={setMode} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start rounded-none border border-border/70 bg-background p-1">
          <TabsTrigger value="today" className="rounded-none">Today</TabsTrigger>
          <TabsTrigger value="history" className="rounded-none">History</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-6">
          <StatsStrip stats={stats} loading={fetchState.loading} />

          <AdminPanel title="Today&apos;s filters" description="Refine the current day&apos;s visitor list by search term or time entry type.">
            <FilterBar
              filter={filter}
              search={search}
              onFilterChange={setFilter}
              onSearchChange={setSearch}
            />
          </AdminPanel>

          <AdminPanel
            title="Today&apos;s attendance"
            description="Recent entries are listed first so staff can quickly confirm who is currently coming in and out."
            contentClassName="p-0"
          >
            <div className="overflow-hidden">
              <TableHeader />

              {fetchState.loading ? <LoadingState /> : null}
              {!fetchState.loading && fetchState.error ? <ErrorState message={fetchState.error} /> : null}
              {!fetchState.loading && !fetchState.error && visible.length === 0 ? <EmptyState isFiltered={isFiltered} /> : null}

              {!fetchState.loading && !fetchState.error && visible.length > 0 ? (
                <div className="divide-y divide-border bg-background">
                  {visible.map((log, index) => (
                    <TableRow key={log.id} log={log} index={index} />
                  ))}
                </div>
              ) : null}

              {showLoadMore ? (
                <LoadMoreButton loadingMore={fetchState.loadingMore} onLoadMore={handleLoadMore} />
              ) : null}

              {!fetchState.loading && !fetchState.error && visible.length > 0 ? (
                <TableFooter visibleCount={visible.length} totalCount={logs.length} isFiltered={isFiltered} />
              ) : null}
            </div>
          </AdminPanel>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <AdminPanel title="History filters" description="Search attendance by person, purpose, type, and date range.">
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="attendance-history-search">Search</Label>
                <Input
                  id="attendance-history-search"
                  placeholder="Name, ID, or scanned ID"
                  value={historyFilters.search}
                  onChange={(event) => setHistoryFilters((current) => ({ ...current, search: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="attendance-history-type">Type</Label>
                <Select value={historyFilters.type} onValueChange={(value) => setHistoryFilters((current) => ({ ...current, type: value }))}>
                  <SelectTrigger id="attendance-history-type">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="check_in">Time in</SelectItem>
                    <SelectItem value="check_out">Time out</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="attendance-history-purpose">Purpose</Label>
                <Select value={historyFilters.purpose} onValueChange={(value) => setHistoryFilters((current) => ({ ...current, purpose: value }))}>
                  <SelectTrigger id="attendance-history-purpose">
                    <SelectValue placeholder="All purposes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All purposes</SelectItem>
                    <SelectItem value="entry_exit">Entry / exit</SelectItem>
                    <SelectItem value="borrowing">Borrowing scan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="attendance-history-from">Start date</Label>
                <Input
                  id="attendance-history-from"
                  type="date"
                  value={historyFilters.dateFrom}
                  onChange={(event) => setHistoryFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="attendance-history-to">End date</Label>
                <Input
                  id="attendance-history-to"
                  type="date"
                  value={historyFilters.dateTo}
                  onChange={(event) => setHistoryFilters((current) => ({ ...current, dateTo: event.target.value }))}
                />
              </div>

              <div className="flex items-end gap-2">
                <Button type="button" variant="outline" className="rounded-none" onClick={applyHistoryFilters}>Apply</Button>
                <Button type="button" variant="ghost" className="rounded-none" onClick={resetHistoryFilters}>Reset</Button>
              </div>
            </div>
          </AdminPanel>

          <AdminStatGrid>
            <AdminStatCard label="Records" value={String(historySummary.total_records)} helperText="Attendance rows matching the selected filters." />
            <AdminStatCard label="Time In" value={String(historySummary.check_in_count)} helperText="Check-in scans in the selected range." />
            <AdminStatCard label="Time Out" value={String(historySummary.check_out_count)} helperText="Check-out scans in the selected range." />
            <AdminStatCard label="Unique Users" value={String(historySummary.unique_users)} helperText={`${historySummary.borrowing_scan_count} borrowing-linked scan(s) included.`} />
          </AdminStatGrid>

          <AdminPanel title="Attendance history" description="Historical attendance activity ordered from newest to oldest.">
            {historyError ? (
              <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {historyError}
              </div>
            ) : null}

            {!historyError && !historyLoading && historyRows.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">No attendance records matched the selected filters.</p>
              </div>
            ) : null}

            {!historyError && historyRows.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        {["Person", "Role", "Type", "Purpose", "Scanned By", "Time"].map((heading) => (
                          <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map((row) => (
                        <tr key={row.id} className="border-b border-border/70 last:border-b-0">
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{row.name}</div>
                            <div className="text-xs text-muted-foreground">{row.student_employee_id}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{row.role.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3 text-foreground">{row.type === "check_in" ? "Time in" : "Time out"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.purpose === "entry_exit" ? "Entry / exit" : "Borrowing"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.scanned_by_name ?? "-"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.timestamp)}</td>
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
                    disabled={historyRefreshing || historyPagination.page <= 1}
                    onClick={() => void loadHistoryLogs("refresh", historyPagination.page - 1, historyFilters)}
                  >
                    Previous
                  </Button>

                  <p className="text-sm text-muted-foreground">
                    Page {historyPagination.page} of {historyPagination.totalPages} with {historyPagination.total} record(s)
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none"
                    disabled={historyRefreshing || historyPagination.page >= historyPagination.totalPages}
                    onClick={() => void loadHistoryLogs("refresh", historyPagination.page + 1, historyFilters)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </AdminPanel>
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
};

export default AdminAttendanceLogs;

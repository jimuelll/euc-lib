import { useEffect, useState, type ChangeEvent } from "react";
import { Activity, RefreshCcw } from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPage, AdminPanel } from "./components/AdminPage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AuditItem {
  occurred_at: string;
  category: string;
  action: string;
  actor_name: string | null;
  actor_role: string | null;
  description: string;
}

interface AuditResponse {
  rows: AuditItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    category: string;
    action: string;
    dateFrom: string;
    dateTo: string;
  };
}

interface AuditMetaResponse {
  categories: string[];
  actions: string[];
}

const emptyFilters = {
  category: "all",
  action: "",
  dateFrom: "",
  dateTo: "",
};

const categoryOptions = [
  { value: "all", label: "All categories" },
  { value: "auth", label: "Auth" },
  { value: "users", label: "Users" },
  { value: "attendance", label: "Attendance" },
  { value: "borrowing", label: "Borrowing" },
  { value: "reservation", label: "Reservation" },
  { value: "bulletin", label: "Bulletin" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "notifications", label: "Notifications" },
];

const categoryTone: Record<string, string> = {
  auth: "border-primary/20 bg-primary/5 text-primary",
  users: "border-warning/20 bg-warning/10 text-warning",
  attendance: "border-success/20 bg-success/10 text-success",
  borrowing: "border-sky-500/20 bg-sky-500/10 text-sky-600",
  reservation: "border-amber-500/20 bg-amber-500/10 text-amber-700",
  bulletin: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-700",
  subscriptions: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
  notifications: "border-rose-500/20 bg-rose-500/10 text-rose-700",
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

const formatRole = (role: string | null) => (role ? role.replace(/_/g, " ") : "System");

const AdminAuditLogs = () => {
  const [rows, setRows] = useState<AuditItem[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionOptions, setActionOptions] = useState<string[]>([]);

  const loadAuditLogs = async (
    mode: "initial" | "refresh" = "initial",
    nextPage = page,
    nextFilters = filters
  ) => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    setError("");

    try {
      const res = await axiosInstance.get<AuditResponse>("/api/admin/dashboard/audit", {
        params: {
          page: nextPage,
          limit: 10,
          category: nextFilters.category,
          action: nextFilters.action || undefined,
          dateFrom: nextFilters.dateFrom || undefined,
          dateTo: nextFilters.dateTo || undefined,
        },
      });

      setRows(res.data.rows);
      setPagination(res.data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load audit log");
    } finally {
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAuditLogs();
  }, []);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const res = await axiosInstance.get<AuditMetaResponse>("/api/admin/dashboard/audit/meta");
        setActionOptions(res.data.actions);
      } catch {
        setActionOptions([]);
      }
    };

    void loadMeta();
  }, []);

  const handleFilterChange = (key: keyof typeof emptyFilters) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
  };

  const applyFilters = () => {
    setPage(1);
    void loadAuditLogs("refresh", 1, filters);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setPage(1);
    void loadAuditLogs("refresh", 1, emptyFilters);
  };

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    void loadAuditLogs("refresh", nextPage, filters);
  };

  return (
    <AdminPage
      eyebrow="Reports"
      title="Audit Log"
      description="A dedicated trail of notable activity reconstructed from timestamps and actor fields already stored across the current schema."
      actions={
        <Button
          type="button"
          variant="outline"
          className="rounded-none"
          onClick={() => void loadAuditLogs("refresh")}
          disabled={loading || refreshing}
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Audit Feed
        </Button>
      }
    >
      <AdminPanel title="Filters" description="Narrow the audit feed by category, action, or date range.">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
          <Select value={filters.category} onValueChange={(value) => setFilters((current) => ({ ...current, category: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.action || "all"} onValueChange={(value) => setFilters((current) => ({ ...current, action: value === "all" ? "" : value }))}>
            <SelectTrigger>
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actionOptions.map((action) => (
                <SelectItem key={action} value={action}>
                  {action.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input type="date" value={filters.dateFrom} onChange={handleFilterChange("dateFrom")} />
          <Input type="date" value={filters.dateTo} onChange={handleFilterChange("dateTo")} />

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-none" onClick={applyFilters}>
              Apply
            </Button>
            <Button type="button" variant="ghost" className="rounded-none" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel
        title="Audit Feed"
        description="Each item represents an event that can be inferred directly from existing database timestamps and actor relationships."
      >
        {error ? (
          <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!error && !loading && rows.length === 0 ? (
          <div className="border border-dashed border-border/80 px-4 py-8 text-sm text-muted-foreground">
            No audit items are available for the selected filters.
          </div>
        ) : null}

        {!error && rows.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing page {pagination.page} of {pagination.totalPages} with {pagination.total} audit item(s).
              </p>
              <p>
                Date filter: {filters.dateFrom || filters.dateTo ? `${filters.dateFrom || "Any"} to ${filters.dateTo || "Any"}` : "All dates"}
              </p>
            </div>

            <div className="space-y-3">
              {rows.map((item, index) => (
                <div
                  key={`${item.occurred_at}-${item.category}-${item.action}-${index}`}
                  className="border border-border/80 bg-background px-4 py-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                            categoryTone[item.category] ?? "border-border bg-muted/30 text-foreground"
                          }`}
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          <Activity className="mr-1.5 h-3 w-3" />
                          {item.category}
                        </span>
                        <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          {item.action.replace(/_/g, " ")}
                        </span>
                      </div>

                      <p className="text-sm font-medium leading-6 text-foreground">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.actor_name ? `Actor: ${item.actor_name} (${formatRole(item.actor_role)})` : "Actor: Not captured by current schema"}
                      </p>
                    </div>

                    <p className="shrink-0 text-xs text-muted-foreground">{formatDateTime(item.occurred_at)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                disabled={refreshing || pagination.page <= 1}
                onClick={() => goToPage(pagination.page - 1)}
              >
                Previous
              </Button>

              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </p>

              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                disabled={refreshing || pagination.page >= pagination.totalPages}
                onClick={() => goToPage(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </AdminPanel>
    </AdminPage>
  );
};

export default AdminAuditLogs;

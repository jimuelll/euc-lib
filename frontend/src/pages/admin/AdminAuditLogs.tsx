import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Activity, RefreshCcw } from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { AdminPage, AdminPanel } from "./components/AdminPage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AuditItem {
  occurred_at: string;
  category: string;
  action: string;
  actor_name: string | null;
  actor_role: string | null;
  description: string;
  metadata: unknown;
  restore_status: "retained" | "reversed";
  reversed_at: string | null;
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
  actionsByCategory: Record<string, string[]>;
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
  { value: "catalog", label: "Catalog & policies" },
  { value: "academic_settings", label: "Academic settings" },
  { value: "attendance", label: "Attendance" },
  { value: "borrowing", label: "Borrowing" },
  { value: "reservation", label: "Reservation" },
  { value: "bulletin", label: "Bulletin" },
  { value: "events", label: "Events" },
  { value: "content", label: "Content" },
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
  catalog: "border-violet-500/20 bg-violet-500/10 text-violet-700",
  academic_settings: "border-orange-500/20 bg-orange-500/10 text-orange-700",
  events: "border-cyan-500/20 bg-cyan-500/10 text-cyan-700",
  content: "border-indigo-500/20 bg-indigo-500/10 text-indigo-700",
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

const formatRole = (role: string | null) => (role ? role.replace(/_/g, " ") : "System");
const auditChanges = (metadata: unknown): Array<{ field: string; value: string }> => {
  if (!metadata) return [];
  try {
    const parsed = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];

    const { changes, ...fields } = parsed as {
      changes?: unknown;
      [key: string]: unknown;
    };
    const directFields = Object.entries(fields)
      .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
      .map(([field, value]) => ({
        field: field.replace(/_/g, " "),
        value: String(value),
      }));
    const changedFields = Array.isArray(changes)
      ? changes
        .filter((change): change is { field: string; value: string } =>
          !!change && typeof change === "object" && typeof change.field === "string" && typeof change.value === "string"
        )
      : [];

    return [...directFields, ...changedFields];
  } catch { return []; }
};

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
  const [actionsByCategory, setActionsByCategory] = useState<Record<string, string[]>>({});

  const loadAuditLogs = useCallback(async (
    mode: "initial" | "refresh",
    nextPage: number,
    nextFilters: typeof emptyFilters,
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
  }, []);

  useEffect(() => {
    void loadAuditLogs("initial", 1, emptyFilters);
  }, [loadAuditLogs]);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const res = await axiosInstance.get<AuditMetaResponse>("/api/admin/dashboard/audit/meta");
        setActionOptions(res.data.actions);
        setActionsByCategory(res.data.actionsByCategory ?? {});
      } catch {
        setActionOptions([]);
        setActionsByCategory({});
      }
    };

    void loadMeta();
  }, []);

  const handleFilterChange = (key: keyof typeof emptyFilters) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
  };

  const handleCategoryChange = (value: string) => {
    setFilters((current) => ({
      ...current,
      category: value,
      action: "",
    }));
  };

  const visibleActionOptions =
    filters.category && filters.category !== "all"
      ? (actionsByCategory[filters.category] ?? [])
      : actionOptions;

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
      description="A durable, actor-aware record of every successful change made through the system."
      actions={
        <Button
          type="button"
          variant="outline"
          className="rounded-none"
          onClick={() => void loadAuditLogs("refresh", page, filters)}
          disabled={loading || refreshing}
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Audit Feed
        </Button>
      }
    >
      <AdminPanel title="Filters" description="Narrow the audit feed by category, action, or date range.">
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="audit-category" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Category
              </Label>
              <Select value={filters.category} onValueChange={handleCategoryChange}>
                <SelectTrigger id="audit-category" className="rounded-none">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent onWheelCapture={(event) => event.stopPropagation()}>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-action" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Action
              </Label>
              <Select value={filters.action || "all"} onValueChange={(value) => setFilters((current) => ({ ...current, action: value === "all" ? "" : value }))}>
                <SelectTrigger id="audit-action" className="rounded-none">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent onWheelCapture={(event) => event.stopPropagation()}>
                  <SelectItem value="all">All actions</SelectItem>
                  {visibleActionOptions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-start-date" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Start date
              </Label>
              <Input id="audit-start-date" type="date" className="rounded-none" value={filters.dateFrom} onChange={handleFilterChange("dateFrom")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-end-date" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                End date
              </Label>
              <Input id="audit-end-date" type="date" className="rounded-none" value={filters.dateTo} onChange={handleFilterChange("dateTo")} />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" className="rounded-none" variant="outline">
                Apply
              </Button>
              <Button type="button" variant="ghost" className="rounded-none" onClick={resetFilters}>
                Reset
              </Button>
            </div>
          </div>
        </form>
      </AdminPanel>

      <AdminPanel
        title="Audit Feed"
        description="Each item records the completed action, its category, time, and responsible account when one is available."
      >
        {loading ? <div className="space-y-3" aria-label="Loading audit records">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-20 w-full rounded-none" />)}</div> : null}
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
                      {auditChanges(item.metadata).length ? <dl className="grid gap-x-5 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">{auditChanges(item.metadata).map((change) => <div key={change.field} className="flex min-w-0 gap-1"><dt className="shrink-0 font-medium text-foreground">{change.field}:</dt><dd className="truncate">{change.value}</dd></div>)}</dl> : null}
                      {item.restore_status === "reversed" ? <p className="inline-flex w-fit border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs font-semibold text-destructive">Reversed by snapshot restore{item.reversed_at ? ` · ${formatDateTime(item.reversed_at)}` : ""}</p> : null}
                      <p className="text-xs text-muted-foreground">
                        {item.actor_name ? `Actor: ${item.actor_name} (${formatRole(item.actor_role)})` : "Actor: System or unauthenticated action"}
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

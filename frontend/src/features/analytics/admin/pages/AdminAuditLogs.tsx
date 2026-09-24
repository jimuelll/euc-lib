import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Activity, RefreshCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { AdminPage, AdminPanel } from "@/features/admin";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchAuditLogs, fetchAuditMeta, type AuditItem } from "@/features/analytics/api/adminAnalytics.api";

const emptyFilters = {
  query: "",
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
  { value: "backup", label: "Backup" },
  { value: "clearance", label: "Clearance & payments" },
  { value: "system", label: "System" },
];

const categoryTone: Record<string, string> = {
  auth: "border-primary/20 bg-primary/5 text-action",
  users: "border-warning/20 bg-warning/10 text-warning",
  attendance: "border-success/20 bg-success/10 text-success",
  borrowing: "border-sky-500/20 bg-sky-500/10 text-sky-600",
  reservation: "border-amber-500/20 bg-amber-500/10 text-amber-700",
  bulletin: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-700",
  subscriptions: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
 notifications: "border-rose-500/20 bg-rose-500/10 text-rose-700",
  backup: "border-slate-500/20 bg-slate-500/10 text-slate-700",
  clearance: "border-lime-500/20 bg-lime-500/10 text-lime-700",
  system: "border-border bg-muted/30 text-foreground",
  catalog: "border-violet-500/20 bg-violet-500/10 text-violet-700",
  academic_settings: "border-orange-500/20 bg-orange-500/10 text-orange-700",
  events: "border-cyan-500/20 bg-cyan-500/10 text-cyan-700",
  content: "border-indigo-500/20 bg-indigo-500/10 text-indigo-700",
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

const formatRole = (role: string | null) => (role ? role.replace(/_/g, " ") : "System");
type AuditChange = { field: string; value?: string; before?: string; after?: string };
const formatAuditChange = (change: AuditChange) => `${change.field}: ${change.before !== undefined ? `${change.before} → ${change.after}` : change.value ?? "Changed"}`;
const auditChanges = (metadata: unknown): AuditChange[] => {
  if (!metadata) return [];
  try {
    const parsed = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];

    const { changes, ...fields } = parsed as {
      changes?: unknown;
      [key: string]: unknown;
    };
    const directFields = Object.entries(fields)
      .filter(([field, value]) => !["target_id", "detail_status", "affected_record_count", "affected_record_type"].includes(field) && ["string", "number", "boolean"].includes(typeof value))
      .map(([field, value]) => ({
        field: field.replace(/_/g, " "),
        value: String(value),
      }));
    const changedFields = Array.isArray(changes)
      ? changes
        .filter((change): change is { field: string; value?: string; before?: string; after?: string } =>
          !!change
          && typeof change === "object"
          && typeof change.field === "string"
          && (
            typeof change.value === "string"
            || (typeof change.before === "string" && typeof change.after === "string")
          )
        )
      : [];

    return [...directFields, ...changedFields];
  } catch { return []; }
};

const auditDetailStatus = (metadata: unknown) => {
  if (!metadata) return "";
  try {
    const parsed = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof parsed.detail_status === "string" ? parsed.detail_status : "";
  } catch { return ""; }
};

const auditAffectedSummary = (metadata: unknown) => {
  if (!metadata) return null;
  try {
    const parsed = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const count = Number(parsed.affected_record_count);
    const kind = typeof parsed.affected_record_type === "string" ? parsed.affected_record_type : "records";
    return Number.isFinite(count) ? `Affected ${count} ${kind}` : `Affected ${kind}`;
  } catch { return null; }
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
      const result = await fetchAuditLogs({
        page: nextPage,
        limit: 10,
        category: nextFilters.category,
        action: nextFilters.action || undefined,
        query: nextFilters.query || undefined,
        dateFrom: nextFilters.dateFrom || undefined,
        dateTo: nextFilters.dateTo || undefined,
      });

      setRows(result.rows);
      setPagination(result.pagination);
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
        const result = await fetchAuditMeta();
        setActionOptions(result.actions);
        setActionsByCategory(result.actionsByCategory ?? {});
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
          className="rounded-md"
          onClick={() => void loadAuditLogs("refresh", page, filters)}
          disabled={loading || refreshing}
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Audit Feed
        </Button>
      }
    >
      <AdminPanel title="Filters" description="Search actors, actions, descriptions, and record details, or narrow the feed by category and date.">
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="audit-search" className="text-xs font-semibold text-muted-foreground">
                Search audit logs
              </Label>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="audit-search" type="search" autoComplete="off" className="rounded-md pl-9" value={filters.query} onChange={handleFilterChange("query")} placeholder="Actor, action, description…" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-category" className="text-xs font-semibold  text-muted-foreground">
                Category
              </Label>
              <Select value={filters.category} onValueChange={handleCategoryChange}>
                <SelectTrigger id="audit-category" className="rounded-md">
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
              <Label htmlFor="audit-action" className="text-xs font-semibold  text-muted-foreground">
                Action
              </Label>
              <Select value={filters.action || "all"} onValueChange={(value) => setFilters((current) => ({ ...current, action: value === "all" ? "" : value }))}>
                <SelectTrigger id="audit-action" className="rounded-md">
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
              <Label htmlFor="audit-start-date" className="text-xs font-semibold  text-muted-foreground">
                Start date
              </Label>
              <Input id="audit-start-date" type="date" className="rounded-md" value={filters.dateFrom} onChange={handleFilterChange("dateFrom")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-end-date" className="text-xs font-semibold  text-muted-foreground">
                End date
              </Label>
              <Input id="audit-end-date" type="date" className="rounded-md" value={filters.dateTo} onChange={handleFilterChange("dateTo")} />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" className="rounded-md" variant="outline">
                Apply
              </Button>
              <Button type="button" variant="ghost" className="rounded-md" onClick={resetFilters}>
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
        {loading ? <div className="space-y-3" aria-label="Loading audit records">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-20 w-full rounded-md" />)}</div> : null}
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
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {filters.query.trim() && <p className="max-w-full truncate">Search: {filters.query.trim()}</p>}
                <p>Date filter: {filters.dateFrom || filters.dateTo ? `${filters.dateFrom || "Any"} to ${filters.dateTo || "Any"}` : "All dates"}</p>
              </div>
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
                          className={`inline-flex items-center border px-2.5 py-1 text-xs font-bold  ${
                            categoryTone[item.category] ?? "border-border bg-muted/30 text-foreground"
                          }`}
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          <Activity className="mr-1.5 h-3 w-3" />
                          {item.category}
                        </span>
                        <span className="text-xs  text-muted-foreground">
                          {item.action.replace(/_/g, " ")}
                        </span>
                      </div>

                      <p className="text-sm font-medium leading-6 text-foreground">{item.copy_display_description ?? item.description}</p>
                      {auditChanges(item.metadata).length ? <details className="max-w-full border border-border/70 bg-muted/15 px-3 py-2 text-xs"><summary className="flex cursor-pointer flex-wrap items-start justify-between gap-2 font-medium text-foreground"><span className="min-w-0 break-words whitespace-normal">{auditChanges(item.metadata).map(formatAuditChange).join(" · ")}</span><span className="shrink-0 text-muted-foreground">View details</span></summary><dl className="mt-2 grid gap-x-5 gap-y-2 text-muted-foreground sm:grid-cols-2">{auditChanges(item.metadata).map((change) => <div key={change.field} className="min-w-0"><dt className="font-medium text-foreground">{change.field}</dt><dd className="break-words whitespace-normal">{change.before !== undefined ? `${change.before} → ${change.after}` : change.value}</dd></div>)}</dl></details> : auditDetailStatus(item.metadata) === "no_field_changes" ? <p className="text-xs font-medium text-muted-foreground">No field changes</p> : auditDetailStatus(item.metadata) === "details_unavailable" ? <p className="text-xs font-medium text-muted-foreground">Details unavailable</p> : auditDetailStatus(item.metadata) === "affected_record_summary" ? <p className="text-xs font-medium text-muted-foreground">{auditAffectedSummary(item.metadata)}</p> : null}
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
                className="rounded-md"
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
                className="rounded-md"
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

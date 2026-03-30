import { useEffect, useState } from "react";
import { Activity, BookCopy, Globe, MousePointerClick, RefreshCcw, Users } from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
import { Button } from "@/components/ui/button";
import { AdminPage, AdminPanel, AdminStatCard, AdminStatGrid } from "./components/AdminPage";

interface DashboardStats {
  total_books: number;
  active_users: number;
  unique_visitors_today: number;
  visit_hits_today: number;
  total_unique_visitors: number;
  total_visit_hits: number;
}

interface AuditItem {
  occurred_at: string;
  category: string;
  action: string;
  actor_name: string | null;
  actor_role: string | null;
  description: string;
}

interface DashboardResponse {
  stats: DashboardStats;
  auditLog: AuditItem[];
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

const emptyStats: DashboardStats = {
  total_books: 0,
  active_users: 0,
  unique_visitors_today: 0,
  visit_hits_today: 0,
  total_unique_visitors: 0,
  total_visit_hits: 0,
};

const emptyPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
};

const emptyFilters = {
  category: "all",
  action: "",
  dateFrom: "",
  dateTo: "",
};

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const formatRole = (role: string | null) => {
  if (!role) return "System";
  return role.replace(/_/g, " ");
};

const categoryTone: Record<string, string> = {
  auth: "border-primary/20 bg-primary/5 text-primary",
  users: "border-warning/20 bg-warning/10 text-warning",
  attendance: "border-success/20 bg-success/10 text-success",
  borrowing: "border-sky-500/20 bg-sky-500/10 text-sky-600",
  reservation: "border-amber-500/20 bg-amber-500/10 text-amber-700",
  bulletin: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-700",
  subscriptions: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
  about: "border-slate-500/20 bg-slate-500/10 text-slate-700",
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
  { value: "about", label: "About" },
];

const AdminHome = () => {
  const [data, setData] = useState<DashboardResponse>({
    stats: emptyStats,
    auditLog: [],
    pagination: emptyPagination,
    filters: emptyFilters,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);

  const loadDashboard = async (
    mode: "initial" | "refresh" = "initial",
    nextPage = page,
    nextFilters = filters
  ) => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    setError("");

    try {
      const res = await axiosInstance.get<DashboardResponse>("/api/admin/dashboard", {
        params: {
          limit: 10,
          page: nextPage,
          category: nextFilters.category,
          action: nextFilters.action || undefined,
          dateFrom: nextFilters.dateFrom || undefined,
          dateTo: nextFilters.dateTo || undefined,
        },
      });
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load dashboard data");
    } finally {
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleFilterChange = (key: keyof typeof emptyFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setPage(1);
    loadDashboard("refresh", 1, filters);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setPage(1);
    loadDashboard("refresh", 1, emptyFilters);
  };

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    loadDashboard("refresh", nextPage, filters);
  };

  const stats = [
    {
      label: "Total Books",
      value: formatNumber(data.stats.total_books),
      icon: BookCopy,
      helperText: "All non-archived book records currently tracked in the catalog.",
    },
    {
      label: "Active Users",
      value: formatNumber(data.stats.active_users),
      icon: Users,
      helperText: "User accounts that are active and not archived.",
    },
    {
      label: "Visitors Today",
      value: formatNumber(data.stats.unique_visitors_today),
      icon: Globe,
      helperText: `${formatNumber(data.stats.visit_hits_today)} dashboard-tracked visit hit(s) recorded today.`,
    },
    {
      label: "All-Time Visitors",
      value: formatNumber(data.stats.total_unique_visitors),
      icon: MousePointerClick,
      helperText: `${formatNumber(data.stats.total_visit_hits)} total tracked visit hit(s) since logging began.`,
    },
  ];

  return (
    <AdminPage
      eyebrow="Library Management"
      title="Dashboard"
      description="A live operations view for visitor traffic and the activity trail that the current database can already surface."
      actions={
        <Button
          type="button"
          variant="outline"
          className="rounded-none"
          onClick={() => loadDashboard("refresh")}
          disabled={loading || refreshing}
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      }
    >
      <AdminStatGrid>
        {stats.map((stat) => (
          <AdminStatCard
            key={stat.label}
            label={stat.label}
            value={loading ? "..." : stat.value}
            helperText={stat.helperText}
            icon={<stat.icon className="h-4 w-4" />}
          />
        ))}
      </AdminStatGrid>

      <AdminPanel
        title="Site Visits"
        description="Visitor counts are tracked through a dedicated visit log. Counts update when someone opens the site in a new browser session and the backend records that visit."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="border border-border/80 bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Unique Visitors Today
            </p>
            <p
              className="mt-2 text-3xl font-semibold tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {loading ? "..." : formatNumber(data.stats.unique_visitors_today)}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Distinct visitor cookies seen by the backend today.
            </p>
          </div>

          <div className="border border-border/80 bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Recorded Visit Hits Today
            </p>
            <p
              className="mt-2 text-3xl font-semibold tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {loading ? "..." : formatNumber(data.stats.visit_hits_today)}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Includes repeat tracked hits from the same visitor during the day.
            </p>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel
        title="Audit Log"
        description="This feed is assembled from timestamps and actor fields that already exist in the current backend and database schema."
      >
        <div className="mb-5 grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange("category", e.target.value)}
            className="h-10 border border-border bg-background px-3 text-sm text-foreground outline-none"
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={filters.action}
            onChange={(e) => handleFilterChange("action", e.target.value)}
            placeholder="Action, e.g. archived"
            className="h-10 border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
          />

          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
            className="h-10 border border-border bg-background px-3 text-sm text-foreground outline-none"
          />

          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange("dateTo", e.target.value)}
            className="h-10 border border-border bg-background px-3 text-sm text-foreground outline-none"
          />

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-none" onClick={applyFilters}>
              Apply
            </Button>
            <Button type="button" variant="ghost" className="rounded-none" onClick={clearFilters}>
              Reset
            </Button>
          </div>
        </div>

        {error ? (
          <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!error && !loading && data.auditLog.length === 0 ? (
          <div className="border border-dashed border-border/80 px-4 py-8 text-sm text-muted-foreground">
            No audit items are available yet.
          </div>
        ) : null}

        {!error && data.auditLog.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing page {data.pagination.page} of {data.pagination.totalPages} with {data.pagination.total} audit item(s).
              </p>
              <p>
                Date filter:
                {" "}
                {filters.dateFrom || filters.dateTo
                  ? `${filters.dateFrom || "Any"} to ${filters.dateTo || "Any"}`
                  : "All dates"}
              </p>
            </div>

            <div className="space-y-3">
              {data.auditLog.map((item, index) => (
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
                        {item.actor_name
                          ? `Actor: ${item.actor_name} (${formatRole(item.actor_role)})`
                          : "Actor: Not captured by current schema"}
                      </p>
                    </div>

                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(item.occurred_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                disabled={refreshing || data.pagination.page <= 1}
                onClick={() => goToPage(data.pagination.page - 1)}
              >
                Previous
              </Button>

              <p className="text-sm text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </p>

              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                disabled={refreshing || data.pagination.page >= data.pagination.totalPages}
                onClick={() => goToPage(data.pagination.page + 1)}
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

export default AdminHome;

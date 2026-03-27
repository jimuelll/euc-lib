import { useEffect, useRef, useState, useCallback } from "react";
import {
  Users,
  LogIn,
  LogOut,
  RefreshCw,
  ChevronDown,
  Search,
  Clock,
  Loader2,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceLog {
  id: number;
  type: "check_in" | "check_out";
  timestamp: string;
  name: string;
  student_employee_id: string;
  role: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (iso: string) => {
  const d = new Date(iso);
  return {
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  };
};

const today = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

// ─── Component ────────────────────────────────────────────────────────────────

const AdminAttendanceLogs = () => {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "check_in" | "check_out">("all");
  const lastIdRef = useRef<number | null>(null);

  const fetchLogs = useCallback(async (cursor: number | null = null) => {
    try {
      const params: Record<string, string | number> = { limit: PAGE_SIZE };
      if (cursor) params.lastId = cursor;

      const res = await axiosInstance.get("/api/attendance/today", { params });
      const rows: AttendanceLog[] = res.data;

      if (cursor) {
        setLogs((prev) => [...prev, ...rows]);
      } else {
        setLogs(rows);
      }

      if (rows.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        lastIdRef.current = rows[rows.length - 1].id;
      }

      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Failed to load attendance logs");
    }
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    lastIdRef.current = null;
    setHasMore(true);
    fetchLogs(null).finally(() => setLoading(false));
  }, [fetchLogs]);

  const handleRefresh = () => {
    setLoading(true);
    lastIdRef.current = null;
    setHasMore(true);
    setLogs([]);
    fetchLogs(null).finally(() => setLoading(false));
  };

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await fetchLogs(lastIdRef.current);
    setLoadingMore(false);
  };

  // Derived stats
  const checkIns = logs.filter((l) => l.type === "check_in").length;
  const checkOuts = logs.filter((l) => l.type === "check_out").length;
  const currentlyInside = checkIns - checkOuts;

  // Filter + search
  const visible = logs.filter((l) => {
    const matchType = filter === "all" || l.type === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      l.name.toLowerCase().includes(q) ||
      l.student_employee_id.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Page header ── */}
      <div className="bg-primary border-b border-primary-foreground/10 relative overflow-hidden">
        <div className="h-[3px] w-full bg-warning" />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
          }}
        />
        <div className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
        <div className="container px-4 sm:px-6 py-10 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-6 bg-warning" />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Admin · Attendance
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Users className="h-7 w-7 text-primary-foreground/60 shrink-0" />
              <div>
                <h1
                  className="text-2xl sm:text-3xl font-bold text-primary-foreground tracking-tight"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Attendance Logs
                </h1>
                <p className="mt-1 text-sm text-primary-foreground/40">{today()}</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="shrink-0 flex items-center gap-2 border border-primary-foreground/20 bg-primary-foreground/5 hover:bg-primary-foreground/10 text-primary-foreground/70 hover:text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors disabled:opacity-40"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 bg-background py-10">
        <div className="container px-4 sm:px-6 space-y-6">

          {/* ── Stats strip ── */}
          <div className="grid grid-cols-3 border border-border">
            {/* Check-ins */}
            <div className="flex flex-col items-center justify-center gap-1 border-r border-border px-4 py-6">
              <LogIn className="h-5 w-5 text-muted-foreground mb-1" />
              <span
                className="text-3xl font-bold text-foreground tabular-nums"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {loading ? "—" : checkIns}
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Time In
              </span>
            </div>

            {/* Check-outs */}
            <div className="flex flex-col items-center justify-center gap-1 border-r border-border px-4 py-6">
              <LogOut className="h-5 w-5 text-muted-foreground mb-1" />
              <span
                className="text-3xl font-bold text-foreground tabular-nums"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {loading ? "—" : checkOuts}
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Time Out
              </span>
            </div>

            {/* Currently inside */}
            <div className="flex flex-col items-center justify-center gap-1 px-4 py-6">
              <TrendingUp className="h-5 w-5 text-warning mb-1" />
              <span
                className="text-3xl font-bold text-foreground tabular-nums"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {loading ? "—" : Math.max(0, currentlyInside)}
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Inside Now
              </span>
            </div>
          </div>

          {/* ── Filter + Search bar ── */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Type filter tabs */}
            <div className="flex border border-border shrink-0">
              {(["all", "check_in", "check_out"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] border-r last:border-r-0 border-border transition-colors ${
                    filter === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {t === "all" ? "All" : t === "check_in" ? "Time In" : "Time Out"}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or ID…"
                className="w-full border border-border bg-background pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* ── Table ── */}
          <div className="border border-border overflow-hidden">

            {/* Table header */}
            <div className="bg-primary">
              <div className="h-[2px] w-full bg-warning" />
              <div className="grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[2fr_1fr_1fr_auto] px-4 sm:px-6 py-3 gap-4">
                {["Name / ID", "Role", "Type", "Time"].map((h) => (
                  <span
                    key={h}
                    className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground/40"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground bg-background">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Loading…
                </span>
              </div>
            )}

            {/* Error state */}
            {!loading && error && (
              <div className="flex items-center justify-center gap-3 py-20 text-destructive/70 bg-background">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && visible.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-20 bg-background">
                <Clock className="h-8 w-8 text-muted-foreground/20" />
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/30"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {search || filter !== "all" ? "No matching records" : "No entries yet today"}
                </p>
              </div>
            )}

            {/* Rows */}
            {!loading && !error && visible.length > 0 && (
              <div className="divide-y divide-border bg-background">
                {visible.map((log, i) => {
                  const { time, date } = fmt(log.timestamp);
                  const isIn = log.type === "check_in";
                  return (
                    <div
                      key={log.id}
                      className={`grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[2fr_1fr_1fr_auto] items-center px-4 sm:px-6 py-3.5 gap-4 transition-colors hover:bg-muted/30 ${
                        i % 2 === 0 ? "" : "bg-muted/10"
                      }`}
                    >
                      {/* Name / ID */}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{log.name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground/50 truncate">
                          {log.student_employee_id}
                        </p>
                      </div>

                      {/* Role */}
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50 hidden sm:block"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {log.role}
                      </span>

                      {/* Type badge */}
                      <div className="flex items-center gap-1.5">
                        {isIn ? (
                          <LogIn className="h-3.5 w-3.5 text-foreground/60 shrink-0" />
                        ) : (
                          <LogOut className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        )}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-[0.12em] hidden sm:block ${
                            isIn ? "text-foreground/70" : "text-muted-foreground/40"
                          }`}
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          {isIn ? "In" : "Out"}
                        </span>
                      </div>

                      {/* Time */}
                      <div className="text-right shrink-0">
                        <p
                          className="text-sm font-bold text-foreground tabular-nums"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          {time}
                        </p>
                        <p className="text-[10px] text-muted-foreground/40 hidden sm:block">{date}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Load more */}
            {!loading && !error && hasMore && visible.length > 0 && !search && filter === "all" && (
              <div className="border-t border-border bg-background">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full flex items-center justify-center gap-2 py-3.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-40"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {loadingMore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {loadingMore ? "Loading…" : "Load More"}
                </button>
              </div>
            )}

            {/* Footer count */}
            {!loading && !error && visible.length > 0 && (
              <div className="border-t border-border bg-muted/10 px-4 sm:px-6 py-3">
                <p
                  className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em]"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Showing {visible.length} {visible.length === 1 ? "record" : "records"}
                  {(search || filter !== "all") && ` · filtered from ${logs.length} total`}
                </p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default AdminAttendanceLogs;
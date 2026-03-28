import { Users, RefreshCw } from "lucide-react";
import type { AttendanceLog, AttendanceStats, FetchState, FilterType } from "./AdminAttendanceLogs.types";
import { formatTodayLabel } from "./AdminAttendanceLogs.data";
import {
  StatsStrip,
  FilterBar,
  TableHeader,
  TableRow,
  LoadingState,
  ErrorState,
  EmptyState,
  LoadMoreButton,
  TableFooter,
} from "./components/AdminAttendanceLogs.components";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdminAttendanceLogsBuilderProps {
  logs: AttendanceLog[];
  visible: AttendanceLog[];
  stats: AttendanceStats;
  fetchState: FetchState;
  search: string;
  filter: FilterType;
  onSearchChange: (v: string) => void;
  onFilterChange: (v: FilterType) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
}

// ─── Builder (pure presentational) ───────────────────────────────────────────

const AdminAttendanceLogsBuilder = ({
  logs,
  visible,
  stats,
  fetchState,
  search,
  filter,
  onSearchChange,
  onFilterChange,
  onRefresh,
  onLoadMore,
}: AdminAttendanceLogsBuilderProps) => {
  const { loading, loadingMore, error, hasMore } = fetchState;

  const isFiltered = !!(search || filter !== "all");
  const showLoadMore =
    !loading && !error && hasMore && visible.length > 0 && !search && filter === "all";

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
                <p className="mt-1 text-sm text-primary-foreground/40">{formatTodayLabel()}</p>
              </div>
            </div>

            <button
              onClick={onRefresh}
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

      {/* ── Main ── */}
      <main className="flex-1 bg-background py-10">
        <div className="container px-4 sm:px-6 space-y-6">

          <StatsStrip stats={stats} loading={loading} />

          <FilterBar
            filter={filter}
            search={search}
            onFilterChange={onFilterChange}
            onSearchChange={onSearchChange}
          />

          {/* Table */}
          <div className="border border-border overflow-hidden">
            <TableHeader />

            {loading && <LoadingState />}
            {!loading && error && <ErrorState message={error} />}
            {!loading && !error && visible.length === 0 && (
              <EmptyState isFiltered={isFiltered} />
            )}

            {!loading && !error && visible.length > 0 && (
              <div className="divide-y divide-border bg-background">
                {visible.map((log, i) => (
                  <TableRow key={log.id} log={log} index={i} />
                ))}
              </div>
            )}

            {showLoadMore && (
              <LoadMoreButton loadingMore={loadingMore} onLoadMore={onLoadMore} />
            )}

            {!loading && !error && visible.length > 0 && (
              <TableFooter
                visibleCount={visible.length}
                totalCount={logs.length}
                isFiltered={isFiltered}
              />
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default AdminAttendanceLogsBuilder;
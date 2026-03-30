import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPage, AdminPanel } from "../components/AdminPage";
import { formatTodayLabel } from "./AdminAttendanceLogs.data";
import type { AttendanceLog, AttendanceStats, FetchState, FilterType } from "./AdminAttendanceLogs.types";
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
  const isFiltered = Boolean(search || filter !== "all");
  const showLoadMore =
    !loading && !error && hasMore && visible.length > 0 && !search && filter === "all";

  return (
    <AdminPage
      eyebrow="Reports"
      title="Attendance Logs"
      description={`Monitor daily visits, search attendance records, and review the latest activity. ${formatTodayLabel()}.`}
      contentWidth="wide"
      actions={
        <Button onClick={onRefresh} disabled={loading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      <StatsStrip stats={stats} loading={loading} />

      <AdminPanel
        title="Filters"
        description="Refine the attendance list by search term or current status."
      >
        <FilterBar
          filter={filter}
          search={search}
          onFilterChange={onFilterChange}
          onSearchChange={onSearchChange}
        />
      </AdminPanel>

      <AdminPanel
        title="Attendance records"
        description="Recent entries are listed first. Use search to narrow results before reviewing individual rows."
        contentClassName="p-0"
      >
        <div className="overflow-hidden">
          <TableHeader />

          {loading ? <LoadingState /> : null}
          {!loading && error ? <ErrorState message={error} /> : null}
          {!loading && !error && visible.length === 0 ? <EmptyState isFiltered={isFiltered} /> : null}

          {!loading && !error && visible.length > 0 ? (
            <div className="divide-y divide-border bg-background">
              {visible.map((log, index) => (
                <TableRow key={log.id} log={log} index={index} />
              ))}
            </div>
          ) : null}

          {showLoadMore ? (
            <LoadMoreButton loadingMore={loadingMore} onLoadMore={onLoadMore} />
          ) : null}

          {!loading && !error && visible.length > 0 ? (
            <TableFooter
              visibleCount={visible.length}
              totalCount={logs.length}
              isFiltered={isFiltered}
            />
          ) : null}
        </div>
      </AdminPanel>
    </AdminPage>
  );
};

export default AdminAttendanceLogsBuilder;

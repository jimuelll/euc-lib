import { useAttendanceLogs } from "./useAttendanceLogs";
import AdminAttendanceLogsBuilder from "./AdminAttendanceLogsBuilder";

/**
 * AdminAttendanceLogs
 *
 * Entry point. Owns no local state — delegates everything to
 * `useAttendanceLogs` (logic) and `AdminAttendanceLogsBuilder` (UI).
 */
const AdminAttendanceLogs = () => {
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

  return (
    <AdminAttendanceLogsBuilder
      logs={logs}
      visible={visible}
      stats={stats}
      fetchState={fetchState}
      search={search}
      filter={filter}
      onSearchChange={setSearch}
      onFilterChange={setFilter}
      onRefresh={handleRefresh}
      onLoadMore={handleLoadMore}
    />
  );
};

export default AdminAttendanceLogs;
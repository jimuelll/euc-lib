import { useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminUrlState } from "@/features/admin";
import type { AttendanceLog, FetchState, FilterType } from "./AdminAttendanceLogs.types";
import { PAGE_SIZE, applyFilters, deriveStats } from "./AdminAttendanceLogs.data";
import { fetchTodayAttendance } from "./attendance.api";
import { attendanceKeys } from "./attendance.keys";

interface UseAttendanceLogsReturn {
  logs: AttendanceLog[];
  visible: AttendanceLog[];
  fetchState: FetchState;
  stats: ReturnType<typeof deriveStats>;
  search: string;
  filter: FilterType;
  setSearch: (v: string) => void;
  setFilter: (v: FilterType) => void;
  handleRefresh: () => void;
  handleLoadMore: () => void;
}

export const useAttendanceLogs = (): UseAttendanceLogsReturn => {
  const queryClient = useQueryClient();
  const [params, patchParams] = useAdminUrlState();
  const search = params.get("q") ?? "";
  const filter: FilterType = params.get("type") === "check_in" ? "check_in" : params.get("type") === "check_out" ? "check_out" : "all";
  const query = useInfiniteQuery({
    queryKey: attendanceKeys.today(),
    initialPageParam: null as number | null,
    queryFn: ({ pageParam, signal }) => fetchTodayAttendance({ limit: PAGE_SIZE, ...(pageParam ? { lastId: pageParam } : {}) }, signal),
    getNextPageParam: (lastPage) => lastPage.length < PAGE_SIZE ? undefined : lastPage[lastPage.length - 1]?.id,
  });
  const logs = useMemo(() => query.data?.pages.flat() ?? [], [query.data]);
  const visible = useMemo(() => applyFilters(logs, filter, search), [logs, filter, search]);
  const stats = useMemo(() => deriveStats(logs), [logs]);

  return {
    logs,
    visible,
    fetchState: {
      loading: query.isPending,
      loadingMore: query.isFetchingNextPage,
      error: query.isError ? (query.error as any)?.response?.data?.message ?? "Failed to load attendance logs" : null,
      hasMore: Boolean(query.hasNextPage),
    },
    stats,
    search,
    filter,
    setSearch: (value) => patchParams({ q: value }, true),
    setFilter: (value) => patchParams({ type: value }),
    handleRefresh: () => { void queryClient.resetQueries({ queryKey: attendanceKeys.today() }); },
    handleLoadMore: () => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); },
  };
};

import { useCallback, useEffect, useRef, useState } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import type { AttendanceLog, FetchState, FilterType } from "./AdminAttendanceLogs.types";
import { PAGE_SIZE, applyFilters, deriveStats } from "./AdminAttendanceLogs.data";

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
  const [logs,        setLogs]        = useState<AttendanceLog[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [hasMore,     setHasMore]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState<FilterType>("all");

  const lastIdRef = useRef<number | null>(null);

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async (cursor: number | null = null) => {
    try {
      const params: Record<string, string | number> = { limit: PAGE_SIZE };
      if (cursor) params.lastId = cursor;

      const res  = await axiosInstance.get("/api/attendance/today", { params });
      const rows: AttendanceLog[] = res.data;

      setLogs((prev) => (cursor ? [...prev, ...rows] : rows));

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

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    lastIdRef.current = null;
    setHasMore(true);
    fetchLogs(null).finally(() => setLoading(false));
  }, [fetchLogs]);

  // ── Actions ────────────────────────────────────────────────────────────────
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

  // ── Derived ────────────────────────────────────────────────────────────────
  const stats   = deriveStats(logs);
  const visible = applyFilters(logs, filter, search);

  return {
    logs,
    visible,
    fetchState: { loading, loadingMore, error, hasMore },
    stats,
    search,
    filter,
    setSearch,
    setFilter,
    handleRefresh,
    handleLoadMore,
  };
};
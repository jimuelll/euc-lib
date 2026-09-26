export interface AttendanceHistoryFilters {
  page: number;
  search: string;
  type: string;
  purpose: string;
  dateFrom: string;
  dateTo: string;
}

export const attendanceKeys = {
  all: ["attendance"] as const,
  today: () => [...attendanceKeys.all, "today"] as const,
  history: () => [...attendanceKeys.all, "history"] as const,
  historyPage: (filters: AttendanceHistoryFilters) => [...attendanceKeys.history(), { ...filters, search: filters.search.trim(), page: Math.max(1, filters.page) }] as const,
};

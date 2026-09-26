import type { QueryFilters, ReportFilters } from "./api";

const normalize = <T extends Record<string, string | number | undefined>>(filters: T) => Object.fromEntries(
  Object.entries(filters)
    .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value] as const)
    .filter(([, value]) => value !== undefined && value !== "" && value !== "all")
    .sort(([left], [right]) => left.localeCompare(right)),
);

export const queryKeys = {
  all: ["admin-query"] as const,
  meta: () => [...queryKeys.all, "meta"] as const,
  records: (filters: QueryFilters) => [...queryKeys.all, "records", normalize(filters)] as const,
  recordPreview: (filters: QueryFilters) => [...queryKeys.all, "record-preview", normalize(filters)] as const,
  reports: (filters: ReportFilters) => [...queryKeys.all, "reports", normalize(filters)] as const,
  reportPreview: (filters: ReportFilters) => [...queryKeys.all, "report-preview", normalize(filters)] as const,
};

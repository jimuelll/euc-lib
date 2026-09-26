import type { AnalyticsRange } from "./admin/pages/AdminAnalytics";

export interface AuditFilters {
  page: number;
  category: string;
  action: string;
  query: string;
  dateFrom: string;
  dateTo: string;
}

export const analyticsKeys = {
  all: ["analytics"] as const,
  dashboard: (range: AnalyticsRange) => [...analyticsKeys.all, "dashboard", range] as const,
  audit: () => [...analyticsKeys.all, "audit"] as const,
  auditPage: (filters: AuditFilters) => [...analyticsKeys.audit(), { ...filters, query: filters.query.trim(), page: Math.max(1, filters.page) }] as const,
  auditMeta: () => [...analyticsKeys.all, "audit-meta"] as const,
};

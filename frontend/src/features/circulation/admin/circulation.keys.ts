import type { CirculationLogFilters } from "./circulation.api";

export const normalizeCirculationFilters = (filters: CirculationLogFilters) => ({
  status: filters.status ?? "all",
  search: filters.search?.trim() ?? "",
  page: Math.max(1, filters.page ?? 1),
  limit: filters.limit ?? 20,
  dateFrom: filters.dateFrom ?? "",
  dateTo: filters.dateTo ?? "",
  archived: Boolean(filters.archived),
});

export const circulationKeys = {
  all: ["circulation"] as const,
  logs: () => [...circulationKeys.all, "logs"] as const,
  log: (filters: CirculationLogFilters) => [...circulationKeys.logs(), normalizeCirculationFilters(filters)] as const,
  user: (id: string) => [...circulationKeys.all, "user", id.trim()] as const,
  userSuggestions: (query: string) => [...circulationKeys.all, "user-suggestions", query.trim()] as const,
  copy: (barcode: string) => [...circulationKeys.all, "copy", barcode.trim()] as const,
  catalogSearch: (query: string) => [...circulationKeys.all, "catalog-search", query.trim()] as const,
  bookCopies: (bookId: number, type: "borrow" | "return") => [...circulationKeys.all, "book-copies", bookId, type] as const,
  returnPreview: (identifier: string) => [...circulationKeys.all, "return-preview", identifier.trim()] as const,
};

import type { PublicCatalogSearchParams } from "./api";

export const normalizeCatalogSearch = (params: PublicCatalogSearchParams) => ({
  query: params.query?.trim() ?? "",
  title: params.title?.trim() ?? "",
  author: params.author?.trim() ?? "",
  isbn: params.isbn?.trim() ?? "",
  format: params.format ?? "all",
  availability: params.availability ?? "all",
  category: params.category?.trim() ?? "",
  sort: params.sort ?? "relevance",
  page: Math.max(1, params.page ?? 1),
});

export const catalogKeys = {
  all: ["catalog"] as const,
  public: () => [...catalogKeys.all, "public"] as const,
  schema: () => [...catalogKeys.public(), "schema"] as const,
  searches: () => [...catalogKeys.public(), "search"] as const,
  search: (params: PublicCatalogSearchParams) => [...catalogKeys.searches(), normalizeCatalogSearch(params)] as const,
  admin: () => [...catalogKeys.all, "admin"] as const,
  adminSchema: () => [...catalogKeys.admin(), "schema"] as const,
  bookTypes: () => [...catalogKeys.admin(), "book-types"] as const,
  adminSearches: () => [...catalogKeys.admin(), "search"] as const,
  adminSearch: (filters: { query: string; materialType: "all" | "book" | "thesis"; page: number; status: "active" | "archived" | "all"; policyStatus?: "all" | "needs_policy" }) => [...catalogKeys.adminSearches(), { ...filters, policyStatus: filters.policyStatus ?? "all", query: filters.query.trim(), page: Math.max(1, filters.page) }] as const,
  adminCopies: (bookId: number) => [...catalogKeys.admin(), "copies", bookId] as const,
  adminCopy: (barcode: string) => [...catalogKeys.admin(), "copy", barcode.trim()] as const,
  settings: () => [...catalogKeys.admin(), "settings"] as const,
  holdings: (filters: { query?: string; programId?: number; status?: string; completion?: string; page?: number }) => [...catalogKeys.admin(), "holdings", { query: filters.query?.trim() ?? "", programId: filters.programId ?? null, status: filters.status ?? "all", completion: filters.completion ?? "all", page: Math.max(1, filters.page ?? 1) }] as const,
  bookHoldings: (bookId: number) => [...catalogKeys.admin(), "book-holdings", bookId] as const,
  embeddings: () => [...catalogKeys.admin(), "embeddings"] as const,
  embeddingStatus: () => [...catalogKeys.embeddings(), "status"] as const,
  embeddingProgress: () => [...catalogKeys.embeddings(), "progress"] as const,
  manualMetadataBooks: (filters: { query?: string; needsAttention?: boolean; page?: number }) => [...catalogKeys.embeddings(), "books", { query: filters.query?.trim() ?? "", needsAttention: filters.needsAttention ?? false, page: Math.max(1, filters.page ?? 1) }] as const,
  manualBookMetadata: (bookId: number) => [...catalogKeys.embeddings(), "book", bookId] as const,
};

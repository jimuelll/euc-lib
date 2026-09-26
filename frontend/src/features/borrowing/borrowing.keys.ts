export const borrowingKeys = {
  all: ["borrowing"] as const,
  active: () => [...borrowingKeys.all, "active"] as const,
  history: () => [...borrowingKeys.all, "history"] as const,
  historyPage: (page: number) => [...borrowingKeys.history(), Math.max(1, page)] as const,
  catalog: () => [...borrowingKeys.all, "catalog"] as const,
  catalogSearch: (query: string, page: number) => [...borrowingKeys.catalog(), { query: query.trim(), page: Math.max(1, page) }] as const,
};

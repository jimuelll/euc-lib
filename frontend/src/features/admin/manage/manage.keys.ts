export const manageKeys = {
  all: ["admin-manage"] as const,
  references: () => [...manageKeys.all, "references"] as const,
  programs: () => [...manageKeys.references(), "programs"] as const,
  terms: () => [...manageKeys.references(), "terms"] as const,
  departments: () => [...manageKeys.references(), "departments"] as const,
  users: () => [...manageKeys.all, "users"] as const,
  userSearch: (filters: { query: string; role: string; status: string; archived: boolean; page: number }) => [...manageKeys.users(), { ...filters, query: filters.query.trim(), page: Math.max(1, filters.page) }] as const,
};

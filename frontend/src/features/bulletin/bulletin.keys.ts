export interface BulletinFilters {
  page: number;
  limit: number;
  search?: string;
  type?: "announcement" | "event";
  upcoming?: boolean;
  scope?: "all";
  archived?: boolean;
  month?: string;
}

export const normalizeBulletinFilters = (filters: BulletinFilters) => ({
  page: Math.max(1, filters.page),
  limit: filters.limit,
  search: filters.search?.trim() ?? "",
  type: filters.type ?? "all",
  upcoming: Boolean(filters.upcoming),
  scope: filters.scope ?? "active",
  archived: Boolean(filters.archived),
  month: filters.month ?? "all",
});

export const bulletinKeys = {
  all: ["bulletin"] as const,
  lists: () => [...bulletinKeys.all, "list"] as const,
  list: (filters: BulletinFilters) => [...bulletinKeys.lists(), normalizeBulletinFilters(filters)] as const,
  post: (id: number) => [...bulletinKeys.all, "post", id] as const,
  likers: (id: number) => [...bulletinKeys.all, "likers", id] as const,
};

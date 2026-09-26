export const siteContentKeys = {
  all: ["site-content"] as const,
  home: () => [...siteContentKeys.all, "home"] as const,
  events: () => [...siteContentKeys.all, "events"] as const,
  eventList: (includeArchived: boolean) => [...siteContentKeys.events(), includeArchived ? "all" : "active"] as const,
};

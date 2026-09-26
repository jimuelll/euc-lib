export const notificationKeys = {
  all: ["notifications"] as const,
  admin: () => [...notificationKeys.all, "admin"] as const,
  adminLists: () => [...notificationKeys.admin(), "list"] as const,
  adminList: (page: number) => [...notificationKeys.adminLists(), page] as const,
  recipientSearch: (query: string) => [...notificationKeys.admin(), "recipients", query.trim()] as const,
};

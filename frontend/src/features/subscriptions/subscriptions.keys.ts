export const subscriptionsKeys = {
  all: ["subscriptions"] as const,
  public: () => [...subscriptionsKeys.all, "public"] as const,
  admin: () => [...subscriptionsKeys.all, "admin"] as const,
  adminPage: (page: number) => [...subscriptionsKeys.admin(), Math.max(1, page)] as const,
};

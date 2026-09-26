export const aboutKeys = {
  all: ["about"] as const,
  public: () => [...aboutKeys.all, "public"] as const,
  admin: () => [...aboutKeys.all, "admin"] as const,
};

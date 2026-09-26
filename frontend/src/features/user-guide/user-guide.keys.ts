export const userGuideKeys = {
  all: ["user-guide"] as const,
  published: () => [...userGuideKeys.all, "published"] as const,
  editor: () => [...userGuideKeys.all, "editor"] as const,
};

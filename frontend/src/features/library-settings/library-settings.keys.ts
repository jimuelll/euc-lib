export const librarySettingsKeys = {
  all: ["library-settings"] as const,
  settings: (status: "active" | "archived" | "all") => [...librarySettingsKeys.all, "settings", status] as const,
  programs: (status: "active" | "archived" | "all") => [...librarySettingsKeys.all, "programs", status] as const,
  terms: () => [...librarySettingsKeys.all, "terms"] as const,
  departments: (status: "active" | "archived" | "all") => [...librarySettingsKeys.all, "departments", status] as const,
};

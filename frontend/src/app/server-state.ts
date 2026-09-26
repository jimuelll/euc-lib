import type { QueryClient } from "@tanstack/react-query";

// Transaction effects are centralized so writes refresh every screen that reads
// the affected server state, even when that screen is not mounted.
const effects = {
  reservation: ["borrowing", "my-library", "admin-reservations", "catalog", "recommendations", "admin-query"],
  circulation: ["circulation", "borrowing", "my-library", "admin-reservations", "catalog", "recommendations", "clearance", "analytics", "admin-query"],
  catalog: ["catalog", "borrowing", "recommendations", "my-library", "analytics", "admin-query"],
  content: ["site-content", "bulletin", "user-guide", "analytics"],
  user: ["admin-manage", "analytics", "my-library", "clearance", "circulation", "admin-query"],
  settings: ["library-settings", "admin-manage", "catalog", "circulation", "clearance", "analytics", "admin-query"],
  clearance: ["clearance", "my-library", "analytics", "circulation", "admin-query"],
  attendance: ["attendance", "analytics", "admin-query"],
  notifications: ["notifications", "admin-query"],
  analytics: ["analytics", "admin-query"],
} as const;

export type ServerStateEffect = keyof typeof effects;

export const invalidateServerState = (client: QueryClient, effect: ServerStateEffect) =>
  Promise.all(effects[effect].map((root) => client.invalidateQueries({ queryKey: [root] })));

export const backupKeys = {
  all: ["backup"] as const,
  snapshots: () => [...backupKeys.all, "snapshots"] as const,
  status: () => [...backupKeys.all, "status"] as const,
  compatibility: (id: number) => [...backupKeys.all, "compatibility", id] as const,
};

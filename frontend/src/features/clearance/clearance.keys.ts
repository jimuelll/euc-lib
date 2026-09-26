export const clearanceKeys = {
  all: ["clearance"] as const,
  queue: (page: number) => [...clearanceKeys.all, "queue", Math.max(1, page)] as const,
  profile: (studentId: string) => [...clearanceKeys.all, "profile", studentId.trim()] as const,
  suggestions: (query: string) => [...clearanceKeys.all, "suggestions", query.trim()] as const,
  receipt: (number: string) => [...clearanceKeys.all, "receipt", number.trim()] as const,
};

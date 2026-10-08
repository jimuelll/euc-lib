export const clearanceKeys = {
  all: ["clearance"] as const,
  queue: (page: number, search = "", filter = "all") => [...clearanceKeys.all, "queue", Math.max(1, page), search.trim(), filter] as const,
  profile: (studentId: string) => [...clearanceKeys.all, "profile", studentId.trim()] as const,
  suggestions: (query: string) => [...clearanceKeys.all, "suggestions", query.trim()] as const,
  receipt: (number: string) => [...clearanceKeys.all, "receipt", number.trim()] as const,
};

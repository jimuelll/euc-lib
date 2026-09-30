export const myLibraryKeys = {
  all: ["my-library"] as const,
  dashboard: () => [...myLibraryKeys.all, "dashboard"] as const,
  barcode: () => [...myLibraryKeys.all, "barcode"] as const,
  history: (page: number) =>
    [...myLibraryKeys.all, "history", Math.max(1, page)] as const,
  attendance: (page: number) =>
    [...myLibraryKeys.all, "attendance", Math.max(1, page)] as const,
};

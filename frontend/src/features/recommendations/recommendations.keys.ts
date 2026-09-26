export const recommendationsKeys = {
  all: ["recommendations"] as const,
  personal: () => [...recommendationsKeys.all, "personal"] as const,
  personalType: (materialType: "book" | "thesis") => [...recommendationsKeys.personal(), materialType] as const,
  related: (bookId: number, materialType: "book" | "thesis") => [...recommendationsKeys.all, "related", bookId, materialType] as const,
};

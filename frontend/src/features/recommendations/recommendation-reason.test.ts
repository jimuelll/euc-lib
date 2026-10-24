import { describe, expect, it } from "vitest";
import { specificRecommendationReason } from "./recommendation-reason";

describe("specificRecommendationReason", () => {
  it.each(["Same author: Test Author", "Also by Kentaro Miura", "Similar category: Fiction", "Same category", "Same series: Example", "Shared subject: History", "Shared subjects: History, Art", " Matching author: Test Author "])("retains %s", reason => {
    expect(specificRecommendationReason(reason)).toBe(reason.trim());
  });
  it.each([undefined, null, "", "  ", "Related catalogue title", "Similar subject and catalogue details", "Based on your recent library activity", "Similar category:", "Related thesis topic"])("omits generic or missing reason %s", reason => {
    expect(specificRecommendationReason(reason)).toBeUndefined();
  });
});

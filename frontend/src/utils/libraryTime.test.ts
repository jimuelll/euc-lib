import { describe, expect, it } from "vitest";
import { formatLibraryDate, formatLibraryDateTime, formatLibraryTime, libraryDateKey } from "./libraryTime";

describe("library time", () => {
  const instant = "2026-11-03T02:40:00.000Z";

  it("always presents operational instants in Philippine time", () => {
    expect(libraryDateKey(instant)).toBe("2026-11-03");
    expect(formatLibraryDate(instant)).toBe("Nov 3, 2026");
    expect(formatLibraryTime(instant)).toBe("10:40 AM");
    expect(formatLibraryDateTime(instant)).toBe("Nov 3, 2026, 10:40 AM");
  });
});

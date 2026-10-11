import { describe, expect, it } from "vitest";
import { getTodayHours } from "./today-hours";

const hours = [
  { day: "Monday – Friday", time: "7:00 AM – 9:00 PM", open: true },
  { day: "Saturday", time: "8:00 AM – 5:00 PM", open: true },
  { day: "Sunday", time: "Closed", open: false },
];

describe("today's published library hours", () => {
  it("uses weekday and Saturday hours from the saved schedule", () => {
    expect(getTodayHours(hours, new Date("2026-10-09T04:00:00Z"))).toBe("Open today · 7:00 AM – 9:00 PM");
    expect(getTodayHours(hours, new Date("2026-10-10T04:00:00Z"))).toBe("Open today · 8:00 AM – 5:00 PM");
  });

  it("shows the next opening on Sunday and respects edited hours", () => {
    expect(getTodayHours(hours, new Date("2026-10-11T04:00:00Z"))).toBe("Closed today · Opens Monday 7:00 AM");
    expect(getTodayHours([{ ...hours[0], time: "9:30 AM – 6:00 PM" }, ...hours.slice(1)], new Date("2026-10-11T04:00:00Z")))
      .toBe("Closed today · Opens Monday 9:30 AM");
  });

  it("switches day at midnight in the Philippines", () => {
    expect(getTodayHours(hours, new Date("2026-10-10T16:00:00Z"))).toBe("Closed today · Opens Monday 7:00 AM");
  });

  it("handles a week-wrapping day range and a fully closed schedule", () => {
    expect(getTodayHours([{ day: "Friday - Monday", time: "10:00 AM – 2:00 PM", open: true }], new Date("2026-10-11T04:00:00Z")))
      .toBe("Open today · 10:00 AM – 2:00 PM");
    expect(getTodayHours([{ day: "Daily", time: "Closed", open: false }])).toBe("Closed today");
  });

  it("does not invent hours when the API schedule is missing or unrecognized", () => {
    expect(getTodayHours(undefined)).toBe("See Hours & Location");
    expect(getTodayHours([{ day: "By appointment", time: "Call us", open: true }])).toBe("See Hours & Location");
  });
});

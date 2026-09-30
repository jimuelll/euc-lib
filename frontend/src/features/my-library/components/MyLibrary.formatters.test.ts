import { describe, expect, it } from "vitest";
import {
  deadlineLabel,
  formatDate,
  relativeTime,
  isDueSoon,
  sortBorrows,
  sortReservations,
} from "./MyLibrary.formatters";
import type { ActiveBorrow, ActiveReservation } from "../types";

const now = Date.parse("2026-10-01T08:00:00Z");
const loan = (
  id: number,
  date: string,
  status: ActiveBorrow["status"] = "borrowed",
) => ({ id, due_date: date, status }) as ActiveBorrow;
const reservation = (
  id: number,
  date: string | null,
  status: ActiveReservation["status"],
) => ({ id, expires_at: date, status }) as ActiveReservation;

describe("library urgency", () => {
  it("labels unknown dates honestly without inventing recency or pickup deadlines", () => {
    expect(relativeTime("invalid")).toBe("Date unavailable");
    expect(relativeTime(null)).toBe("Date unavailable");
    expect(formatDate(null)).toBe("Date unavailable");
    expect(
      deadlineLabel("invalid", "Pick up by", "Pickup deadline unavailable"),
    ).toBe("Pickup deadline unavailable");
  });
  it("includes the exact three-day boundary, but excludes past, overdue, missing and invalid dates", () => {
    expect(isDueSoon(loan(1, "2026-10-04T08:00:00Z"), now)).toBe(true);
    expect(isDueSoon(loan(1, "2026-10-04T08:00:00.001Z"), now)).toBe(false);
    expect(isDueSoon(loan(1, "2026-10-01T08:00:00Z"), now)).toBe(true);
    for (const item of [
      loan(1, "2026-10-01T07:59:59Z"),
      loan(1, "2026-10-02T08:00:00Z", "overdue"),
      loan(1, ""),
      loan(1, "invalid"),
    ])
      expect(isDueSoon(item, now)).toBe(false);
  });
  it("sorts overdue loans first and deadlines ascending without mutating API data", () => {
    const rows = [
      loan(1, ""),
      loan(2, "2026-10-03"),
      loan(3, "2026-09-29", "overdue"),
      loan(4, "2026-09-28", "overdue"),
      loan(5, "2026-10-02"),
    ];
    expect(sortBorrows(rows).map((row) => row.id)).toEqual([4, 3, 5, 2, 1]);
    expect(rows.map((row) => row.id)).toEqual([1, 2, 3, 4, 5]);
  });
  it("sorts ready pickups first with missing deadlines last within each status", () => {
    const rows = [
      reservation(1, "2026-10-01", "pending"),
      reservation(2, null, "ready"),
      reservation(3, "2026-10-03", "ready"),
      reservation(4, "2026-10-02", "ready"),
    ];
    expect(sortReservations(rows).map((row) => row.id)).toEqual([4, 3, 2, 1]);
  });
});

import { describe, expect, it } from "vitest";
import { normalizeReservationFilters, reservationsKeys } from "./reservations.keys";

describe("reservation query keys", () => {
  it("normalizes default, whitespace, and all-status filters", () => {
    expect(normalizeReservationFilters({ page: 0, limit: 0, search: "  ", status: "all" })).toEqual({
      page: 1,
      limit: 15,
    });
    expect(reservationsKeys.list({ page: 1, search: " book ", status: "all" })).toEqual(
      reservationsKeys.list({ page: 1, search: "book" })
    );
  });

  it("uses distinct keys for each server-side filter and page", () => {
    const base = reservationsKeys.list({ page: 1 });
    expect(reservationsKeys.list({ page: 2 })).not.toEqual(base);
    expect(reservationsKeys.list({ page: 1, search: "book" })).not.toEqual(base);
    expect(reservationsKeys.list({ page: 1, status: "ready" })).not.toEqual(base);
    expect(reservationsKeys.list({ page: 1, archived: true })).not.toEqual(base);
    expect(reservationsKeys.lists()).toEqual(["admin-reservations", "list"]);
  });
});

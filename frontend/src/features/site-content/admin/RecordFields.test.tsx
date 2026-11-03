// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RecordFields } from "./PublishingCollections";

afterEach(cleanup);

describe("event end time", () => {
  const show = (starts_at: string, ends_at: string | null) => render(<RecordFields section="events" value={{ title: "Book fair", starts_at, ends_at }} onChange={() => {}} />);
  it("warns when the end is not after the start", () => {
    show("2026-11-10T09:00", "2026-11-10T09:00");
    expect(screen.getByRole("alert").textContent).toContain("The end must be after the start");
  });
  it("stays quiet for a later end or no end", () => {
    show("2026-11-10T09:00", "2026-11-10T17:00");
    expect(screen.queryByRole("alert")).toBeNull();
    cleanup();
    show("2026-11-10T09:00", null);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

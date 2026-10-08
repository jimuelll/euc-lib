// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import CirculationOverview from "./CirculationOverview";
afterEach(cleanup);
function Location() { return <output data-testid="url">{useLocation().search}</output>; }
it("does not turn unavailable summaries into zero and links tiles to unfiltered live history", () => {
  render(<MemoryRouter initialEntries={["/admin/circulation?archived=true&search=book&dateFrom=2026-01-01"]}><CirculationOverview loading={false} /><Location /></MemoryRouter>);
  expect(screen.queryByText("0")).toBeNull();
  expect(screen.getAllByText("—")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: /Overdue loans/ }));
  expect(screen.getByTestId("url").textContent).toBe("?tab=history&filter=overdue");
});
it("shows valid daily zero values and counts overdue separately from other active loans", () => {
  render(<MemoryRouter><CirculationOverview loading={false} summary={{ total_records: 6, overdue_count: 4, borrowed_count: 2, returned_count: 0, unique_borrowers: 2, borrowed_today: 0, returned_today: 0, due_soon_count: 1, accrued_fines: 350 }} /></MemoryRouter>);
  expect(screen.getByRole("button", { name: /Today's activity\s*0\s*0 borrowed · 0 returned/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Active loans\s*2\s*1 due within 24 hours/ })).toBeTruthy();
});

it("tracks the selected history filter in the tile and clears selection in the archive", () => {
  const view = render(<MemoryRouter initialEntries={["/admin/circulation?tab=history&filter=overdue"]}><CirculationOverview loading={false} /><Location /></MemoryRouter>);
  expect(screen.getByRole("button", { name: /Overdue loans/ }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: /Active loans/ }).getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: /Active loans/ }));
  expect(screen.getByRole("button", { name: /Overdue loans/ }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: /Active loans/ }).getAttribute("aria-pressed")).toBe("true");
  view.unmount();
  render(<MemoryRouter initialEntries={["/admin/circulation?tab=history&filter=overdue&archived=true"]}><CirculationOverview loading={false} /></MemoryRouter>);
  expect(screen.getByRole("button", { name: /Overdue loans/ }).getAttribute("aria-pressed")).toBe("false");
});

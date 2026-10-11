// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LibraryDesignProvider } from "./library-design";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import { LibraryAvailability, LibrarySpineChart, LibraryTermTimeline } from "./library-patterns";
import { AdminIcon } from "@/features/admin/components/AdminIcon";
import { AdminPageTabs } from "@/features/admin/components/AdminDeskSystem";
import { SegmentedNavigation } from "@/features/admin/components/SegmentedNavigation";

afterEach(cleanup);

it("carries content design into portals while protecting navigation portals and drawings", () => {
  render(<LibraryDesignProvider>
    <AdminIcon name="borrow" data-testid="content-icon" />
    <Dialog open><DialogContent><DialogTitle>Record details</DialogTitle><DialogDescription>A loan record.</DialogDescription></DialogContent></Dialog>
    <LibraryDesignProvider enabled={false}>
      <AdminIcon name="borrow" data-testid="navigation-icon" />
      <Dialog open><DialogContent><DialogTitle>Find a tool</DialogTitle><DialogDescription>Navigation search.</DialogDescription></DialogContent></Dialog>
    </LibraryDesignProvider>
  </LibraryDesignProvider>);
  expect(screen.getByText("Record details").closest('[role="dialog"]')).toHaveAttribute("data-library-design");
  expect(screen.getByText("Find a tool").closest('[role="dialog"]')).not.toHaveAttribute("data-library-design");
  expect(screen.getByTestId("content-icon")).toHaveAttribute("stroke-linecap", "square");
  expect(screen.getByTestId("navigation-icon")).toHaveAttribute("stroke-linecap", "round");
});

it("retains accessible zero counts while omitting the visual tab badge", () => {
  render(<MemoryRouter><AdminPageTabs value="current" onChange={() => {}} label="Records" items={[
    { value: "current", label: "Current", icon: "borrow", badge: 0, descriptionId: "current-count" },
    { value: "history", label: "History", icon: "audit", badge: 3, descriptionId: "history-count" },
  ]}><p>Records</p></AdminPageTabs></MemoryRouter>);
  expect(screen.getByRole("tab", { name: "Current" })).toHaveAccessibleDescription("0 items.");
  expect(screen.getByRole("tab", { name: "Current" }).querySelector(".admin-desk-tab-badge")).toBeNull();
  expect(screen.getByRole("tab", { name: "History" }).querySelector(".admin-desk-tab-badge")).toHaveTextContent("3");
});

it("supports arrow and endpoint navigation in custom ribbon tabs", () => {
  const changes: string[] = [];
  render(<SegmentedNavigation ariaLabel="Record sections" value="current" onChange={value => changes.push(value)} segments={[
    { value: "current", label: "Current" }, { value: "history", label: "History" }, { value: "all", label: "All" },
  ]} />);
  fireEvent.keyDown(screen.getByRole("tab", { name: "Current" }), { key: "ArrowLeft" });
  expect(changes).toEqual(["all"]);
  expect(screen.getByRole("tab", { name: "All" })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("tab", { name: "All" }), { key: "Home" });
  expect(changes).toEqual(["all", "current"]);
});

it("bounds availability pips without losing real counts and never invents a trend", () => {
  const { container } = render(<><LibraryAvailability available={12} total={20} /><LibrarySpineChart label="Borrowings" values={[]} /></>);
  expect(screen.getByText("12 of 20 available")).toBeInTheDocument();
  expect(container.querySelectorAll(".library-availability-pips i")).toHaveLength(8);
  expect(screen.queryByRole("img")).toBeNull();
});

it("shows an available-copy count without inventing a holdings total", () => {
  const { container } = render(<LibraryAvailability available={12} />);
  expect(screen.getByText("12 copies available")).toBeInTheDocument();
  expect(container.textContent).not.toContain("of");
  expect(container.querySelectorAll('[data-available="true"]')).toHaveLength(8);
});

it("labels term dates and clamps today outside the term instead of extending the rail", () => {
  render(<LibraryTermTimeline start="2026-08-01" end="2026-12-31" today="2027-01-10" />);
  expect(screen.getByRole("img")).toHaveAccessibleName("Academic term: Term ended");
  expect(screen.getByText("Today · Jan 10, 2027")).toHaveAttribute("dateTime", "2027-01-10");
  expect(screen.getByText("Term ended")).toBeInTheDocument();
});

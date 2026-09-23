// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { allSidebarItems, resolveCurrentItem, visibleSidebarSections } from "../layout/AdminLayoutData";
import { useAdminUrlState } from "../hooks/useAdminUrlState";
import { useAdminFilters } from "../hooks/useAdminFilters";

afterEach(cleanup);
describe("admin navigation", () => {
  it("keeps staff desk tools available without exposing administrator-only tools", () => {
    const sections = visibleSidebarSections("staff");
    const urls = sections.flatMap(group => group.items.map(item => item.url));
    const libraryDesk = sections.find(group => group.label === "Library desk");
    expect(urls).toEqual(expect.arrayContaining(["/admin/circulation", "/admin/reservations", "/admin/clearance", "/admin/manage", "/admin/catalog"]));
    expect(libraryDesk?.items.map(item => item.url)).toContain("/admin/catalog");
    expect(sections.some(group => group.label === "Collection")).toBe(false);
    expect(urls).not.toContain("/admin/backup");
    expect(urls).not.toContain("/admin/notifications");
    expect(urls).not.toContain("/admin/catalog?tab=builder");
  });
  it("preserves the distinction between admin and super-admin tools", () => {
    const admin = visibleSidebarSections("admin").flatMap(group => group.items);
    const superAdmin = visibleSidebarSections("super_admin").flatMap(group => group.items);
    expect(admin.some(item => item.title === "Reports & Records")).toBe(true);
    expect(admin.some(item => item.title === "AI Recommendations")).toBe(false);
    expect(superAdmin.some(item => item.title === "AI Recommendations")).toBe(true);
    const settings = visibleSidebarSections("super_admin").find(group => group.label === "Settings & System");
    expect(settings?.items.map(item => item.url)).toEqual(expect.arrayContaining(["/admin/catalog?tab=builder", "/admin/catalog?tab=ai"]));
    expect(allSidebarItems.filter(item => item.url === "/admin/restrictions")).toHaveLength(0);
  });
  it("resolves catalog tabs, receipts, and the legacy restrictions entry", () => {
    expect(resolveCurrentItem("/admin/catalog", "?tab=builder&q=history")?.title).toBe("Catalog Configuration");
    expect(resolveCurrentItem("/admin/catalog", "?tab=ai")?.title).toBe("AI Recommendations");
    expect(resolveCurrentItem("/admin/catalog", "?tab=ai", "staff")?.title).toBe("Catalog");
    expect(resolveCurrentItem("/admin/clearance/receipt/TEST")?.title).toBe("Clearance & Fines");
    expect(resolveCurrentItem("/admin/restrictions")?.title).toBe("Users");
    expect(resolveCurrentItem("/admin/catalog-unrelated")).toBeUndefined();
  });
});
function LocationProbe() {
  const [params, patch] = useAdminUrlState();
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="query">{location.search}</output><output data-testid="handoff">{JSON.stringify(location.state)}</output><button onClick={() => patch({ tab: "history" })}>History</button><button onClick={() => { patch({ q: "library" }, true); patch({ page: 2 }, true); }}>Filter</button><button onClick={() => navigate(-1)}>Back</button><span>{params.get("tab")}</span></>;
}
it("preserves unrelated URL values, rapid patches, history, and reservation handoff state", () => {
  render(<MemoryRouter initialEntries={[{ pathname: "/admin/circulation", search: "?transaction=return", state: { checkoutReservation: { id: 9 } } }]}><LocationProbe /></MemoryRouter>);
  fireEvent.click(screen.getByText("History"));
  expect(screen.getByTestId("query").textContent).toContain("transaction=return&tab=history");
  expect(screen.getByTestId("handoff").textContent).toContain('"id":9');
  fireEvent.click(screen.getByText("Filter"));
  expect(screen.getByTestId("query").textContent).toContain("q=library&page=2");
  fireEvent.click(screen.getByText("Back"));
  expect(screen.getByTestId("query").textContent).toBe("?transaction=return");
});
function FilterProbe() {
  const { applied, setApplied } = useAdminFilters("report", { search: "", dateFrom: "" });
  const navigate = useNavigate();
  return <><output>{applied.search}</output><button onClick={() => setApplied({ search: "Santos", dateFrom: "2026-09-01" })}>Apply</button><button onClick={() => navigate(-1)}>Back</button></>;
}
it("restores applied report filters with Back and ignores malformed filter URLs", () => {
  render(<MemoryRouter initialEntries={["/admin/query?report=invalid"]}><FilterProbe /></MemoryRouter>);
  expect(screen.getByRole("status").textContent).toBe("");
  fireEvent.click(screen.getByText("Apply"));
  expect(screen.getByRole("status").textContent).toBe("Santos");
  fireEvent.click(screen.getByText("Back"));
  expect(screen.getByRole("status").textContent).toBe("");
});

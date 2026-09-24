// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "../layout/components/AdminSidebar";
import { dashboardItem, visibleSidebarSections } from "../layout/AdminLayoutData";

const auth = vi.hoisted(() => ({ role: "super_admin", logout: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { name: "Library Administrator", role: auth.role }, logout: auth.logout }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
function mount(role = "super_admin", route = "/admin", width = 1024) {
  auth.role = role;
  window.innerWidth = width;
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: width < 768, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  return render(<MemoryRouter initialEntries={[route]}><SidebarProvider><SidebarTrigger aria-label="Toggle navigation" /><AdminSidebar /><LocationProbe /></SidebarProvider></MemoryRouter>);
}
describe("admin sidebar", () => {
  it.each(["staff", "admin", "super_admin"])("shows exactly the permitted tools for %s without expanding groups", role => {
    mount(role);
    const nav = within(screen.getByRole("navigation", { name: "Administration" }));
    const expected = [dashboardItem, ...visibleSidebarSections(role).flatMap(section => section.items)];
    expect(nav.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(expected.map(item => item.url));
    expect(nav.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "EUC Library dashboard" }).querySelector("img")).toHaveAttribute("src", "/aa1.ico");
  });
  it.each([
    ["/admin/catalog", "Catalog"], ["/admin/catalog?tab=builder", "Catalog Configuration"],
    ["/admin/catalog?tab=ai", "AI Recommendations"], ["/admin/clearance/receipt/TEST", "Clearance & Fines"],
    ["/admin/restrictions", "Users"],
  ])("selects only the correct tool at %s", (route, title) => {
    mount("super_admin", route);
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(within(nav).getByRole("link", { name: title })).toHaveAttribute("aria-current", "page");
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });
  it("retains accessible names and all tools when compact", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Toggle navigation" }));
    expect(document.querySelector(".admin-sidebar-design")).toHaveAttribute("data-compact", "true");
    expect(screen.getByRole("link", { name: "Backup & Restore" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu for Library Administrator" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(auth.logout).toHaveBeenCalledOnce();
  });
  it("labels the mobile drawer and closes it after navigating", async () => {
    mount("staff", "/admin", 390);
    fireEvent.click(screen.getByRole("button", { name: "Toggle navigation" }));
    const dialog = screen.getByRole("dialog", { name: "Administration navigation" });
    fireEvent.click(within(dialog).getByRole("link", { name: "Borrow & Return" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("location")).toHaveTextContent("/admin/circulation");
    await waitFor(() => expect(screen.getByRole("button", { name: "Toggle navigation" })).toHaveFocus());
  });
  it.each([["My account", "/edit-profile"], ["Change password", "/change-password"]])("preserves the %s account destination", (label, url) => {
    mount();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Account menu for Library Administrator" }), { button: 0 });
    fireEvent.click(screen.getByRole("menuitem", { name: label }));
    expect(screen.getByTestId("location")).toHaveTextContent(url);
  });
  it("signs out from the account menu", () => {
    mount();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Account menu for Library Administrator" }), { button: 0 });
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(auth.logout).toHaveBeenCalledOnce();
  });
});

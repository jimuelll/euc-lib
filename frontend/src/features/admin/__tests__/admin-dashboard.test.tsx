// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "../pages/AdminHome";
import { fetchAdminDashboard, type DashboardResponse } from "../api";

vi.mock("@/features/moderation/api",()=>({fetchModerationStats:vi.fn(async()=>({pending:0,urgent:0,oldest:null}))}));
const auth = vi.hoisted(() => ({ role: "super_admin" }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { role: auth.role } }) }));
vi.mock("../api", () => ({ fetchAdminDashboard: vi.fn() }));

const fixture: DashboardResponse = {
  stats: { total_books: 1250, available_book_copies: 2440, borrowed_book_copies: 360, active_users: 820,
    overdue_borrowings: 4, borrowings_today: 28, returns_today: 19, ready_reservations: 3,
    reservations_today: 7, attendance_today: 86, damaged_book_copies: 3, lost_book_copies: 1,
    active_notifications: 2, active_subscriptions: 8, upcoming_holidays: 1, outstanding_fines: 1434 },
  recentActivity: [{ occurred_at: "2026-09-23T09:30:00", activity_type: "returned", description: "Alex returned Philippine History" }],
};
const clients: QueryClient[] = [];
beforeEach(() => { auth.role = "super_admin"; vi.mocked(fetchAdminDashboard).mockResolvedValue(fixture); });
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; vi.resetAllMocks(); });

function mount(data?: DashboardResponse) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });
  clients.push(client);
  if (data) client.setQueryData(["analytics", "desk"], data);
  render(<MemoryRouter><QueryClientProvider client={client}><Dashboard /></QueryClientProvider></MemoryRouter>);
}

describe("compact admin dashboard", () => {
  it("preserves workflow links and separates daily totals from older transactions", async () => {
    mount();
    expect(screen.getByRole("link", { name: "Borrow a copy" })).toHaveAttribute("href", "/admin/circulation?tab=transaction&mode=borrow");
    expect(screen.getByRole("link", { name: "Return a copy" })).toHaveAttribute("href", "/admin/circulation?tab=transaction&mode=return");
    expect(screen.getByRole("link", { name: "Reservations" })).toHaveAttribute("href", "/admin/reservations");
    await screen.findByRole("heading", { name: "Today’s totals" });
    const transactions = screen.getByRole("region", { name: "Recent transactions" });
    expect(within(transactions).getByText(/Alex returned/)).toBeInTheDocument();
    expect(within(transactions).getByText(/Sep 23/)).toBeInTheDocument();
    const outstanding = within(screen.getByRole("region", { name: "Outstanding items" }));
    expect(outstanding.getByRole("link", { name: "Overdue loans 4" })).toHaveAttribute("href", "/admin/circulation?tab=history&filter=overdue");
    expect(outstanding.getByRole("link", { name: "Unpaid fines ₱1,434.00" })).toHaveAttribute("href", "/admin/clearance?tab=queue&filter=all");
    expect(outstanding.getByRole("link", { name: "Ready reservations 3" })).toHaveAttribute("href", "/admin/reservations?filter=ready");
    expect(outstanding.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByText("₱1,434.00")).toBeInTheDocument();
    expect(document.querySelector(".admin-dashboard-overview")).not.toHaveAttribute("open");
  });

  it.each(["staff", "admin", "super_admin"])("respects report permissions for %s", async role => {
    auth.role = role;
    mount();
    const links = within(await screen.findByRole("navigation", { name: "Quick links" }));
    expect(links.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/admin/manage");
    expect(links.getByRole("link", { name: "Needs holdings" })).toHaveAttribute("href", "/admin/catalog?filter=needs-holdings");
    expect(Boolean(links.queryByRole("link", { name: "Reports" }))).toBe(role !== "staff");
  });

  it("shows valid zero values neutrally and an accurate empty feed", async () => {
    const stats = { ...fixture.stats };
    for (const key of Object.keys(stats) as Array<keyof typeof stats>) stats[key] = 0;
    vi.mocked(fetchAdminDashboard).mockResolvedValue({ stats, recentActivity: [] });
    mount();
    await screen.findByText("No recent transactions");
    expect(screen.getByText("₱0.00")).toBeInTheDocument();
    expect(document.querySelectorAll('.admin-dashboard-outstanding .admin-desk-tile[data-tone="neutral"]')).toHaveLength(3);
    expect(document.querySelectorAll('.admin-compact-metric[data-tone="neutral"]')).toHaveLength(4);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a retry on initial failure without fabricated totals", async () => {
    vi.mocked(fetchAdminDashboard).mockRejectedValue(new Error("Unavailable"));
    mount();
    await screen.findByRole("heading", { name: "Dashboard data unavailable" });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load the dashboard");
    expect(screen.queryByRole("heading", { name: "Overdue loans" })).not.toBeInTheDocument();
    expect(screen.queryByText("₱0.00")).not.toBeInTheDocument();
    vi.mocked(fetchAdminDashboard).mockResolvedValue(fixture);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Overdue loans" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("retains cached figures when refresh fails", async () => {
    mount(fixture);
    vi.mocked(fetchAdminDashboard).mockRejectedValue(new Error("Refresh unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent("Showing the last available data");
    expect(screen.getByText("₱1,434.00")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today’s totals" })).toBeInTheDocument();
  });

  it("matches loading layout and prevents duplicate refreshes", async () => {
    let resolve: (value: DashboardResponse) => void = () => {};
    vi.mocked(fetchAdminDashboard).mockImplementation(() => new Promise(result => { resolve = result; }));
    mount();
    expect(screen.getByLabelText("Loading dashboard")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Borrow a copy" })).toBeInTheDocument();
    resolve(fixture);
    await screen.findByRole("heading", { name: "Overdue loans" });
    vi.mocked(fetchAdminDashboard).mockImplementation(() => new Promise(result => { resolve = result; }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled());
    expect(screen.getByText("₱1,434.00")).toBeInTheDocument();
    resolve(fixture);
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled());
  });
});

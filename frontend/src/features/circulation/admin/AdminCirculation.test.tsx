// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTestQueryClient } from "@/test-utils/query-client";
import AdminCirculation from "./AdminCirculation";
import * as api from "./circulation.api";
vi.mock("./circulation.api", () => ({ getCirculationLog: vi.fn(), lookupUser: vi.fn(), lookupCopy: vi.fn(), lookupReturnPreview: vi.fn(), processBorrow: vi.fn(), processReturn: vi.fn(), undoDeskTransaction: vi.fn(), searchCirculationBooks: vi.fn(), fetchCirculationBookCopies: vi.fn(), archiveBorrowing: vi.fn(), restoreBorrowing: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { role: "staff" } }) }));
const summary = { total_records: 6, borrowed_count: 2, overdue_count: 4, returned_count: 0, unique_borrowers: 2, borrowed_today: 0, returned_today: 0, due_soon_count: 1, accrued_fines: 350 };
function Location() { return <output data-testid="route">{useLocation().search}</output>; }
function setup(route = "/admin/circulation?tab=transaction&mode=borrow") { return render(<QueryClientProvider client={createTestQueryClient()}><MemoryRouter initialEntries={[route]}><AdminCirculation /><Location /></MemoryRouter></QueryClientProvider>); }
beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.getCirculationLog).mockResolvedValue({ rows: [], total: 0, page: 1, totalPages: 0, summary }); });
afterEach(cleanup);
it("keeps tools and totals in History while Desk retains scanner controls and a meaningful disabled reason", async () => {
  setup();
  expect(screen.getByRole("heading", { name: "Borrow & Return", level: 1 })).toBeTruthy();
  expect(screen.getByText("Record loans and returns, or review circulation history.")).toBeTruthy();
  await waitFor(() => expect(screen.getByRole("tab", { name: "Transaction history" }).getAttribute("aria-describedby")).toBe("circulation-history-overdue"));
  expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
  expect(screen.queryByRole("button", { name: "View archive" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Export" })).toBeNull();
  expect(screen.queryByLabelText("Circulation overview")).toBeNull();
  expect(screen.getByText("Select a patron and copy to continue.")).toBeTruthy();
  const copy = screen.getByRole("region", { name: "Desk transaction" });
  expect(within(copy).getByRole("button", { name: "Search catalog" })).toBeTruthy();
  expect(within(copy).queryByRole("button", { name: "Scan copy QR code" })).toBeNull();
  expect(within(copy).queryByRole("button", { name: "Look up accession number or copy QR code" })).toBeNull();
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Transaction history" }), { button: 0, ctrlKey: false });
  expect(screen.getByRole("tabpanel", { name: "Transaction history" })).toBeTruthy();
  expect(screen.getAllByRole("heading", { name: "Borrow & Return", level: 1 })).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "View archive" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
  expect(screen.getByTestId("route").textContent).toBe("?tab=history&mode=borrow");
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Desk transaction" }), { button: 0, ctrlKey: false });
  expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
});
it("opens Copy first through a Return deep link and keeps the mode when switching page tabs", async () => {
  setup("/admin/circulation?tab=transaction&mode=return");
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Accession number or copy QR code" }));
  expect(screen.queryByRole("textbox", { name: "Student / employee ID or name" })).toBeNull();
  expect(screen.getByRole("button", { name: /^Return$/ }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Transaction history" }), { button: 0, ctrlKey: false });
  expect(screen.getByTestId("route").textContent).toBe("?tab=history&mode=return");
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Desk transaction" }), { button: 0, ctrlKey: false });
  expect(screen.getByRole("textbox", { name: "Accession number or copy QR code" })).toBeTruthy();
});

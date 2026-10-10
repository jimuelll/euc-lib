// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { createTestQueryClient } from "@/test-utils/query-client";
import CirculationLog from "./CirculationLog";
import * as api from "../circulation.api";

vi.mock("../circulation.api", () => ({ getCirculationLog: vi.fn(), archiveBorrowing: vi.fn(), restoreBorrowing: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { role: "staff" } }) }));
configure({ asyncUtilTimeout: 5000 });
const row: api.CirculationLogEntry = { id: 1, user_name: "Mika Santos", student_employee_id: "DEMO-REAL-004", book_title: "Library book", book_author: "Author", isbn: "9780123456789", copy_barcode: "COPY-1", borrowed_at: "2026-09-14T09:15:00", due_date: "2026-09-21T09:15:00", returned_at: null, fine_amount: 24, hours_overdue: 576, status: "overdue", issued_by_name: "Librarian", deleted_at: null };
const summary = { total_records: 10, borrowed_count: 2, overdue_count: 4, returned_count: 4, unique_borrowers: 6 };
function Location() { const location = useLocation(); return <output data-testid="route">{location.pathname}{location.search}</output>; }
const setup = (url="/admin/circulation?tab=history") => render(<QueryClientProvider client={createTestQueryClient()}><MemoryRouter initialEntries={[url]}><CirculationLog /><Location /></MemoryRouter></QueryClientProvider>);
beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.getCirculationLog).mockResolvedValue({ rows: [row], total: 10, page: 1, totalPages: 1, summary }); });
afterEach(cleanup);

describe("circulation history", () => {
  it("preserves previous-policy filters for rows and counts and lets staff clear them",async()=>{
    setup('/admin/circulation?tab=history&filter=needs_action&policyId=7&previousTerms=true');
    await screen.findByRole('button',{name:'Clear policy filter'});
    await waitFor(()=>expect(api.getCirculationLog).toHaveBeenCalledWith(expect.objectContaining({policyId:7,previousTerms:true}),expect.any(AbortSignal)));
    fireEvent.click(screen.getByRole('button',{name:'Clear policy filter'}));
    await waitFor(()=>expect(screen.getByTestId('route').textContent).not.toContain('policyId'));
  });
  it("defaults to live work, groups overdue first and exposes Return", async () => {
    setup();
    await screen.findByRole("button", { name: "All 10" });
    expect(screen.getByRole("button", { name: "Needs action 6" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(screen.getByRole("group", { name: "Loan status" })).getAllByRole("button").at(-1)?.textContent).toBe("All10");
    expect(screen.getByRole("button", { name: /^Return$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View fine" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Overdue 4" }));
    await waitFor(() => expect(api.getCirculationLog).toHaveBeenCalledWith(expect.objectContaining({ status: "overdue" }), expect.any(AbortSignal)));
    expect(screen.getByRole("button", { name: "Active 2" })).toBeTruthy();
    expect(screen.getByText("24 days overdue", { exact: false })).toBeTruthy();
    expect(screen.getByText("DEMO-REAL-004")).toBeTruthy();
  });
  it("opens details without placing empty issuer and returned columns in the table", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Mika Santos" }));
    const detail = screen.getByRole("dialog");
    expect(within(detail).getByText("Issued by")).toBeTruthy();
    expect(within(detail).getByText("Librarian")).toBeTruthy();
    expect(within(detail).getByText("Still on loan")).toBeTruthy();
    fireEvent.click(within(detail).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mika Santos" })));
    fireEvent.click(screen.getByRole("button", { name: "Mika Santos" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Return copy" }));
    expect(screen.getByTestId("route").textContent).toBe("/admin/circulation?tab=transaction&mode=return&copy=COPY-1");
  });
  it("filters by dates and reports an unavailable history instead of an empty result", async () => {
    vi.mocked(api.getCirculationLog).mockRejectedValue(new Error("Offline"));
    setup();
    await screen.findByText("Could not load circulation history.");
    expect(screen.queryByText("No transactions match these filters.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Borrowed date" }));
    fireEvent.click(screen.getByRole("button", { name: /^Today$/ }));
    await waitFor(() => expect(api.getCirculationLog).toHaveBeenCalledWith(expect.objectContaining({ dateFrom: expect.any(String), dateTo: expect.any(String) }), expect.any(AbortSignal)));
  });
  it("shows valid zero counts for an empty result", async () => {
    vi.mocked(api.getCirculationLog).mockResolvedValue({ rows: [], total: 0, page: 1, totalPages: 0, summary: { ...summary, total_records: 0, borrowed_count: 0, overdue_count: 0, returned_count: 0 } });
    setup();
    await screen.findByRole("button", { name: "All 0" });
    expect(screen.getByText("No loans need action.")).toBeTruthy();
  });
  it("shows the returned date and opens details when a row is clicked", async () => {
    vi.mocked(api.getCirculationLog).mockResolvedValue({ rows: [{ ...row, status: "returned", returned_at: "2026-09-25T09:15:00" }], total: 1, page: 1, totalPages: 1, summary });
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Returned 4" }));
    const returnedDate = await screen.findByText("Returned Sep 25, 2026");
    fireEvent.click(returnedDate.closest("li")!);
    expect(within(screen.getByRole("dialog")).getByText(/Sep 25, 2026/)).toBeTruthy();
    expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Return copy" })).toBeNull();
  });
});

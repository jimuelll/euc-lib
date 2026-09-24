// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useCirculation } from "./useCirculation";
import * as api from "../circulation.api";
vi.mock("../circulation.api", () => ({ lookupUser: vi.fn(), lookupCopy: vi.fn(), processBorrow: vi.fn(), processReturn: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
const patron = { id: 1, name: "Test Patron", student_employee_id: "TEST-1", barcode: "TEST-1", role: "student" };
const copy = { id: 2, book_id: 3, barcode: "COPY-2", accession_number: "ACC-2", borrow_eligible: 1, title: "Test book", author: "Test author", copies: 1, condition: "good", is_active: true };
const loan = { id: 4, book_id: 3, copy_id: 2, copy_barcode: "COPY-2", accession_number: null, title: "Test book", author: "Test author", borrowed_at: "2026-09-01", due_date: "2026-09-30", status: "borrowed" as const };
const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={["/admin/circulation?transaction=return"]}>{children}</MemoryRouter>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.lookupUser).mockResolvedValue({ user: patron, activeBorrows: [loan], clearance: { status: "eligible", reasons: [], overdueItems: [], outstandingAmount: 0 } });
  vi.mocked(api.lookupCopy).mockResolvedValue(copy);
  vi.mocked(api.processBorrow).mockResolvedValue({} as never);
  vi.mocked(api.processReturn).mockResolvedValue({} as never);
});
afterEach(cleanup);
describe("desk transaction handoffs", () => {
  it("opens Return from its URL and retains lookup data after a failed transaction", async () => {
    const { result } = renderHook(() => useCirculation(), { wrapper });
    expect(result.current.type).toBe("return");
    await act(async () => { await result.current.handleLookupUser("TEST-1"); });
    await act(async () => { await result.current.handleLookupCopy("COPY-2"); });
    expect(result.current.canSubmit).toBe(true);
    vi.mocked(api.processReturn).mockRejectedValueOnce(new Error("Offline"));
    await act(async () => { await result.current.handleSubmit({ preventDefault() {} } as React.FormEvent); });
    expect(result.current.foundUser?.name).toBe("Test Patron");
    expect(result.current.copyBarcode).toBe("COPY-2");
    expect(result.current.completed).toBe("");
  });
  it("shows completion and resets the successful return for the next patron", async () => {
    const done = vi.fn();
    const { result } = renderHook(() => useCirculation(null, done), { wrapper });
    await act(async () => { await result.current.handleLookupUser("TEST-1"); });
    await act(async () => { await result.current.handleLookupCopy("COPY-2"); });
    await act(async () => { await result.current.handleSubmit({ preventDefault() {} } as React.FormEvent); });
    expect(api.processReturn).toHaveBeenCalledWith("COPY-2");
    expect(result.current.completed).toContain("Return completed");
    expect(result.current.foundUser).toBeNull();
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("allows a legacy return by the exact QR copy even without an accession number", async () => {
    vi.mocked(api.lookupCopy).mockResolvedValue({ ...copy, accession_number: null });
    const { result } = renderHook(() => useCirculation(), { wrapper });
    await act(async () => { await result.current.handleLookupUser("TEST-1"); });
    await act(async () => { await result.current.handleLookupCopy("COPY-2"); });
    expect(result.current.canSubmit).toBe(true);
    await act(async () => { await result.current.handleSubmit({ preventDefault() {} } as React.FormEvent); });
    expect(api.processReturn).toHaveBeenCalledWith("COPY-2");
  });
  it("blocks checkout when a valid QR scan resolves to an unaccessioned copy", async () => {
    vi.mocked(api.lookupCopy).mockResolvedValue({ ...copy, accession_number: null });
    const { result } = renderHook(() => useCirculation(null), { wrapper });
    await act(async () => { await result.current.handleLookupUser("TEST-1"); });
    // Borrow is selected from the URL after switching transaction mode.
    act(() => result.current.handleTypeChange("borrow"));
    await act(async () => { await result.current.handleLookupCopy("COPY-2"); });
    expect(result.current.canSubmit).toBe(false);
    await act(async () => { await result.current.handleSubmit({ preventDefault() {} } as React.FormEvent); });
    expect(api.processBorrow).not.toHaveBeenCalled();
  });
  it("keeps reservation checkout in Borrow and fulfills only through a successful borrow", async () => {
    const reservation = { id: 8, book_id: 3, book_title: "Test book", student_employee_id: "TEST-1", user_name: "Test Patron" };
    const { result } = renderHook(() => ({ desk: useCirculation(reservation), location: useLocation() }), { wrapper });
    await waitFor(() => expect(result.current.desk.foundUser?.id).toBe(1));
    expect(result.current.desk.type).toBe("borrow");
    await act(async () => { await result.current.desk.handleLookupCopy("COPY-2"); });
    await act(async () => { await result.current.desk.handleSubmit({ preventDefault() {} } as React.FormEvent); });
    expect(api.processBorrow).toHaveBeenCalledWith("TEST-1", "COPY-2", 8);
    expect(result.current.location.pathname).toBe("/admin/reservations");
    expect(api.processReturn).not.toHaveBeenCalled();
  });
});

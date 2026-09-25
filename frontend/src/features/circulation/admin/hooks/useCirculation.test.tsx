// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useCirculation } from "./useCirculation";
import * as api from "../circulation.api";

vi.mock("../circulation.api", () => ({
  lookupUser: vi.fn(),
  lookupCopy: vi.fn(),
  lookupReturnPreview: vi.fn(),
  processBorrow: vi.fn(),
  processReturn: vi.fn(),
}));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const patron = { id: 1, name: "Test Patron", student_employee_id: "TEST-1", barcode: "TEST-1", role: "student" };
const copy = { id: 2, book_id: 3, barcode: "COPY-2", accession_number: "ACC-2", borrow_eligible: 1, title: "Test book", author: "Test author", copies: 1, condition: "good", is_active: true };
const preview = {
  borrowing_id: 4,
  borrowed_at: "2026-09-01T09:00:00.000Z",
  due_date: "2026-09-30T09:00:00.000Z",
  status: "borrowed" as const,
  user_id: 1,
  user_name: "Test Patron",
  student_employee_id: "TEST-1",
  role: "student",
  copy_id: 2,
  book_id: 3,
  copy_barcode: "COPY-2",
  copy_condition: "good",
  copy_is_active: true,
  accession_number: "ACC-2",
  title: "Test book",
  author: "Test author",
};
const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={["/admin/circulation?transaction=return"]}>{children}</MemoryRouter>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
  vi.mocked(api.lookupUser).mockResolvedValue({ user: patron, activeBorrows: [], clearance: { status: "eligible", reasons: [], overdueItems: [], outstandingAmount: 0 } });
  vi.mocked(api.lookupCopy).mockResolvedValue(copy);
  vi.mocked(api.lookupReturnPreview).mockResolvedValue(preview);
  vi.mocked(api.processBorrow).mockResolvedValue({} as never);
  vi.mocked(api.processReturn).mockResolvedValue({ message: "ok", borrowingId: 4, returnedAt: "2026-09-25T10:15:00.000Z" });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("desk transaction handoffs", () => {
  it("looks up the active borrower automatically after accession entry", async () => {
    const { result } = renderHook(() => useCirculation(), { wrapper });
    expect(result.current.type).toBe("return");
    act(() => result.current.handleReturnIdentifierChange("ACC-2"));
    await waitFor(() => expect(api.lookupReturnPreview).toHaveBeenCalledWith("ACC-2"));
    await waitFor(() => expect(result.current.returnPreview?.user_name).toBe("Test Patron"));
    expect(api.lookupReturnPreview).toHaveBeenCalledWith("ACC-2");
    expect(result.current.returnPreview?.user_name).toBe("Test Patron");
    expect(result.current.returnPreview?.title).toBe("Test book");
    expect(result.current.canSubmit).toBe(true);
  });

  it("ignores a slower lookup after the identifier changes", async () => {
    let resolveFirst!: (value: typeof preview) => void;
    vi.mocked(api.lookupReturnPreview)
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ...preview, accession_number: "ACC-3", title: "Newer book" });
    const { result } = renderHook(() => useCirculation(), { wrapper });

    act(() => result.current.handleReturnIdentifierChange("ACC-2"));
    await waitFor(() => expect(api.lookupReturnPreview).toHaveBeenCalledTimes(1));
    act(() => result.current.handleReturnIdentifierChange("ACC-3"));
    await waitFor(() => expect(api.lookupReturnPreview).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.returnPreview?.title).toBe("Newer book"));
    await act(async () => { resolveFirst(preview); });
    expect(result.current.returnPreview?.accession_number).toBe("ACC-3");
  });

  it("shows lookup failures inline and allows another lookup", async () => {
    vi.mocked(api.lookupReturnPreview).mockRejectedValueOnce({ response: { data: { message: "No active loan found" } } });
    const { result } = renderHook(() => useCirculation(), { wrapper });
    act(() => result.current.handleReturnIdentifierChange("UNKNOWN"));
    await act(async () => { await result.current.handleLookupReturn("UNKNOWN", true); });
    expect(result.current.returnLookupError).toBe("No active loan found");
    expect(result.current.canSubmit).toBe(false);
    await act(async () => { await result.current.handleLookupReturn("UNKNOWN", true); });
    expect(result.current.returnPreview?.user_name).toBe("Test Patron");
  });

  it("retains the loan preview when return submission fails", async () => {
    const { result } = renderHook(() => useCirculation(), { wrapper });
    act(() => result.current.handleReturnIdentifierChange("ACC-2"));
    await act(async () => { await result.current.handleLookupReturn("ACC-2", true); });
    vi.mocked(api.processReturn).mockRejectedValueOnce({ response: { status: 500, data: { message: "Network unavailable" } } });
    await act(async () => { await result.current.handleSubmit({ preventDefault() {} } as React.FormEvent); });
    expect(result.current.returnPreview?.user_name).toBe("Test Patron");
    expect(result.current.copyBarcode).toBe("ACC-2");
    expect(result.current.returnReceipt).toBeNull();
  });

  it("clears a stale preview when another staff member returned the loan", async () => {
    const { result } = renderHook(() => useCirculation(), { wrapper });
    act(() => result.current.handleReturnIdentifierChange("ACC-2"));
    await act(async () => { await result.current.handleLookupReturn("ACC-2", true); });
    vi.mocked(api.processReturn).mockRejectedValueOnce({ response: { status: 409, data: { message: "Book already returned" } } });
    await act(async () => { await result.current.handleSubmit({ preventDefault() {} } as React.FormEvent); });
    expect(result.current.returnPreview).toBeNull();
    expect(result.current.returnLookupError).toBe("Book already returned");
    expect(result.current.canSubmit).toBe(false);
  });

  it("records the server return time in a receipt", async () => {
    const done = vi.fn();
    const { result } = renderHook(() => useCirculation(null, done), { wrapper });
    act(() => result.current.handleReturnIdentifierChange("ACC-2"));
    await act(async () => { await result.current.handleLookupReturn("ACC-2", true); });
    await act(async () => { await result.current.handleSubmit({ preventDefault() {} } as React.FormEvent); });
    expect(api.processReturn).toHaveBeenCalledWith("ACC-2");
    expect(result.current.returnReceipt?.returned_at).toBe("2026-09-25T10:15:00.000Z");
    expect(result.current.returnReceipt?.user_name).toBe("Test Patron");
    expect(result.current.returnPreview).toBeNull();
    expect(result.current.completed).toContain("Return completed");
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("keeps legacy copy QR returns available without an accession number", async () => {
    vi.mocked(api.lookupReturnPreview).mockResolvedValue({ ...preview, accession_number: null });
    const { result } = renderHook(() => useCirculation(), { wrapper });
    act(() => result.current.handleReturnIdentifierChange("COPY-2"));
    await act(async () => { await result.current.handleLookupReturn("COPY-2", true); });
    expect(result.current.canSubmit).toBe(true);
    await act(async () => { await result.current.handleSubmit({ preventDefault() {} } as React.FormEvent); });
    expect(api.lookupReturnPreview).toHaveBeenCalledWith("COPY-2");
    expect(api.processReturn).toHaveBeenCalledWith("COPY-2");
  });

  it("blocks checkout when a copy has no accession number", async () => {
    vi.mocked(api.lookupCopy).mockResolvedValue({ ...copy, accession_number: null });
    const { result } = renderHook(() => useCirculation(null), { wrapper });
    await act(async () => { await result.current.handleLookupUser("TEST-1"); });
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

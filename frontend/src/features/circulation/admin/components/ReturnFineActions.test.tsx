// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createTestQueryClient } from "@/test-utils/query-client";
import ReturnFineActions from "./ReturnFineActions";
import * as api from "@/features/clearance";
import type { ReturnPreview } from "../circulation.types";

const auth = vi.hoisted(() => ({ role: "admin" }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { role: auth.role } }) }));
vi.mock("@/features/clearance", async () => ({ ...(await vi.importActual("@/features/clearance")), fetchClearanceProfile: vi.fn(), recordClearancePayment: vi.fn(), adjustClearanceFine: vi.fn() }));
const loan = { borrowing_id: 7, student_employee_id: "TEST-1", title: "Test book", user_name: "Test patron" } as ReturnPreview;
const profile: api.ClearanceProfile = { user: { name: "Test patron", student_employee_id: "TEST-1" }, status: "blocked", reasons: ["Unpaid fine"], overdueItems: [], fineRows: [{ id: 7, book_title: "Test book", status: "overdue", fine_amount: 100, settled_amount: 0, unsettled_amount: 100 }], outstandingAmount: 250, reservations: [], transactions: [] };
const setup = () => render(<QueryClientProvider client={createTestQueryClient()}><MemoryRouter><ReturnFineActions loan={loan} disabled={false} /></MemoryRouter></QueryClientProvider>);
beforeEach(() => { vi.resetAllMocks(); auth.role = "admin"; vi.mocked(api.fetchClearanceProfile).mockResolvedValue(profile); });
afterEach(cleanup);

describe("return fine actions", () => {
  it("allows staff collection but restricts waivers to administrators", async () => {
    auth.role = "staff";
    setup();
    await screen.findByRole("button", { name: "Collect all fines · ₱250.00" });
    expect(screen.queryByRole("button", { name: "Waive this fine" })).toBeNull();
  });
  it("requires confirmation and clearly collects the full patron balance", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Collect all fines · ₱250.00" }));
    expect(screen.getByText(/This settles all outstanding fines/)).toBeTruthy();
    expect(api.recordClearancePayment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Record cash payment" }));
    await waitFor(() => expect(api.recordClearancePayment).toHaveBeenCalledWith("TEST-1", 250, 250));
  });
  it("requires a waiver reason and targets the selected loan only", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Waive this fine" }));
    expect((screen.getByRole("button", { name: "Confirm waiver" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Approved by librarian" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm waiver" }));
    await waitFor(() => expect(api.adjustClearanceFine).toHaveBeenCalledWith(7, 100, "Approved by librarian"));
  });
  it("does not show a zero fine when the profile request fails", async () => {
    vi.mocked(api.fetchClearanceProfile).mockRejectedValue(new Error("Offline"));
    setup();
    await screen.findByText(/Fine unavailable/);
    expect(screen.queryByText("₱0.00")).toBeNull();
    expect(screen.queryByRole("button", { name: /Collect all fines/ })).toBeNull();
  });
});

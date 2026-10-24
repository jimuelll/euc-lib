// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { createTestQueryClientWrapper } from "@/test-utils/query-client";
import type { ComponentProps } from "react";
import type { CatalogBook } from "../types";
import ReserveTab from "./ReserveTab";

const api = vi.hoisted(() => ({ reserveBook: vi.fn(), cancelReservation: vi.fn() }));
vi.mock("../api", () => api);
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const baseBook: CatalogBook = { id: 1, title: "Naruto", author: "Masashi Kishimoto", copies: 1, registered_copies: 1, available: 1, material_type: "book", canReserve: true };
function mount(book: Partial<CatalogBook> = {}) {
  const onReserveSuccess = vi.fn();
  const props: ComponentProps<typeof ReserveTab> = {
    catalog: [{ ...baseBook, ...book }], activeReservations: [], catalogLoading: false, dataLoading: false, hasSearched: false,
    catalogError: null, activeError: null, onRetryCatalog: vi.fn(), onRetryActive: vi.fn(), searchField: null,
    pagination: { page: 1, totalPages: 1, total: 1 }, onPageChange: vi.fn(), onReserveSuccess, onCancelSuccess: vi.fn(),
  };
  const view = render(<MemoryRouter><ReserveTab {...props} /></MemoryRouter>, { wrapper: createTestQueryClientWrapper() });
  return { onReserveSuccess, update: (next: Partial<typeof props>) => view.rerender(<MemoryRouter><ReserveTab {...props} {...next} /></MemoryRouter>) };
}

describe("reservation actions", () => {
  it("offers Reserve for an available copy", () => {
    mount();
    expect(screen.getByRole("button", { name: "Reserve" })).toBeEnabled();
    expect(screen.queryByText(/Wait for a copy/)).not.toBeInTheDocument();
  });

  it("explains the wait and submits a pending reservation when no copy is available", async () => {
    const deadline = "2026-10-25T08:00:00Z";
    api.reserveBook.mockResolvedValue({ reservationId: 5, expiresAt: deadline });
    const { onReserveSuccess: onSuccess } = mount({ available: 0 });
    const button = screen.getByRole("button", { name: "Reserve when returned" });
    expect(button).toBeEnabled();
    expect(button).toHaveAccessibleDescription(/Waiting reservations expire after 24 hours/);
    fireEvent.click(button);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/No copy is available now/)).toBeInTheDocument();
    expect(api.reserveBook).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm reservation" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 5, status: "pending", expires_at: deadline }), 1));
    expect(api.reserveBook).toHaveBeenCalledWith(1);
    expect(screen.getByRole("status")).toHaveTextContent("Reservation submitted. Wait for a Ready notification before visiting the library.");
  });

  it("disables a full queue even when a physical copy is available", () => {
    mount({ canReserve: false, reservations_full: 1 });
    const button = screen.getByRole("button", { name: "Reservations full" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(api.reserveBook).not.toHaveBeenCalled();
  });

  it.each([
    { material_type: "thesis" as const },
    { registered_copies: 0, available: 0 },
    { canReserve: false, reservations_full: 0 },
  ])("disables ineligible books: %j", book => {
    mount(book);
    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();
    expect(screen.queryByText(/Wait for a copy/)).not.toBeInTheDocument();
  });
});


describe("reservation confirmation", () => {
  it.each(["Go back", "Escape"])("explains the process and restores focus without submitting after %s", async dismissal => {
    mount();
    const trigger = screen.getByRole("button", { name: "Reserve" });
    trigger.focus(); fireEvent.click(trigger);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("heading", { name: "Confirm reservation" })).toBeInTheDocument();
    expect(within(dialog).getByText("Naruto")).toBeInTheDocument();
    expect(within(dialog).getByText("Masashi Kishimoto")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Wait until the library marks it Ready before heading to the library.");
    expect(dialog).toHaveTextContent("You’ll receive a library notification when it’s ready.");
    expect(dialog).toHaveTextContent("Pending reservations expire after 24 hours unless marked ready.");
    const cancel = within(dialog).getByRole("button", { name: "Go back" });
    await waitFor(() => expect(cancel).toHaveFocus());
    if (dismissal === "Escape") fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    else fireEvent.click(cancel);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(api.reserveBook).not.toHaveBeenCalled();
  });
  it("submits once, prevents dismissal while pending, and focuses the success message", async () => {
    let resolve!: (result: { reservationId: number; expiresAt: string }) => void;
    api.reserveBook.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { onReserveSuccess } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Reserve" }));
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Confirm reservation" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(api.reserveBook).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByRole("button", { name: "Reserving…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Go back" })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    expect(dialog).toBeInTheDocument();
    await act(async () => resolve({ reservationId: 5, expiresAt: "2026-10-25T08:00:00Z" }));
    await waitFor(() => expect(onReserveSuccess).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
  it("keeps errors inside the dialog and permits an explicit retry", async () => {
    api.reserveBook.mockRejectedValueOnce(new Error("Reservation limit reached")).mockResolvedValueOnce({ reservationId: 5, expiresAt: null });
    mount(); fireEvent.click(screen.getByRole("button", { name: "Reserve" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm reservation" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Reservation limit reached");
    expect(within(dialog).getByText("Naruto")).toBeInTheDocument();
    expect(api.reserveBook).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm reservation" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(api.reserveBook).toHaveBeenCalledTimes(2);
  });
  it("blocks confirmation if eligibility changes while the dialog is open", async () => {
    const { update } = mount(); fireEvent.click(screen.getByRole("button", { name: "Reserve" }));
    await screen.findByRole("alertdialog");
    update({ catalog: [{ ...baseBook, canReserve: false }] });
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Confirm reservation" })).toBeDisabled();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("cannot be reserved right now");
    expect(api.reserveBook).not.toHaveBeenCalled();
  });
});

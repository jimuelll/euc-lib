// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { createTestQueryClientWrapper } from "@/test-utils/query-client";
import type { ActiveReservation } from "./types";

const api = vi.hoisted(() => ({ fetchActiveReservations: vi.fn(), fetchReservationHistory: vi.fn(), searchReservationCatalogue: vi.fn(), reserveBook: vi.fn(), cancelReservation: vi.fn(), RESERVATION_CATALOGUE_PAGE_SIZE: 6 }));
vi.mock("./api", () => api);
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ loading: false }) }));
vi.mock("@/components/layout/ServiceInnerLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import Borrowing from "./index";
const book = { id: 42, title: "Shared title", author: "Selected author", copies: 2, registered_copies: 2, available: 1, canReserve: true };
const page = { page: 1, limit: 6, total: 1, totalPages: 1 };
const reservation: ActiveReservation = { id: 7, book_id: 99, title: "Shared title", author: "Other author", status: "pending", reserved_at: "2026-10-24T08:00:00Z", expires_at: "2026-10-25T08:00:00Z" };
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  api.fetchActiveReservations.mockResolvedValue([]);
  api.fetchReservationHistory.mockResolvedValue({ rows: [], pagination: page });
  api.searchReservationCatalogue.mockImplementation(async (_query, _page, _signal, bookId) => ({ rows: [{ ...book, id: bookId ?? 42, title: bookId === 43 ? "Second selected title" : book.title }], pagination: page }));
  api.reserveBook.mockResolvedValue({ reservationId: 8, expiresAt: "2026-10-25T08:00:00Z" });
});
function Controls() { const navigate = useNavigate(); return <><button onClick={() => navigate("/services/borrowing?bookId=43")}>Another selection</button><button onClick={() => navigate(-1)}>Back</button></>; }
function mount(url = "/services/borrowing?bookId=42") {
  const Wrapper = createTestQueryClientWrapper();
  return render(<Wrapper><MemoryRouter initialEntries={[url]}><Borrowing /><Controls /></MemoryRouter></Wrapper>);
}
describe("contextual reservations", () => {
  it("fetches the exact selected ID on entry and reserves only after confirmation, despite duplicate titles", async () => {
    api.fetchActiveReservations.mockResolvedValue([reservation]);
    api.reserveBook.mockImplementationOnce(async () => {
      api.fetchActiveReservations.mockResolvedValue([reservation, { ...reservation, id: 8, book_id: 42 }]);
      return { reservationId: 8, expiresAt: "2026-10-25T08:00:00Z" };
    });
    mount();
    const button = await screen.findByRole("button", { name: "Reserve" });
    expect(api.searchReservationCatalogue).toHaveBeenCalledWith("", 1, expect.any(AbortSignal), 42);
    expect(button).toBeEnabled();
    expect(api.reserveBook).not.toHaveBeenCalled();
    expect(screen.getByRole("searchbox")).toHaveValue("Shared title");
    expect(screen.getByRole("heading", { name: "1 result" })).toBeInTheDocument();
    expect(screen.queryByText("Browse books to reserve")).not.toBeInTheDocument();
    fireEvent.click(button);
    await screen.findByRole("alertdialog");
    expect(api.reserveBook).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm reservation" }));
    await waitFor(() => expect(api.reserveBook).toHaveBeenCalledTimes(1));
    expect(api.reserveBook).toHaveBeenCalledWith(42);
    expect(await screen.findByRole("button", { name: "Reserved" })).toBeDisabled();
    expect(screen.getByRole("searchbox")).toHaveValue("Shared title");
    expect(screen.getByText("Selected author")).toBeInTheDocument();
  });
  it("responds to navigation and browser back without losing the selected ID", async () => {
    mount();
    await screen.findByRole("button", { name: "Reserve" });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "History" }), { button: 0, ctrlKey: false });
    await waitFor(() => expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true"));
    fireEvent.click(screen.getByText("Another selection"));
    await waitFor(() => expect(api.searchReservationCatalogue).toHaveBeenLastCalledWith("", 1, expect.any(AbortSignal), 43));
    expect(screen.getByRole("tab", { name: /Reserve/ })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(screen.getByRole("searchbox")).toHaveValue("Second selected title"));
    fireEvent.click(screen.getByText("Back"));
    await waitFor(() => expect(api.searchReservationCatalogue).toHaveBeenLastCalledWith("", 1, expect.any(AbortSignal), 42));
    await waitFor(() => expect(screen.getByRole("searchbox")).toHaveValue("Shared title"));
  });
  it("clears the selected mode when browsing or searching", async () => {
    mount();
    await screen.findByRole("button", { name: "Reserve" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "New title" } });
    await waitFor(() => expect(api.searchReservationCatalogue).toHaveBeenLastCalledWith("New title", 1, expect.any(AbortSignal), undefined));
    expect(screen.getByRole("heading", { name: "1 result" })).toBeInTheDocument();
  });
  it("does not replace invalid or removed selections with browse results", async () => {
    const view = mount("/services/borrowing?bookId=bad");
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid");
    expect(api.searchReservationCatalogue).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    view.unmount();
    api.searchReservationCatalogue.mockResolvedValue({ rows: [], pagination: { ...page, total: 0 } });
    mount();
    expect(await screen.findByText(/no longer available in the reservation catalogue/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Browse all books"));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    await waitFor(() => expect(api.searchReservationCatalogue).toHaveBeenLastCalledWith("", 1, expect.any(AbortSignal), undefined));
  });
  it("shows changed eligibility without submitting", async () => {
    api.searchReservationCatalogue.mockResolvedValue({ rows: [{ ...book, canReserve: false }], pagination: page });
    mount();
    expect(await screen.findByRole("button", { name: "Unavailable" })).toBeDisabled();
    expect(api.reserveBook).not.toHaveBeenCalled();
  });
  it("focuses a management target after loading and reports a missing reservation", async () => {
    api.fetchActiveReservations.mockResolvedValue([reservation]);
    const view = mount("/services/borrowing#reservation-7");
    await waitFor(() => expect(document.getElementById("reservation-7")).toHaveFocus());
    expect(screen.getByRole("button", { name: /Cancel reservation for/ })).toBeEnabled();
    view.unmount();
    mount("/services/borrowing#reservation-88");
    expect(await screen.findByText("This reservation is no longer active.")).toBeInTheDocument();
    expect(screen.getByText("Other author")).toBeInTheDocument();
  });
});


it("retains the sole selected result across History, cancellation, and a fresh mount", async () => {
  const first = mount();
  await screen.findByRole("button", { name: "Reserve" });
  expect(screen.getByRole("searchbox")).toHaveValue("Shared title");
  fireEvent.mouseDown(screen.getByRole("tab", { name: "History" }), { button: 0, ctrlKey: false });
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Reserve/ }), { button: 0, ctrlKey: false });
  expect(screen.getByRole("searchbox")).toHaveValue("Shared title");
  fireEvent.click(screen.getByRole("button", { name: "Reserve" }));
  await screen.findByRole("alertdialog");
  fireEvent.click(screen.getByRole("button", { name: "Go back" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(screen.getByRole("searchbox")).toHaveValue("Shared title");
  expect(document.querySelectorAll(".reservation-book")).toHaveLength(1);
  first.unmount(); mount();
  await screen.findByRole("button", { name: "Reserve" });
  expect(screen.getByRole("searchbox")).toHaveValue("Shared title");
  expect(api.reserveBook).not.toHaveBeenCalled();
});


it("shows only bookId=51 and counts one result when the API returns an unfiltered browse page", async () => {
  api.searchReservationCatalogue.mockResolvedValue({
    rows: [
      { ...book, id: 50, title: "Attack on Titan, Vol. 1" },
      { ...book, id: 51, title: "86—Eighty-Six, Vol. 1" },
      { ...book, id: 52, title: "Ascendance of a Bookworm" },
      { ...book, id: 53, title: "Another title" },
    ],
    pagination: { ...page, total: 4 },
  });
  mount("/services/borrowing?bookId=51");
  expect(await screen.findByRole("heading", { name: "1 result" })).toBeInTheDocument();
  expect(screen.getByRole("searchbox")).toHaveValue("86—Eighty-Six, Vol. 1");
  expect(screen.queryByRole("heading", { name: "4 results" })).not.toBeInTheDocument();
  expect(screen.queryByText("Attack on Titan, Vol. 1")).not.toBeInTheDocument();
  expect(screen.queryByText("Ascendance of a Bookworm")).not.toBeInTheDocument();
  expect(document.querySelectorAll(".reservation-book")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Reserve" }));
  await screen.findByRole("alertdialog");
  expect(api.reserveBook).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm reservation" }));
  await waitFor(() => expect(api.reserveBook).toHaveBeenCalledWith(51));
});

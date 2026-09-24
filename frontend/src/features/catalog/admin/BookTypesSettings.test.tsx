// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import BookTypesSettings from "./BookTypesSettings";
import * as catalogApi from "./catalog.api";

vi.mock("./catalog.api", () => ({
  createBookType: vi.fn(),
  deleteBookType: vi.fn(),
  fetchBookTypes: vi.fn(),
  updateBookType: vi.fn(),
}));

afterEach(cleanup);

const policy: catalogApi.BookType = {
  id: 7,
  name: "General",
  default_borrow_days: 7,
  loan_duration_minutes: 10080,
  loan_duration_unit: "day",
  fine_per_hour: 1,
  fine_interval: "hour",
  initial_fine: 0,
  assigned_active_books: 2,
  assigned_archived_books: 1,
};

describe("book type policies", () => {
  beforeEach(() => {
    vi.mocked(catalogApi.fetchBookTypes).mockResolvedValue([policy]);
    vi.mocked(catalogApi.deleteBookType).mockResolvedValue({
      id: policy.id,
      name: policy.name,
      active_books: 2,
      archived_books: 1,
      affected_books: 3,
      message: "Policy deleted. 3 books now need a loan policy.",
    });
  });

  it("shows assigned book counts and confirms which books will need a policy", async () => {
    render(<BookTypesSettings />);
    expect(await screen.findByText("2 active · 1 archived")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete policy" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/2 active and 1 archived books are assigned/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Active books will show “Needs loan policy”/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Archived books will also need a policy if restored/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Existing loans can still be returned with their recorded terms/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete policy" }));
    await waitFor(() => expect(catalogApi.deleteBookType).toHaveBeenCalledWith(policy.id));
  });

  it("keeps inactive legacy policies available for permanent deletion", async () => {
    const inactivePolicy = { ...policy, id: 8, name: "Legacy", is_active: 0, assigned_active_books: 1, assigned_archived_books: 0 };
    vi.mocked(catalogApi.fetchBookTypes).mockResolvedValueOnce([inactivePolicy]);
    render(<BookTypesSettings />);

    expect(await screen.findByText("Inactive · delete only")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Delete policy" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/1 active and 0 archived book is assigned/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete policy" }));
    await waitFor(() => expect(catalogApi.deleteBookType).toHaveBeenCalledWith(inactivePolicy.id));
  });
});

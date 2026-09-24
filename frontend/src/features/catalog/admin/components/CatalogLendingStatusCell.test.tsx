// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Book } from "../AdminCatalog.types";
import CatalogLendingStatusCell from "./CatalogLendingStatusCell";

afterEach(cleanup);

describe("catalog lending status cell", () => {
  it("opens holdings for the book in the row", () => {
    const book: Book = { id: 42, title: "The Left Hand of Darkness", material_type: "book", available: 0, accessioned_copies: 0, unaccessioned_copies: 1, total_copies: 1 };
    const onAddHoldings = vi.fn();
    render(<CatalogLendingStatusCell book={book} archived={false} onAddHoldings={onAddHoldings} onAssignPolicy={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Add holdings" }));

    expect(onAddHoldings).toHaveBeenCalledWith(book);
  });

  it("keeps thesis records reference-only", () => {
    const book: Book = { id: 43, title: "Thesis", material_type: "thesis" };
    const onAddHoldings = vi.fn();
    render(<CatalogLendingStatusCell book={book} archived={false} onAddHoldings={onAddHoldings} onAssignPolicy={vi.fn()} />);

    expect(screen.getByText("Reference only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add holdings" })).not.toBeInTheDocument();
    expect(onAddHoldings).not.toHaveBeenCalled();
  });

  it("does not offer holdings changes for archived records", () => {
    const book: Book = { id: 44, title: "Archived book", material_type: "book", available: 0, accessioned_copies: 0, unaccessioned_copies: 1, total_copies: 1 };
    render(<CatalogLendingStatusCell book={book} archived onAddHoldings={vi.fn()} onAssignPolicy={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Add holdings" })).not.toBeInTheDocument();
  });

  it("explains when a policy must be assigned before lending resumes", () => {
    const book: Book = { id: 45, title: "No policy", material_type: "book", needs_policy: true, total_copies: 2 };
    const onAssignPolicy = vi.fn();
    render(<CatalogLendingStatusCell book={book} archived={false} onAddHoldings={vi.fn()} onAssignPolicy={onAssignPolicy} />);
    expect(screen.getByText("Needs loan policy")).toBeInTheDocument();
    expect(screen.getByText("Lending is paused until an active policy is assigned.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Assign policy" }));
    expect(onAssignPolicy).toHaveBeenCalledWith(book);
  });
});

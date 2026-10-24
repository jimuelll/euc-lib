// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Link, MemoryRouter } from "react-router-dom";
import { createTestQueryClientWrapper } from "@/test-utils/query-client";

const { fetchPublicCatalogSchema, searchPublicCatalogue } = vi.hoisted(() => ({
  fetchPublicCatalogSchema: vi.fn(),
  searchPublicCatalogue: vi.fn(),
}));
vi.mock("@/features/catalog/api", () => ({ fetchPublicCatalogSchema, searchPublicCatalogue }));
vi.mock("@/components/layout/Navbar", () => ({ default: () => null }));
vi.mock("@/components/layout/Footer", () => ({ default: () => null }));
vi.mock("@/features/recommendations", () => ({ RecommendationStrip: () => <div data-testid="related-recommendations" /> }));

import Catalogue from "./Catalogue";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  fetchPublicCatalogSchema.mockResolvedValue([]);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((media: string) => ({ matches: false, media, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })),
  });
});

const renderCatalogue = (materialType: "book" | "thesis", initialEntry = "/catalogue", includeRecommendationLink = false) => {
  const QueryWrapper = createTestQueryClientWrapper();
  searchPublicCatalogue.mockResolvedValue({
    rows: [{ id: 14, title: "Sample catalogue title", author: "Test Author", material_type: materialType, canReserve: materialType === "book", available: 1, registered_copies: 1 }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    facets: { format: { all: 1, book: materialType === "book" ? 1 : 0, thesis: materialType === "thesis" ? 1 : 0 }, availability: { all: 1, available: 1, unavailable: 0 }, categories: [] },
  });
  render(<QueryWrapper><MemoryRouter initialEntries={[initialEntry]}><Catalogue />{includeRecommendationLink ? <Link to="/catalogue?q=Recommended%20title">Recommended book</Link> : null}</MemoryRouter></QueryWrapper>);
};

describe("catalogue recommendation action", () => {
  it("exposes the availability switch state in words and filters the query", async () => {
    renderCatalogue("book");
    await screen.findByRole("button", { name: "Sample catalogue title" }, { timeout: 10000 });
    const toggle = screen.getByRole("switch", { name: /Available now: off/ });
    expect(toggle).not.toBeChecked();
    expect(screen.getByText("1 of 1 copies available")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByRole("switch", { name: /Available now: on/ })).toBeChecked();
    await waitFor(() => expect(searchPublicCatalogue).toHaveBeenLastCalledWith(expect.objectContaining({ availability: "available" }), expect.any(AbortSignal)));
  }, 20000);
  it("disables loaded zero-result choices while keeping the selected choice and reset usable", async () => {
    renderCatalogue("book", "/catalogue?format=thesis");
    await screen.findByRole("button", { name: "Sample catalogue title" }, { timeout: 10000 });
    expect(screen.getByRole("button", { name: /^Unavailable/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Theses/ })).toBeEnabled();
    const reset = screen.getByRole("button", { name: /^All formats/ });
    expect(reset).toBeEnabled();
    fireEvent.click(reset);
    await waitFor(() => expect(screen.getByRole("button", { name: /^Theses/ })).toBeDisabled(), { timeout: 10000 });
  }, 20000);
  it("opens and closes recommendations from the View similar books result action", async () => {
    renderCatalogue("book");
    const result = await screen.findByRole("button", { name: "Sample catalogue title" }, { timeout: 10000 });
    const allFormats = screen.getByRole("button", { name: /All formats/ });
    expect(allFormats).toHaveAttribute("aria-pressed", "true");
    const similarAction = screen.getByRole("button", { name: "View similar books for Sample catalogue title" });
    expect(similarAction).toHaveAttribute("aria-expanded", "false");
    expect(result).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(similarAction);
    expect(await screen.findByTestId("related-recommendations")).toBeInTheDocument();
    const openResult = screen.getByRole("button", { name: "Sample catalogue title" });
    expect(openResult).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(openResult);
    expect(screen.queryByTestId("related-recommendations")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sample catalogue title" })).toHaveAttribute("aria-expanded", "false");
  }, 20000);

  it("labels the thesis action View related theses and toggles its recommendations", async () => {
    renderCatalogue("thesis");
    const result = await screen.findByRole("button", { name: "Sample catalogue title" }, { timeout: 10000 });
    expect(screen.getByRole("button", { name: "View related theses for Sample catalogue title" })).toBeInTheDocument();
    fireEvent.click(result);
    expect(await screen.findByTestId("related-recommendations")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sample catalogue title" }));
    expect(screen.queryByTestId("related-recommendations")).not.toBeInTheDocument();
  }, 20000);

  it("searches the recommended title when navigating from an existing catalogue search", async () => {
    renderCatalogue("book", "/catalogue?q=Earlier%20search", true);
    await screen.findByRole("button", { name: "Sample catalogue title" }, { timeout: 10000 });
    await new Promise((resolve) => setTimeout(resolve, 400));
    searchPublicCatalogue.mockClear();

    fireEvent.click(screen.getByRole("link", { name: "Recommended book" }));

    await waitFor(() => expect(screen.getByLabelText("Search the public catalogue")).toHaveValue("Recommended title"));
    await waitFor(() => expect(searchPublicCatalogue).toHaveBeenCalledTimes(1));
    expect(searchPublicCatalogue).toHaveBeenCalledWith(expect.objectContaining({ query: "Recommended title" }), expect.any(AbortSignal));
  }, 20000);
});


describe("catalogue reservation links", () => {
  it("carries the exact book ID in list and grid views", async () => {
    renderCatalogue("book");
    const link = await screen.findByRole("link", { name: "Reserve Sample catalogue title" });
    expect(link).toHaveAttribute("href", "/services/borrowing?bookId=14");
    expect(link).toHaveClass("catalogue-primary");
    const side = link.closest(".catalogue-record-side")!;
    expect(side).toHaveTextContent("1 of 1 copies available");
    expect(side).not.toContainElement(screen.getByRole("button", { name: "View similar books for Sample catalogue title" }));
    fireEvent.click(screen.getByRole("button", { name: "Grid view" }));
    expect(screen.getByRole("link", { name: "Reserve Sample catalogue title" })).toHaveAttribute("href", "/services/borrowing?bookId=14");
  });
  it("does not offer reservation for reference-only theses", async () => {
    renderCatalogue("thesis");
    await screen.findByRole("button", { name: "Sample catalogue title" });
    expect(screen.queryByRole("link", { name: /^Reserve/ })).not.toBeInTheDocument();
  });
});

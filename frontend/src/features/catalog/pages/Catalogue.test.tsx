// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Link, MemoryRouter } from "react-router-dom";

const { fetchPublicCatalogSchema, searchPublicCatalogue } = vi.hoisted(() => ({
  fetchPublicCatalogSchema: vi.fn(),
  searchPublicCatalogue: vi.fn(),
}));
vi.mock("@/features/catalog/api", () => ({ fetchPublicCatalogSchema, searchPublicCatalogue }));
vi.mock("@/components/layout/Navbar", () => ({ default: () => null }));
vi.mock("@/components/layout/Footer", () => ({ default: () => null }));
vi.mock("@/components/layout/PublicPageMasthead", () => ({ default: ({ children }: { children: React.ReactNode }) => <header>{children}</header> }));
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
  searchPublicCatalogue.mockResolvedValue({
    rows: [{ id: 14, title: "Sample catalogue title", author: "Test Author", material_type: materialType, available: 1, registered_copies: 1 }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    facets: { format: { all: 1, book: materialType === "book" ? 1 : 0, thesis: materialType === "thesis" ? 1 : 0 }, availability: { all: 1, available: 1, unavailable: 0 }, categories: [] },
  });
  render(<MemoryRouter initialEntries={[initialEntry]}><Catalogue />{includeRecommendationLink ? <Link to="/catalogue?q=Recommended%20title">Recommended book</Link> : null}</MemoryRouter>);
};

describe("catalogue recommendation action", () => {
  it("opens and closes recommendations from the View similar books result action", async () => {
    renderCatalogue("book");
    const result = await screen.findByRole("button", { name: /Sample catalogue title/ }, { timeout: 10000 });
    const allFormats = screen.getByRole("button", { name: /All formats/ });
    expect(allFormats).toHaveAttribute("aria-pressed", "true");
    expect(allFormats.firstElementChild).toHaveClass("border-warning", "bg-primary", "text-warning");
    expect(screen.getAllByText("View similar books")).toHaveLength(2);
    expect(screen.getAllByText("View similar books")[0].parentElement).toHaveClass("sm:hidden");
    expect(result).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(result);
    expect(await screen.findByTestId("related-recommendations")).toBeInTheDocument();
    const openResult = screen.getByRole("button", { name: /Sample catalogue title/ });
    expect(openResult).toHaveAttribute("aria-expanded", "true");
    expect(openResult).toHaveClass("border-warning");
    fireEvent.click(openResult);
    expect(screen.queryByTestId("related-recommendations")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sample catalogue title/ })).toHaveAttribute("aria-expanded", "false");
  }, 20000);

  it("labels the thesis action View related theses and toggles its recommendations", async () => {
    renderCatalogue("thesis");
    const result = await screen.findByRole("button", { name: /Sample catalogue title/ }, { timeout: 10000 });
    expect(screen.getAllByText("View related theses")).toHaveLength(2);
    fireEvent.click(result);
    expect(await screen.findByTestId("related-recommendations")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sample catalogue title/ }));
    expect(screen.queryByTestId("related-recommendations")).not.toBeInTheDocument();
  }, 20000);

  it("searches the recommended title when navigating from an existing catalogue search", async () => {
    renderCatalogue("book", "/catalogue?q=Earlier%20search", true);
    await screen.findByRole("button", { name: /Sample catalogue title/ }, { timeout: 10000 });
    await new Promise((resolve) => setTimeout(resolve, 400));
    searchPublicCatalogue.mockClear();

    fireEvent.click(screen.getByRole("link", { name: "Recommended book" }));

    await waitFor(() => expect(screen.getByLabelText("Search the public catalogue")).toHaveValue("Recommended title"));
    await waitFor(() => expect(searchPublicCatalogue).toHaveBeenCalledTimes(1));
    expect(searchPublicCatalogue).toHaveBeenCalledWith(expect.objectContaining({ query: "Recommended title" }));
  }, 20000);
});

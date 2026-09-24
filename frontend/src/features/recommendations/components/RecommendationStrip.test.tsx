// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { Recommendation } from "./RecommendationStrip";

const { fetchRecommendations, dismissRecommendation } = vi.hoisted(() => ({
  fetchRecommendations: vi.fn(),
  dismissRecommendation: vi.fn(),
}));
vi.mock("../api", () => ({ fetchRecommendations, dismissRecommendation }));

import { RecommendationStrip } from "./RecommendationStrip";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const setViewport = (width: number) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
};

const row = (overrides: Partial<Recommendation> & Pick<Recommendation, "id" | "title">): Recommendation => ({
  author: "Test Author",
  image_url: null,
  material_type: "book",
  available: 1,
  needs_policy: false,
  availability_status: overrides.material_type === "thesis" ? "reference_only" : Number(overrides.available ?? 1) > 0 ? "available" : "unavailable",
  reason: "Similar category: Literature",
  source: "rule",
  ...overrides,
});

describe("recommendation cards", () => {
  it("shows up to three cards at a time with covers, fallbacks, actual availability, icon-only AI marker, and catalogue links", async () => {
    setViewport(1440);
    fetchRecommendations.mockResolvedValue({ rows: [
      row({ id: 1, title: "Cover book", image_url: "https://covers.example/book.jpg", source: "ai" }),
      row({ id: 2, title: "Checked out book", available: 0, availability_status: "checked_out" }),
      row({ id: 3, title: "Reserved book", available: 0, availability_status: "reserved" }),
      row({ id: 4, title: "Unavailable book", available: 0, needs_policy: true, availability_status: "unavailable" }),
      row({ id: 5, title: "Fifth recommendation" }),
      row({ id: 6, title: "Sixth recommendation" }),
      row({ id: 7, title: "Seventh recommendation" }),
      row({ id: 8, title: "Eighth recommendation" }),
    ] });
    render(<MemoryRouter><RecommendationStrip materialType="book" seedBookId={42} /></MemoryRouter>);

    const cover = await screen.findByRole("img", { name: "Cover of Cover book" });
    expect(cover).toHaveAttribute("src", "https://covers.example/book.jpg");
    expect(screen.getAllByRole("img", { name: "Generic book cover" })[0]).toHaveAttribute("src", "/book-cover-fallback.svg");
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByText("Checked out")).toBeInTheDocument();
    expect(screen.getByText("Reserved")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "AI recommendation" })).toBeInTheDocument();
    expect(screen.queryByText("AI recommendations")).not.toBeInTheDocument();
    expect(screen.queryByText("Browse all")).not.toBeInTheDocument();
    expect(screen.getByText("Cover book").closest("a")).toHaveAttribute("href", "/catalogue?q=Cover%20book");
    expect(screen.getByText("1 of 3")).toBeInTheDocument();

    fireEvent.error(cover);
    await waitFor(() => expect(cover).toHaveAttribute("src", "/book-cover-fallback.svg"));
    fireEvent.click(screen.getByRole("button", { name: "Next recommendations" }));
    expect(await screen.findByText("Unavailable book")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
  }, 12000);

  it.each([[390, 1, 8], [768, 2, 4], [960, 3, 3], [1440, 3, 3]])("paginates to fit %i px wide layouts", async (width, cards, pages) => {
    setViewport(width);
    fetchRecommendations.mockResolvedValue({ rows: Array.from({ length: 8 }, (_, index) => row({ id: index + 1, title: `Book ${index + 1}` })) });
    render(<MemoryRouter><RecommendationStrip materialType="book" seedBookId={42} /></MemoryRouter>);

    expect(await screen.findByText(`1 of ${pages}`)).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(cards);
  });

  it("resets to the first page when the seed changes", async () => {
    setViewport(1440);
    const firstSet = Array.from({ length: 8 }, (_, index) => row({ id: index + 1, title: `First set ${index + 1}` }));
    const secondSet = Array.from({ length: 8 }, (_, index) => row({ id: index + 21, title: `Second set ${index + 1}` }));
    fetchRecommendations.mockResolvedValueOnce({ rows: firstSet }).mockResolvedValueOnce({ rows: secondSet });
    const { rerender } = render(<MemoryRouter><RecommendationStrip materialType="book" seedBookId={42} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Next recommendations" }));
    expect(screen.getByText("2 of 3")).toBeInTheDocument();

    rerender(<MemoryRouter><RecommendationStrip materialType="book" seedBookId={43} /></MemoryRouter>);
    expect(await screen.findByText("Second set 1")).toBeInTheDocument();
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
  });

  it("keeps a personal recommendation page valid after a dismissal", async () => {
    setViewport(1440);
    fetchRecommendations.mockResolvedValue({ rows: Array.from({ length: 5 }, (_, index) => row({ id: index + 1, title: `Personal book ${index + 1}` })) });
    render(<MemoryRouter><RecommendationStrip materialType="book" personal /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Next recommendations" }));
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not interested in Personal book 5" }));

    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Personal book 4")).toBeInTheDocument();
    expect(screen.queryByText("Personal book 5")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous recommendations" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next recommendations" })).toBeDisabled();
    expect(dismissRecommendation).toHaveBeenCalledWith(5);
  });

  it("uses the thesis fallback and preserves personal dismiss actions", async () => {
    setViewport(390);
    fetchRecommendations.mockResolvedValue({ rows: [
      row({ id: 3, title: "Thesis example", material_type: "thesis", image_url: "https://covers.example/ignored-thesis.jpg" }),
    ] });
    render(<MemoryRouter><RecommendationStrip materialType="thesis" personal /></MemoryRouter>);

    expect(await screen.findByRole("img", { name: "Generic thesis cover" })).toHaveAttribute("src", "/thesis-cover-fallback.svg");
    fireEvent.click(screen.getByRole("button", { name: "Not interested in Thesis example" }));
    expect(dismissRecommendation).toHaveBeenCalledWith(3);
    await waitFor(() => expect(screen.queryByText("Thesis example")).not.toBeInTheDocument());
  });
});

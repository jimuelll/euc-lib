// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { SiteContent } from "../site-content.service";

const state = vi.hoisted(() => ({
  content: undefined as SiteContent | undefined,
  auth: { isLoggedIn: false, loading: false },
  navigate: vi.fn(),
}));
vi.mock("../useSiteContent", () => ({ useSiteContent: () => ({ data: state.content }) }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...await importOriginal<typeof import("react-router-dom")>(),
  useNavigate: () => state.navigate,
}));
import HeroSection from "./HeroSection";

const renderHero = () => render(<MemoryRouter><HeroSection /></MemoryRouter>);
afterEach(cleanup);
beforeEach(() => {
  state.content = undefined;
  state.auth = { isLoggedIn: false, loading: false };
  state.navigate.mockReset();
});

describe("hero content and discovery", () => {
  it("keeps edited CMS fields and statistics, including duplicate labels", () => {
    state.content = {
      hero_kicker: "Edited institution", hero_title: "Edited collection", hero_highlight: "Research",
      hero_description: "Edited services description", hero_image_url: "/custom-photo.jpg",
      hero_stats: [{ value: "Edited value one", label: "Collection" }, { value: "Edited value two", label: "Collection" }, { value: "Edited value three", label: "Access" }],
      hours: [], address: "", contact_email: "", contact_phone: "",
    };
    renderHero();
    expect(screen.getByText("Edited institution")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Edited collection Research" })).toBeInTheDocument();
    expect(screen.getByText("Edited services description")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", "/custom-photo.jpg");
    expect(screen.getAllByRole("definition").map((item) => item.textContent)).toEqual(["Edited value one", "Edited value two", "Edited value three"]);
  });

  it("focuses blank search, clears feedback with Escape, and encodes a trimmed query", () => {
    renderHero();
    const input = screen.getByRole("textbox", { name: "Search the catalogue" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a search term.");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(state.navigate).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "  history & culture  " } });
    fireEvent.submit(screen.getByRole("search"));
    expect(state.navigate).toHaveBeenCalledWith("/catalogue?q=history%20%26%20culture");
  });

  it("preserves guest, member, and loading actions", () => {
    const view = renderHero();
    expect(screen.getByRole("link", { name: "Explore library services" })).toHaveAttribute("href", "/services");
    expect(screen.queryByRole("link", { name: "Browse Catalogue" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login for Reservation" })).toHaveAttribute("href", "/login");
    state.auth = { isLoggedIn: true, loading: false };
    view.rerender(<MemoryRouter><HeroSection /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Go to My Library" })).toHaveAttribute("href", "/my-library");
    state.auth.loading = true;
    view.rerender(<MemoryRouter><HeroSection /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: "Go to My Library" })).not.toBeInTheDocument();
    expect(view.container.querySelector(".homepage-hero-member-placeholder")).toBeInTheDocument();
  });

  it("tries the default photo once, then removes a broken image and recovers when CMS changes", () => {
    state.content = { hero_image_url: "/broken-custom.jpg" } as SiteContent;
    const view = renderHero();
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/hero.jpg");
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    state.content.hero_image_url = "/replacement.jpg";
    view.rerender(<MemoryRouter><HeroSection /></MemoryRouter>);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/replacement.jpg");
  });
});

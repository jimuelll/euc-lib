// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ data: undefined as undefined | { address: string; contact_email: string; contact_phone: string; hours: [] } }));
vi.mock("../useSiteContent", () => ({ useSiteContent: () => state }));
vi.mock("framer-motion", () => ({ useReducedMotion: () => true, motion: { div: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div> } }));
import LibraryHoursSection from "./LibraryHoursSection";
afterEach(cleanup);
describe("homepage contacts", () => {
  it("does not show fallback contacts when loading or failed", () => {
    state.data = undefined;
    render(<LibraryHoursSection />);
    expect(screen.getByText("Contact details are currently unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/library@college/)).not.toBeInTheDocument();
  });
  it("shows populated fields and omits blank contact rows", () => {
    state.data = { address: "Published campus", contact_email: "", contact_phone: "1234", hours: [] };
    render(<LibraryHoursSection />);
    expect(screen.getByText("Published campus")).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
    expect(screen.queryByText("Email")).not.toBeInTheDocument();
  });
});

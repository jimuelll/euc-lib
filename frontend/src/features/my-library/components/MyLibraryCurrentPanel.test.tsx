// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import MyLibraryCurrentPanel from "./MyLibraryCurrentPanel";
import type { ActiveReservation, MyLibraryDashboard } from "../types";
afterEach(cleanup);
describe("My Library reservation management", () => {
  it("exposes management links and status-specific deadlines for populated reservations", () => {
    const reservations = [
      { id: 1, title: "Pending title", status: "pending", expires_at: "2026-10-25T08:00:00Z" },
      { id: 2, title: "Ready title", status: "ready", expires_at: "2026-10-25T08:00:00Z" },
      { id: 3, title: "Missing deadline", status: "pending", expires_at: null },
      { id: 4, title: "Invalid deadline", status: "ready", expires_at: "bad" },
    ].map(item => ({ ...item, author: "Author", reserved_at: "2026-10-24T08:00:00Z" })) as ActiveReservation[];
    render(<MemoryRouter><MyLibraryCurrentPanel data={{ active_borrows: [], active_reservations: reservations } as MyLibraryDashboard} /></MemoryRouter>);
    expect(screen.getByText(/^Waiting expires /)).toBeInTheDocument();
    expect(screen.getByText(/^Pick up by /)).toBeInTheDocument();
    expect(screen.getByText("Waiting deadline unavailable")).toBeInTheDocument();
    expect(screen.getByText("Pickup deadline unavailable")).toBeInTheDocument();
    for (const item of reservations) expect(screen.getByRole("link", { name: `Manage reservation for ${item.title}` })).toHaveAttribute("href", `/services/borrowing#reservation-${item.id}`);
  });
});

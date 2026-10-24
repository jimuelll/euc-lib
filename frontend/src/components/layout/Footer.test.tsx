// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
const state = vi.hoisted(() => ({ data: undefined as undefined | { address: string; contact_email: string; contact_phone: string } }));
vi.mock("@/features/site-content", () => ({ useSiteContent: () => state }));
import Footer from "./Footer";
afterEach(cleanup);
describe("configured footer contacts", () => {
  it("shows only configured contact fields", () => {
    state.data = { address: "Campus library", contact_email: "", contact_phone: "1234" };
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByText("Campus library")).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
    expect(screen.queryByText(/library@college/)).not.toBeInTheDocument();
    expect(screen.queryByText(/currently unavailable/)).not.toBeInTheDocument();
  });
  it.each([undefined, { address: "", contact_email: " ", contact_phone: "" }])("shows an honest empty state without data", data => {
    state.data = data;
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByText("Contact details are currently unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/123 University/)).not.toBeInTheDocument();
  });
});

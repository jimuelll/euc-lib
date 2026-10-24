// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, createTestQueryClientWrapper } from "@/test-utils/query-client";
import { aboutKeys } from "./about.keys";
const api = vi.hoisted(() => ({ getAboutSettings: vi.fn() }));
vi.mock("./api/about.service", () => api);
vi.mock("@/components/layout/Navbar", () => ({ default: () => null }));
vi.mock("@/components/layout/Footer", () => ({ default: () => null }));
import About from "./index";
const content = { library_name: "Published Library", mission_title: "Our mission", mission_text: "Published mission", history_text: "", history_title: "", staff: [], spaces: [], policies: [], facilities: [] };
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
function mount(client = createTestQueryClient()) { render(<About />, { wrapper: createTestQueryClientWrapper(client) }); return client; }
describe("truthful About content", () => {
  it("shows loading without sample content", () => {
    api.getAboutSettings.mockReturnValue(new Promise(() => {}));
    mount();
    expect(screen.queryByText("Dr. Elena Santos")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "On this page" })).not.toBeInTheDocument();
  });
  it("shows a retryable error and recovers with published sections only", async () => {
    api.getAboutSettings.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(content);
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
    expect(screen.queryByText("Est. 2010")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Published mission")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Library history" })).not.toBeInTheDocument();
    expect(document.getElementById("about-history")).toBeNull();
  });
  it.each([null, { ...content, mission_text: "" }])("shows unpublished information for an empty response", async value => {
    api.getAboutSettings.mockResolvedValue(value);
    mount();
    expect(await screen.findByText(/has not been published yet/)).toBeInTheDocument();
  });
  it("treats a missing About record as unpublished", async () => {
    api.getAboutSettings.mockRejectedValue({ response: { status: 404 } });
    mount();
    expect(await screen.findByText(/has not been published yet/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("retains published content with a warning if background refresh fails", async () => {
    api.getAboutSettings.mockRejectedValue(new Error("offline"));
    const client = createTestQueryClient();
    client.setQueryData(aboutKeys.public(), content);
    mount(client);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Showing previously loaded information"));
    expect(screen.getByText("Published mission")).toBeInTheDocument();
  });
});

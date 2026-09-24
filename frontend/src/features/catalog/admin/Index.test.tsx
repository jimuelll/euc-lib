// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import AdminCatalog from "./Index";
import * as catalogApi from "./catalog.api";

const auth = vi.hoisted(() => ({ role: "super_admin" }));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { role: auth.role } }) }));
vi.mock("@/features/admin", () => ({
  useAdminUrlState: () => [new URLSearchParams("tab=ai")],
  AdminPage: ({ title, description, children }: any) => <main><h1>{title}</h1><p>{description}</p>{children}</main>,
  AdminPanel: ({ title, actions, children }: any) => <section><h2>{title}</h2>{actions}{children}</section>,
  AdminStatCard: ({ label, value, helperText }: any) => <div><span>{label}</span><span>{value}</span><span>{helperText}</span></div>,
}));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./AdminCatalogData", () => ({ default: () => null }));
vi.mock("./AdminCatalogBuilder", () => ({ default: () => null }));
vi.mock("./ManualBookMetadata", () => ({ default: ({ backfillRevision }: { backfillRevision: number }) => <p data-testid="metadata-refresh-revision">{backfillRevision}</p> }));
vi.mock("./catalog.api", () => ({
  backfillEmbeddings: vi.fn(),
  fetchBackfillProgress: vi.fn(),
  fetchCatalogSchema: vi.fn(),
  fetchEmbeddingStatus: vi.fn(),
}));

const running = (): catalogApi.EmbeddingBackfillProgress => ({
  status: "running", total: 2, completed: 0, embedded: 0, failed: 0, lookupFailed: 0, skipped: 0, currentTitle: "Atlas", errors: [],
});

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(catalogApi.fetchCatalogSchema).mockResolvedValue([]);
  vi.mocked(catalogApi.fetchEmbeddingStatus).mockResolvedValue({ total: 4, ready: 2, stale: 1, failed: 1, missing: 3, errors: [] });
  vi.mocked(catalogApi.backfillEmbeddings).mockResolvedValue(running());
  vi.mocked(catalogApi.fetchBackfillProgress).mockResolvedValue({
    ...running(), status: "completed", completed: 2, embedded: 2, currentTitle: null,
  });
});

async function startBackfill() {
  render(<AdminCatalog />);
  fireEvent.click(await screen.findByRole("button", { name: "Backfill AI recommendations" }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Start backfill" }));
  return dialog;
}

describe("AI recommendation backfill dialog", () => {
  it("shows a clear completion state after progress polling finishes", async () => {
    await startBackfill();

    const dialog = await screen.findByRole("alertdialog");
    expect(await within(dialog).findByRole("heading", { name: "Backfill complete" })).toBeInTheDocument();
    expect(within(dialog).getByText("Created ready AI embeddings for 2 books.")).toBeInTheDocument();
    expect(within(dialog).getByText("2 / 2 books processed")).toBeInTheDocument();
    expect(screen.getByTestId("metadata-refresh-revision")).toHaveTextContent("1");
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeEnabled();
  });

  it("explains embedding failures and separates online lookup failures", async () => {
    vi.mocked(catalogApi.fetchBackfillProgress).mockResolvedValue({
      ...running(), status: "completed_with_errors", total: 3, completed: 3, embedded: 1, failed: 2, lookupFailed: 1, currentTitle: null,
      errors: ["Atlas: Gemini embedding request failed (503)"],
    });
    await startBackfill();

    const dialog = await screen.findByRole("alertdialog");
    expect(await within(dialog).findByRole("heading", { name: "Backfill finished with errors" })).toBeInTheDocument();
    expect(within(dialog).getByText(/1 embeddings are ready and 2 could not be created/)).toBeInTheDocument();
    expect(within(dialog).getByText(/online details lookup failed for 1 book/)).toBeInTheDocument();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Atlas: Gemini embedding request failed (503)");
  });

  it("explains when no books need an update", async () => {
    vi.mocked(catalogApi.backfillEmbeddings).mockResolvedValue({
      ...running(), status: "completed", total: 0, currentTitle: null,
    });
    render(<AdminCatalog />);
    fireEvent.click(await screen.findByRole("button", { name: "Backfill AI recommendations" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Start backfill" }));

    await waitFor(() => expect(within(dialog).getByRole("heading", { name: "AI recommendations are up to date" })).toBeInTheDocument());
    expect(within(dialog).getByText("No active books were missing useful details or a ready AI embedding.")).toBeInTheDocument();
  });
});

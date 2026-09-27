// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import AdminCatalog from "./Index";
import * as catalogApi from "./catalog.api";
import { toast } from "@/components/ui/sonner";
import { createTestQueryClientWrapper } from "@/test-utils/query-client";

const auth = vi.hoisted(() => ({ role: "super_admin" }));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { role: auth.role } }) }));
vi.mock("@/features/admin", () => ({
  useAdminUrlState: () => [new URLSearchParams("tab=ai")],
  AdminPage: ({ title, description, children }: any) => <main><h1>{title}</h1><p>{description}</p>{children}</main>,
  AdminPanel: ({ title, actions, children }: any) => <section><h2>{title}</h2>{actions}{children}</section>,
  AdminStatCard: ({ label, value, helperText }: any) => <div><span>{label}</span><span>{value}</span><span>{helperText}</span></div>,
}));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
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
  status: "running", total: 2, completed: 0, missingSynopses: 4, embedded: 0, synopsesAdded: 0, synopsesNotFound: 0,
  failed: 0, lookupFailed: 0, deferred: 0, rateLimitRetryAt: null, currentTitle: "Atlas", errors: [], lookupErrors: [],
});

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(catalogApi.fetchCatalogSchema).mockResolvedValue([]);
  vi.mocked(catalogApi.fetchEmbeddingStatus).mockResolvedValue({ total: 4, ready: 2, stale: 1, failed: 1, missing: 3, missingSynopses: 4, needsAttention: 5, errors: [] });
  vi.mocked(catalogApi.backfillEmbeddings).mockResolvedValue(running());
  vi.mocked(catalogApi.fetchBackfillProgress).mockResolvedValue({
    ...running(), status: "completed", completed: 2, embedded: 2, synopsesAdded: 1, synopsesNotFound: 1, currentTitle: null,
  });
});

async function startBackfill() {
  render(<AdminCatalog />, { wrapper: createTestQueryClientWrapper() });
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
    expect(within(dialog).getByText("Added synopses to 1 book; online sources returned no description for 1 book; embeddings are ready for 2.")).toBeInTheDocument();
    expect(within(dialog).getByText("2 / 2 books processed")).toBeInTheDocument();
    expect(screen.getByTestId("metadata-refresh-revision")).toHaveTextContent("1");
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeEnabled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("1 synopsis added, 1 checked with no description"));
  });

  it("explains embedding failures and separates online lookup failures", async () => {
    vi.mocked(catalogApi.fetchBackfillProgress).mockResolvedValue({
      ...running(), status: "completed_with_errors", total: 3, completed: 3, embedded: 1, failed: 2, lookupFailed: 1, currentTitle: null,
      errors: ["Atlas: Gemini embedding request failed (503)"], lookupErrors: ["Open Library: Metadata source failed (503); Google Books: fetch failed"],
    });
    await startBackfill();

    const dialog = await screen.findByRole("alertdialog");
    expect(await within(dialog).findByRole("heading", { name: "Backfill finished with errors" })).toBeInTheDocument();
    expect(within(dialog).getByText(/had 1 lookup and 2 embedding failures/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Provider lookups failed for 1 book/).closest("div")).toHaveClass("text-foreground");
    expect(within(dialog).getByText(/Open Library: Metadata source failed \(503\); Google Books: fetch failed/)).toBeInTheDocument();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Atlas: Gemini embedding request failed (503)");
  });

  it("explains when automatic work is done but blank synopses need staff input", async () => {
    vi.mocked(catalogApi.backfillEmbeddings).mockResolvedValue({
      ...running(), status: "completed", total: 0, missingSynopses: 3, currentTitle: null,
    });
    render(<AdminCatalog />, { wrapper: createTestQueryClientWrapper() });
    fireEvent.click(await screen.findByRole("button", { name: "Backfill AI recommendations" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Start backfill" }));

    await waitFor(() => expect(within(dialog).getByRole("heading", { name: "No automatic backfill work available" })).toBeInTheDocument());
    expect(within(dialog).getByText("3 active books have a blank synopsis and need staff input in AI Recommendations.")).toBeInTheDocument();
    expect(within(dialog).getByText(/Add or review synopses/)).toBeInTheDocument();
  });

  it("shows deferred counts when Google Books rate limits and pauses the batch", async () => {
    vi.mocked(catalogApi.fetchBackfillProgress).mockResolvedValue({
      ...running(), status: "paused_rate_limited", total: 60, completed: 1, deferred: 59,
      lookupFailed: 1, rateLimitRetryAt: "2026-09-27T12:00:00.000Z", currentTitle: null,
    });
    await startBackfill();

    const dialog = await screen.findByRole("alertdialog");
    expect(await within(dialog).findByRole("heading", { name: "Paused because Google Books is rate limiting" })).toBeInTheDocument();
    expect(within(dialog).getByText(/Processed 1 of 60 books; 59 deferred/)).toBeInTheDocument();
    expect(within(dialog).getByText(/remaining books were not changed and are eligible for a later run/)).toBeInTheDocument();
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("after 1 of 60 books; 59 deferred"));
  });
});

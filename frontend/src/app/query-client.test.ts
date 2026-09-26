import { describe, expect, it } from "vitest";
import { queryClient, shouldRetryQuery } from "./query-client";

describe("shared TanStack Query defaults", () => {
  it("uses the configured cache lifetimes and revalidation behavior", () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(30_000);
    expect(defaults.queries?.gcTime).toBe(5 * 60_000);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(true);
    expect(defaults.queries?.refetchOnReconnect).toBe(true);
    expect(defaults.mutations?.retry).toBe(false);
  });

  it("retries a network or server error once, but skips client and cancellation errors", () => {
    expect(shouldRetryQuery(0, { isAxiosError: true, response: { status: 404 } })).toBe(false);
    expect(shouldRetryQuery(0, { isAxiosError: true, response: { status: 503 } })).toBe(true);
    expect(shouldRetryQuery(0, { isAxiosError: true, code: "ERR_CANCELED" })).toBe(false);
    expect(shouldRetryQuery(0, new Error("network unavailable"))).toBe(true);
    expect(shouldRetryQuery(1, new Error("second failure"))).toBe(false);
  });
});

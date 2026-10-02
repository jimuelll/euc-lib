import axios, { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import client, {
  setAuthFailureHandler,
  setAuthRefreshHandler,
  setInMemoryToken,
  refreshAccessToken,
} from "./AxiosInstance";

const unauthorized = (config: Parameters<AxiosAdapter>[0]): AxiosError => new AxiosError(
  "Unauthorized",
  AxiosError.ERR_BAD_REQUEST,
  config,
  undefined,
  {
    config,
    data: {},
    headers: new AxiosHeaders(),
    status: 401,
    statusText: "Unauthorized",
  },
);

afterEach(async () => {
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(3_000);
  vi.useRealTimers();
  setInMemoryToken(null);
  setAuthRefreshHandler(null);
  setAuthFailureHandler(null);
  vi.restoreAllMocks();
});

describe("Axios authentication refresh", () => {
  it("shares one refresh request across concurrent 401 responses", async () => {
    const originalAdapter = client.defaults.adapter;
    const refreshHandler = vi.fn();
    const adapter: AxiosAdapter = async (config) => {
      const authorization = config.headers.get("Authorization");
      if (authorization === "Bearer fresh-access") {
        return {
          config,
          data: { ok: true },
          headers: new AxiosHeaders(),
          status: 200,
          statusText: "OK",
        } satisfies AxiosResponse;
      }
      throw unauthorized(config);
    };
    client.defaults.adapter = adapter;
    const refreshRequest = vi.spyOn(axios, "post").mockResolvedValue({
      data: { accessToken: "fresh-access" },
    } as AxiosResponse);
    setAuthRefreshHandler(refreshHandler);

    try {
      const responses = await Promise.all([
        client.get("/api/private/one"),
        client.get("/api/private/two"),
      ]);
      expect(responses.map((response) => response.data)).toEqual([{ ok: true }, { ok: true }]);
      expect(refreshRequest).toHaveBeenCalledTimes(1);
      expect(refreshHandler).toHaveBeenCalledWith("fresh-access");
    } finally {
      client.defaults.adapter = originalAdapter;
    }
  });

  it("rejects every queued request and reports one auth failure when refresh fails", async () => {
    const originalAdapter = client.defaults.adapter;
    const failureHandler = vi.fn();
    const refreshError = new Error("refresh failed");
    const adapter: AxiosAdapter = async (config) => { throw unauthorized(config); };
    client.defaults.adapter = adapter;
    const refreshRequest = vi.spyOn(axios, "post").mockRejectedValue(refreshError);
    setAuthFailureHandler(failureHandler);

    try {
      const results = await Promise.allSettled([
        client.get("/api/private/one"),
        client.get("/api/private/two"),
      ]);
      expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
      expect(refreshRequest).toHaveBeenCalledTimes(1);
      expect(failureHandler).toHaveBeenCalledTimes(1);
      for (const result of results) {
        if (result.status === "rejected") expect(result.reason).toBe(refreshError);
      }
    } finally {
      client.defaults.adapter = originalAdapter;
    }
  });

  it("shares bootstrap and interceptor refresh calls", async () => {
    const refreshRequest = vi.spyOn(axios, "post").mockResolvedValue({
      data: { accessToken: "shared-refresh" },
    } as AxiosResponse);

    const tokens = await Promise.all([refreshAccessToken(), refreshAccessToken()]);

    expect(tokens).toEqual(["shared-refresh", "shared-refresh"]);
    expect(refreshRequest).toHaveBeenCalledTimes(1);
  });

  it("preserves a refresh 429 through its Retry-After cooldown", async () => {
    vi.useFakeTimers();
    const throttled = {
      response: {
        status: 429,
        data: { code: "RATE_LIMITED", retryAfterSeconds: 2 },
        headers: new AxiosHeaders({ "Retry-After": "2" }),
      },
    };
    const refreshRequest = vi.spyOn(axios, "post")
      .mockRejectedValueOnce(throttled)
      .mockResolvedValueOnce({ data: { accessToken: "after-cooldown" } } as AxiosResponse);

    await expect(refreshAccessToken()).rejects.toBe(throttled);
    await expect(refreshAccessToken()).rejects.toBe(throttled);
    expect(refreshRequest).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2_001);
    await expect(refreshAccessToken()).resolves.toBe("after-cooldown");
    expect(refreshRequest).toHaveBeenCalledTimes(2);
  });

  it("does not clear the session or replay a write when refresh is throttled", async () => {
    vi.useFakeTimers();
    const originalAdapter = client.defaults.adapter;
    const failureHandler = vi.fn();
    const throttled = {
      response: {
        status: 429,
        data: { code: "RATE_LIMITED", retryAfterSeconds: 2 },
        headers: new AxiosHeaders({ "Retry-After": "2" }),
      },
    };
    let writeRequests = 0;
    client.defaults.adapter = async (config) => {
      writeRequests += 1;
      throw unauthorized(config);
    };
    vi.spyOn(axios, "post").mockRejectedValue(throttled);
    setAuthFailureHandler(failureHandler);

    try {
      await expect(client.post("/api/private/write", { action: "borrow" })).rejects.toBe(throttled);
      expect(writeRequests).toBe(1);
      expect(failureHandler).not.toHaveBeenCalled();
    } finally {
      client.defaults.adapter = originalAdapter;
    }
  });
});

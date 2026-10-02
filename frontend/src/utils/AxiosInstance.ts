import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

let inMemoryToken: string | null = null;
let authRefreshHandler: ((token: string) => void) | null = null;
let authFailureHandler: (() => void) | null = null;
let refreshRequest: Promise<string> | null = null;
let refreshCooldownUntil = 0;
let refreshRateLimitError: unknown = null;

export function setInMemoryToken(token: string | null) {
  inMemoryToken = token;
}

export function setAuthRefreshHandler(handler: ((token: string) => void) | null) {
  authRefreshHandler = handler;
}

export function setAuthFailureHandler(handler: (() => void) | null) {
  authFailureHandler = handler;
}

axiosInstance.interceptors.request.use((config) => {
  if (inMemoryToken && config.headers) {
    config.headers.Authorization = `Bearer ${inMemoryToken}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: { resolve: (tokens: { accessToken: string }) => void; reject: (err: unknown) => void }[] = [];

const processQueue = (
  error: unknown,
  tokens: { accessToken: string } | null = null
) => {
  failedQueue.forEach((pending) => {
    if (error) pending.reject(error);
    else if (tokens) pending.resolve(tokens);
  });
  failedQueue = [];
};

const isAuthRoute = (url?: string) =>
  !!url && ["/api/auth/login", "/api/auth/refresh", "/api/auth/logout", "/api/auth/change-password"]
    .some((path) => url.includes(path));

function retryAfterMs(error: unknown): number {
  const response = (error as { response?: { headers?: unknown; data?: { retryAfterSeconds?: unknown } } } | null)?.response;
  const headers = response?.headers as { get?: (name: string) => unknown; [key: string]: unknown } | undefined;
  const rawHeader = typeof headers?.get === "function" ? headers.get("Retry-After") : headers?.["retry-after"] ?? headers?.["Retry-After"];
  const seconds = Number(response?.data?.retryAfterSeconds ?? rawHeader);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1_000, seconds * 1_000);
  const date = typeof rawHeader === "string" ? Date.parse(rawHeader) : Number.NaN;
  return Number.isFinite(date) ? Math.max(1_000, date - Date.now()) : 1_000;
}

// Bootstrap and the 401 interceptor share this request. A server 429 starts a
// local cooldown so refresh loops cannot extend the server-side rate limit.
export function refreshAccessToken(): Promise<string> {
  if (Date.now() < refreshCooldownUntil && refreshRateLimitError) {
    return Promise.reject(refreshRateLimitError);
  }
  if (refreshRequest) return refreshRequest;

  refreshRequest = axios.post(
    "/api/auth/refresh",
    {},
    {
      baseURL: import.meta.env.VITE_BASE_URL,
      headers: { "Content-Type": "application/json" },
      withCredentials: true,
    },
  ).then((response) => {
    const token = response.data.accessToken;
    if (typeof token !== "string" || !token) throw new Error("Invalid refresh response");
    setInMemoryToken(token);
    authRefreshHandler?.(token);
    refreshRateLimitError = null;
    refreshCooldownUntil = 0;
    return token;
  }).catch((error) => {
    if ((error as { response?: { status?: number } } | null)?.response?.status === 429) {
      refreshRateLimitError = error;
      refreshCooldownUntil = Date.now() + retryAfterMs(error);
    }
    throw error;
  }).finally(() => {
    refreshRequest = null;
  });

  return refreshRequest;
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest || isAuthRoute(originalRequest.url)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<{ accessToken: string }>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((tokens) => {
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
          return axiosInstance(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const tokens = { accessToken: await refreshAccessToken() };
        processQueue(null, tokens);

        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if ((refreshError as { response?: { status?: number } } | null)?.response?.status !== 429) authFailureHandler?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;

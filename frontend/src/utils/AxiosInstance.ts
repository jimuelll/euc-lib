import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

let inMemoryToken: string | null = null;
let authRefreshHandler: ((token: string) => void) | null = null;
let authFailureHandler: (() => void) | null = null;

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
        const res = await axios.post(
          "/api/auth/refresh",
          {},
          {
            baseURL: import.meta.env.VITE_BASE_URL,
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
          }
        );

        const tokens = {
          accessToken: res.data.accessToken,
        };

        setInMemoryToken(tokens.accessToken);
        authRefreshHandler?.(tokens.accessToken);
        processQueue(null, tokens);

        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        authFailureHandler?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;

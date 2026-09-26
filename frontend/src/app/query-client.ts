import { QueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

export const shouldRetryQuery = (failureCount: number, error: unknown) => {
  if (failureCount >= 1) return false;
  if (isAxiosError(error) && error.code === "ERR_CANCELED") return false;

  const status = isAxiosError(error) ? error.response?.status : undefined;
  return status === undefined || status >= 500;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: shouldRetryQuery,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});

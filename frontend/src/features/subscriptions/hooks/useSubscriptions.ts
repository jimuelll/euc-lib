import { useQuery } from "@tanstack/react-query";
import { fetchSubscriptions } from "../api";
import { subscriptionsKeys } from "../subscriptions.keys";
import type { Subscription, FetchStatus } from "../types";

interface UseSubscriptionsReturn {
  subscriptions: Subscription[];
  status: FetchStatus;
  error: string | null;
}

export function useSubscriptions(): UseSubscriptionsReturn {
  const query = useQuery({
    queryKey: subscriptionsKeys.public(),
    queryFn: ({ signal }) => fetchSubscriptions(signal),
  });

  const status: FetchStatus = query.isPending ? "loading" : query.isError ? "error" : "success";
  return {
    subscriptions: query.data ?? [],
    status,
    error: query.isError ? "Failed to load subscriptions. Please try again." : null,
  };
}

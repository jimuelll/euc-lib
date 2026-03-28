import { useEffect, useState } from "react";
import { fetchSubscriptions } from "../api";
import type { Subscription, FetchStatus } from "../types";

interface UseSubscriptionsReturn {
  subscriptions: Subscription[];
  status: FetchStatus;
  error: string | null;
}

export function useSubscriptions(): UseSubscriptionsReturn {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        setStatus("loading");
        setError(null);
        const data = await fetchSubscriptions(controller.signal);
        setSubscriptions(data);
        setStatus("success");
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError("Failed to load subscriptions. Please try again.");
          setStatus("error");
        }
      }
    })();

    return () => controller.abort();
  }, []);

  return { subscriptions, status, error };
}
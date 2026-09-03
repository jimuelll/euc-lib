import { useEffect, useState } from "react";
import { getApiErrorMessage, isRequestCancelled } from "@/utils/apiError";
import { fetchMyLibraryDashboard } from "../api";
import type { MyLibraryDashboard } from "../types";

export function useMyLibrary(enabled = true) {
  const [data, setData] = useState<MyLibraryDashboard | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const next = await fetchMyLibraryDashboard(controller.signal);
        setData(next);
      } catch (error: unknown) {
        if (isRequestCancelled(error) || (error instanceof DOMException && error.name === "AbortError")) return;
        setError(getApiErrorMessage(error, "Failed to load your library dashboard"));
      } finally {
        setLoading(false);
      }
    };

    run();

    return () => controller.abort();
  }, [enabled]);

  return { data, loading, error };
}

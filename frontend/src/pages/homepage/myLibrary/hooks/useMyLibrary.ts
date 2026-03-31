import { useEffect, useState } from "react";
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
      } catch (err: any) {
        if (err.name === "CanceledError" || err.name === "AbortError") return;
        setError(err.response?.data?.message ?? "Failed to load your library dashboard");
      } finally {
        setLoading(false);
      }
    };

    run();

    return () => controller.abort();
  }, [enabled]);

  return { data, loading, error };
}

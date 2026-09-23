import { useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** One patch per interaction preserves unrelated query parameters and router handoffs. */
export function useAdminUrlState() {
  const location = useLocation();
  const navigate = useNavigate();
  const latest = useRef(location);
  latest.current = location;
  const patch = useCallback((values: Record<string, string | number | boolean | null>, replace = false) => {
    const current = latest.current;
    const params = new URLSearchParams(current.search);
    Object.entries(values).forEach(([key, value]) => {
      if (value === null || value === "") params.delete(key);
      else params.set(key, String(value));
    });
    const search = params.toString() ? `?${params}` : "";
    latest.current = { ...current, search };
    navigate({ pathname: current.pathname, search }, { replace, state: current.state });
  }, [navigate]);
  return [new URLSearchParams(location.search), patch] as const;
}
export const queryPage = (value: string | null) => Math.max(1, Math.floor(Number(value) || 1));

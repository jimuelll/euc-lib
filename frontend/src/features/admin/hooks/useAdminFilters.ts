import { useMemo, useRef } from "react";
import { useAdminUrlState, queryPage } from "./useAdminUrlState";

/** Keep applied filters separate from editor drafts and from neighboring tab filters. */
export function useAdminFilters<T extends object>(key: string, defaults: T) {
  const [params, patch] = useAdminUrlState();
  const initial = useRef(defaults);
  const raw = params.get(key);
  const applied = useMemo(() => {
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return initial.current;
      const safe = Object.fromEntries(Object.entries(parsed).filter(([name, value]) => name !== "__proto__" && name !== "constructor" && (typeof value === "string" || typeof value === "number")));
      return { ...initial.current, ...safe } as T;
    } catch { return initial.current; }
  }, [raw]);
  return { applied, setApplied: (filters: T) => patch({ [key]: JSON.stringify(filters), [`${key}Page`]: null }), page: queryPage(params.get(`${key}Page`)), setPage: (page: number) => patch({ [`${key}Page`]: page }) };
}

import { useCallback, useEffect, useState } from "react";
import { useAdminUrlState } from "./useAdminUrlState";

/**
 * Keeps an open record drawer addressable: the id lives in the URL so Back, refresh and shared links reopen it,
 * while the record itself stays in state so the drawer survives the row leaving the current filter or page.
 */
export function useDrawerRecord<T>(rows: T[], getId: (row: T) => string | number, param = "record") {
  const [params, patch] = useAdminUrlState();
  const [record, setRecord] = useState<T | null>(null);
  const requested = params.get(param);

  useEffect(() => {
    if (!requested) { setRecord(null); return; }
    setRecord(current => {
      if (current && String(getId(current)) === requested) return current;
      return rows.find(row => String(getId(row)) === requested) ?? null;
    });
  }, [requested, rows, getId]);

  const open = useCallback((row: T) => { setRecord(row); patch({ [param]: String(getId(row)) }); }, [patch, param, getId]);
  const close = useCallback(() => { setRecord(null); patch({ [param]: null }); }, [patch, param]);
  return [record, open, close] as const;
}

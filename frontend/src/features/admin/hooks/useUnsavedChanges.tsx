import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminConfirmDialog } from "../components/useAdminConfirmDialog";

export function useUnsavedChanges(value: unknown, open: boolean, identity: string | number = "draft") {
  const serialized = JSON.stringify(value);
  const current = useRef(serialized);
  current.current = serialized;
  const [baseline, setBaseline] = useState(serialized);
  const { confirm, confirmDialog } = useAdminConfirmDialog();
  const navigate = useNavigate();
  useEffect(() => { setBaseline(current.current); }, [open, identity]);
  const dirty = open && baseline !== serialized;
  const confirmDiscard = useCallback(async () => !dirty || await confirm({
    title: "Discard unsaved changes?", description: "Your changes have not been saved. Keep editing to preserve them.",
    actionLabel: "Discard changes", cancelLabel: "Keep editing", tone: "danger",
  }), [dirty, confirm]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const link = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const url = new URL(anchor.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      event.preventDefault(); event.stopPropagation();
      void confirmDiscard().then(discard => { if (discard) navigate(url.pathname + url.search + url.hash); });
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", link, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", link, true); };
  }, [dirty, confirmDiscard, navigate]);
  return { dirty, confirmDiscard, discardDialog: confirmDialog, markSaved: () => setBaseline(current.current) };
}

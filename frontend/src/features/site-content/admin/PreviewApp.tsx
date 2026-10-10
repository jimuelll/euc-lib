import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { ThemeProvider } from "@/hooks/use-theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AppRoutes } from "@/app/routes";
import { previewPaths, type PreviewSnapshot } from "./preview-data";
import { setPreviewSnapshot } from "./preview-runtime.service";

const noAction = async () => {};

export default function PreviewApp() {
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== "content-preview-data") return;
      const next: PreviewSnapshot = event.data.snapshot;
      setPreviewSnapshot(next);
      client.clear();
      setSnapshot(next);
    };
    window.addEventListener("message", receive);
    // Keep navigation inside this preview; links must not load a normal, editable app.
    const keepPreview = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a");
      if (link && !link.getAttribute("href")?.startsWith("#")) event.preventDefault();
    };
    document.addEventListener("click", keepPreview, true);
    window.parent.postMessage({ type: "content-preview-ready" }, window.location.origin);
    return () => { window.removeEventListener("message", receive); document.removeEventListener("click", keepPreview, true); };
  }, [client]);
  if (!snapshot) return <p role="status">Loading draft…</p>;
  const user = snapshot.user && { ...snapshot.user, ...(snapshot.section === "guide" ? { role: snapshot.role } : {}) };
  return <QueryClientProvider client={client}><ThemeProvider><TooltipProvider>
    <MemoryRouter key={`${snapshot.section}-${snapshot.role}`} initialEntries={[previewPaths[snapshot.section]]}>
      <AuthContext.Provider value={{ user, isLoggedIn: Boolean(user), loading: false, mustChangePassword: false,
        login: noAction, logout: noAction, changePassword: noAction, getToken: () => null }}>
        <NotificationsProvider><AppRoutes /><Sonner /></NotificationsProvider>
      </AuthContext.Provider>
    </MemoryRouter>
  </TooltipProvider></ThemeProvider></QueryClientProvider>;
}

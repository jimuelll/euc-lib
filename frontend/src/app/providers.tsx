import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import PasswordChangeGate from "@/features/auth/components/PasswordChangeGate";
import TermRevalidationNotice from "@/features/auth/components/TermRevalidationNotice";
import SiteVisitTracker from "@/features/analytics/components/SiteVisitTracker";
import ScrollToTop from "@/components/layout/ScrollToTop";
import { AppRoutes } from "./routes";
import { loadAcademicSubscriptions, loadAdminCatalog, loadAdminContentManagement, loadAdminHome, loadAdminLayout, loadAdminManage, loadLibraryServices, loadStudentDashboard } from "./route-loaders";

const queryClient = new QueryClient();

function RoutePrefetcher() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading || !user) return;
    const preload = () => {
      if (["admin", "super_admin", "staff"].includes(user.role)) {
        void Promise.all([loadAdminLayout(), loadAdminHome(), loadAdminManage(), loadAdminCatalog(), loadAdminContentManagement()]);
      } else {
        void Promise.all([loadLibraryServices(), loadAcademicSubscriptions(), loadStudentDashboard()]);
      }
    };
    const timer = window.setTimeout(preload, 1200);
    return () => window.clearTimeout(timer);
  }, [loading, user]);
  return null;
}

export default function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <AuthProvider>
              <NotificationsProvider>
                <RoutePrefetcher />
                <PasswordChangeGate />
                <TermRevalidationNotice />
                <SiteVisitTracker />
                <AppRoutes />
              </NotificationsProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

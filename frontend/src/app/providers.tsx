import { isOperationsRole } from "@/utils/operationsAccess";
import { useEffect } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { queryClient } from "./query-client";
import { LibraryDesignProvider } from "@/components/ui/library-design";

function RoutePrefetcher() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading || !user || isOperationsRole(user.role)) return;
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

function EmailVerificationNotice() {
 const {user}=useAuth();
 const {pathname}=useLocation();
 if(pathname === "/admin" || pathname.startsWith("/admin/"))return null;
 if(!user || isOperationsRole(user.role) || user.email_verified !== false || user.must_change_password)return null;
 return <div data-library-design className="border-b bg-background px-4 py-2 text-foreground text-sm" role="status">Verify your email to receive library notices and recover your password. <a className="text-action underline" href="/edit-profile">Manage account email</a></div>;
}

export default function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <LibraryDesignProvider><div data-library-design><Sonner /></div></LibraryDesignProvider>
          <BrowserRouter>
            <ScrollToTop />
            <AuthProvider>
              <NotificationsProvider>
                <RoutePrefetcher />
                <LibraryDesignProvider><PasswordChangeGate /><TermRevalidationNotice /></LibraryDesignProvider>
                <EmailVerificationNotice />
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

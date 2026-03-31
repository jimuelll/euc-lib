import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import ProtectedRoute from "@/components/ProtectedRoute";
import PasswordChangeGate from "@/components/auth/PasswordChangeGate";
import SiteVisitTracker from "@/components/analytics/SiteVisitTracker";
import ScrollToTop from "@/components/ScrollToTop";
import { AuthProvider } from "./context/AuthContext";
import { NotificationsProvider } from "./context/NotificationsContext";

import Index from "./pages/homepage/Index";
import About from "./pages/homepage/about/index";
import Services from "./pages/homepage/Services";
import Catalogue from "./pages/homepage/Catalogue";
import Bulletin from "./pages/homepage/bulletin/index";
import Login from "./pages/homepage/Login";
import ChangePassword from "./pages/homepage/ChangePassword";
import NotFound from "./pages/homepage/NotFound";

const LibraryServices = lazy(() => import("./pages/homepage/LibraryServices"));
const AcademicSubscriptions = lazy(() => import("./pages/homepage/academicSubscriptions/AcademicSubscriptions"));
const StudentDashboard = lazy(() => import("./pages/homepage/myLibrary"));
const EditProfile = lazy(() => import("./pages/homepage/EditProfile"));
const ScanQR = lazy(() => import("./pages/homepage/scanqr/index"));

const AdminLayout = lazy(() => import("./pages/admin/adminLayout/Index"));
const AdminHome = lazy(() => import("./pages/admin/AdminHome"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminManage = lazy(() => import("./pages/admin/adminManage/Index"));
const AdminCatalog = lazy(() => import("./pages/admin/adminCatalog/Index"));
const AdminCirculation = lazy(() => import("./pages/admin/adminCirculation/Index"));
const AdminReservations = lazy(() => import("./pages/admin/adminReservations/AdminReservations"));
const AdminPayment = lazy(() => import("./pages/admin/AdminPayment"));
const AdminBackup = lazy(() => import("./pages/admin/AdminBackup"));
const AdminReport = lazy(() => import("./pages/admin/AdminReport"));
const AdminInternet = lazy(() => import("./pages/admin/AdminInternet"));
const AdminClearance = lazy(() => import("./pages/admin/AdminClearance"));
const AdminEditAbout = lazy(() => import("./pages/admin/adminAbout/Index"));
const AdminAttendanceLogs = lazy(() => import("./pages/admin/adminAttendanceLogs/Index"));
const AdminSubscriptions = lazy(() => import("./pages/admin/adminSubscriptions/index"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminHolidays = lazy(() => import("./pages/admin/AdminHolidays"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminBulletin = lazy(() => import("./pages/admin/AdminBulletin"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
    Loading...
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
            <NotificationsProvider>
              <PasswordChangeGate />
              <SiteVisitTracker />
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/services" element={<Services />} />
                  <Route path="/services/borrowing" element={<LibraryServices />} />
                  <Route path="/services/subscriptions" element={<AcademicSubscriptions />} />
                  <Route path="/catalogue" element={<Catalogue />} />
                  <Route path="/bulletin" element={<Bulletin />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/scan-qr" element={<ScanQR />} />
                  <Route path="/change-password" element={<ChangePassword />} />

                  <Route
                    path="/my-library"
                    element={
                      <ProtectedRoute>
                        <StudentDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/edit-profile"
                    element={
                      <ProtectedRoute>
                        <EditProfile />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute roles={["admin", "super_admin", "staff"]}>
                        <AdminLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<AdminHome />} />
                    <Route
                      path="analytics"
                      element={
                        <ProtectedRoute roles={["admin", "super_admin"]}>
                          <AdminAnalytics />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="manage" element={<AdminManage />} />
                    <Route path="catalog" element={<AdminCatalog />} />
                    <Route path="circulation" element={<AdminCirculation />} />
                    <Route
                      path="payment"
                      element={
                        <ProtectedRoute roles={["admin", "super_admin"]}>
                          <AdminPayment />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="backup" element={<AdminBackup />} />
                    <Route
                      path="report"
                      element={
                        <ProtectedRoute roles={["admin", "super_admin"]}>
                          <AdminReport />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="audit-logs"
                      element={
                        <ProtectedRoute roles={["super_admin"]}>
                          <AdminAuditLogs />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="internet" element={<AdminInternet />} />
                    <Route path="clearance" element={<AdminClearance />} />
                    <Route path="reservations" element={<AdminReservations />} />
                    <Route path="holidays" element={<AdminHolidays />} />
                    <Route path="restrictions" element={<AdminManage />} />
                    <Route
                      path="bulletin"
                      element={
                        <ProtectedRoute roles={["admin", "super_admin"]}>
                          <AdminBulletin />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="subscriptions"
                      element={
                        <ProtectedRoute roles={["admin", "super_admin"]}>
                          <AdminSubscriptions />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="notifications"
                      element={
                        <ProtectedRoute roles={["admin", "super_admin"]}>
                          <AdminNotifications />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="attendance-logs"
                      element={
                        <ProtectedRoute roles={["admin", "super_admin"]}>
                          <AdminAttendanceLogs />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="edit-about"
                      element={
                        <ProtectedRoute roles={["admin", "super_admin"]}>
                          <AdminEditAbout />
                        </ProtectedRoute>
                      }
                    />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </NotificationsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

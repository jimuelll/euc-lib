import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { RoleProvider } from "@/hooks/use-role";
import ProtectedRoute from "@/components/ProtectedRoute";
import ScrollToTop from "@/components/ScrollToTop";
import { AuthProvider } from "./context/AuthContext";

// ─── Public pages ─────────────────────────────────────────────────────────────
import Index               from "./pages/homepage/Index";
import About               from "./pages/homepage/about/index";
import Services            from "./pages/homepage/Services";
import Catalogue           from "./pages/homepage/Catalogue";
import Bulletin            from "./pages/homepage/bulletin/index";
import Login               from "./pages/homepage/Login";
import ChangePassword      from "./pages/homepage/ChangePassword";
import NotFound            from "./pages/homepage/NotFound";
import LibraryServices     from "./pages/homepage/LibraryServices";
import AcademicSubscriptions from "./pages/homepage/AcademicSubscriptions";
import StudentDashboard    from "./pages/homepage/StudentDashboard";
import EditProfile         from "./pages/homepage/EditProfile";
import ScanQR              from "./pages/homepage/scanqr/index";


// ─── Admin pages ──────────────────────────────────────────────────────────────
import AdminLayout         from "./pages/admin/adminLayout/Index";
import AdminHome           from "./pages/admin/AdminHome";
import AdminManage         from "./pages/admin/adminManage/Index";
import AdminCatalog        from "./pages/admin/adminCatalog/Index";
import AdminCirculation    from "./pages/admin/adminCirculation/Index";
import AdminReservations   from "./pages/admin/adminReservations/AdminReservations";
import AdminPayment        from "./pages/admin/AdminPayment";
import AdminBackup         from "./pages/admin/AdminBackup";
import AdminReport         from "./pages/admin/AdminReport";
import AdminQuery          from "./pages/admin/AdminQuery";
import AdminInternet       from "./pages/admin/AdminInternet";
import AdminClearance      from "./pages/admin/AdminClearance";
import AdminEditAbout      from "./pages/admin/adminAbout/Index";
import AdminAttendanceLogs from "./pages/admin/adminAttendanceLogs/Index";

// ─────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <RoleProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <AuthProvider>
              <Routes>

                {/* ── Public ── */}
                <Route path="/"                        element={<Index />} />
                <Route path="/about"                   element={<About />} />
                <Route path="/services"                element={<Services />} />
                <Route path="/services/borrowing"      element={<LibraryServices />} />
                <Route path="/services/subscriptions"  element={<AcademicSubscriptions />} />
                <Route path="/catalogue"               element={<Catalogue />} />
                <Route path="/bulletin"                element={<Bulletin />} />
                <Route path="/login"                   element={<Login />} />
                <Route path="/scan-qr"                 element={<ScanQR />} />
                <Route path="/change-password"         element={<ChangePassword />} />

                {/* ── Student ── */}
                <Route path="/my-library" element={
                  <ProtectedRoute>
                    <StudentDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/edit-profile" element={
                  <ProtectedRoute>
                    <EditProfile />
                  </ProtectedRoute>
                } />

                {/* ── Admin panel ── */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute roles={["admin", "super_admin", "staff"]}>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index                   element={<AdminHome />} />
                  <Route path="manage"           element={<AdminManage />} />
                  <Route path="catalog"          element={<AdminCatalog />} />
                  <Route path="circulation"      element={<AdminCirculation />} />
                  <Route path="payment"          element={<AdminPayment />} />
                  <Route path="backup"           element={<AdminBackup />} />
                  <Route path="report"           element={<AdminReport />} />
                  <Route path="query"            element={<AdminQuery />} />
                  <Route path="internet"         element={<AdminInternet />} />
                  <Route path="clearance"        element={<AdminClearance />} />
                  <Route path="reservations"     element={<AdminReservations />} />
                  <Route path="holidays"         element={<AdminManage />} />
                  <Route path="restrictions"     element={<AdminManage />} />
                  <Route path="bulletin"         element={<AdminEditAbout />} />
                  <Route path="subscriptions"    element={<AdminEditAbout />} />
                  <Route path="attendance-logs"  element={<AdminAttendanceLogs />} />
                  <Route path="edit-about" element={
                    <ProtectedRoute roles={["admin", "super_admin"]}>
                      <AdminEditAbout />
                    </ProtectedRoute>
                  } />
                </Route>

                <Route path="*" element={<NotFound />} />

              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </RoleProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
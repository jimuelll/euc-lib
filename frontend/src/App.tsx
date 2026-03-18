// App.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { RoleProvider } from "@/hooks/use-role";
import ProtectedRoute from "@/components/ProtectedRoute";
import ScrollToTop from "@/components/ScrollToTop";

// Pages
import Index from "./pages/public/Index.tsx";
import About from "./pages/public/About.tsx";
import Services from "./pages/public/Services.tsx";
import Catalogue from "./pages/public/Catalogue.tsx";
import Bulletin from "./pages/public/Bulletin.tsx";
import Login from "./pages/public/Login.tsx";
import ChangePassword from "./pages/public/ChangePassword.tsx";
import ScanQR from "./pages/public/ScanQR.tsx";
import NotFound from "./pages/public/NotFound.tsx";
import BorrowingReturning from "./pages/public/BorrowingReturning.tsx";
import DigitalReservation from "./pages/public/DigitalReservation.tsx";
import AcademicSubscriptions from "./pages/public/AcademicSubscriptions.tsx";
import StudentDashboard from "./pages/public/StudentDashboard.tsx";
import EditProfile from "./pages/public/EditProfile.tsx";

// Admin Pages
import AdminLayout from "./pages/admin/AdminLayout.tsx";
import AdminHome from "./pages/admin/AdminHome.tsx";
import AdminManage from "./pages/admin/AdminManage.tsx";
import AdminCatalog from "./pages/admin/AdminCatalog.tsx";
import AdminCirculation from "./pages/admin/AdminCirculation.tsx";
import AdminPayment from "./pages/admin/AdminPayment.tsx";
import AdminBackup from "./pages/admin/AdminBackup.tsx";
import AdminReport from "./pages/admin/AdminReport.tsx";
import AdminQuery from "./pages/admin/AdminQuery.tsx";
import AdminInternet from "./pages/admin/AdminInternet.tsx";
import AdminClearance from "./pages/admin/AdminClearance.tsx";
import AdminEditHomepage from "./pages/admin/AdminEditHomepage.tsx";

// Context
import { AuthProvider } from "./context/AuthContext";

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
                {/* Public Routes (Guest Access) */}
                <Route path="/" element={<Index />} />
                <Route path="/about" element={<About />} />
                <Route path="/services" element={<Services />} />
                <Route path="/services/borrowing" element={<BorrowingReturning />} />
                <Route path="/services/reservation" element={<DigitalReservation />} />
                <Route path="/services/subscriptions" element={<AcademicSubscriptions />} />
                <Route path="/catalogue" element={<Catalogue />} />
                <Route path="/bulletin" element={<Bulletin />} />
                <Route path="/login" element={<Login />} />

                {/* Routes requiring authentication */}
                {/* Force password change page */}
                <Route path="/change-password" element={<ChangePassword />} />

                {/* Student routes */}
                <Route path="/my-library" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
                <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />

                {/* Admin Panel */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute roles={["admin", "super_admin"]}>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminHome />} />
                  <Route path="manage" element={<AdminManage />} />
                  <Route path="catalog" element={<AdminCatalog />} />
                  <Route path="circulation" element={<AdminCirculation />} />
                  <Route path="payment" element={<AdminPayment />} />
                  <Route path="backup" element={<AdminBackup />} />
                  <Route path="report" element={<AdminReport />} />
                  <Route path="query" element={<AdminQuery />} />
                  <Route path="internet" element={<AdminInternet />} />
                  <Route path="clearance" element={<AdminClearance />} />
                  <Route path="edit-homepage" element={<AdminEditHomepage />} />
                  {/* Placeholder for future admin sidebar items */}
                  <Route path="reservations" element={<AdminHome />} />
                  <Route path="holidays" element={<AdminManage />} />
                  <Route path="restrictions" element={<AdminManage />} />
                  <Route path="bulletin" element={<AdminEditHomepage />} />
                  <Route path="subscriptions" element={<AdminEditHomepage />} />
                  <Route path="attendance" element={<AdminReport />} />
                </Route>

                {/* Fallback */}
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
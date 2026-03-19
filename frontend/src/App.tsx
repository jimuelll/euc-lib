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
import Index from "./pages/public/Index";
import About from "./pages/public/About";
import Services from "./pages/public/Services";
import Catalogue from "./pages/public/Catalogue";
import Bulletin from "./pages/public/Bulletin";
import Login from "./pages/public/Login";
import ChangePassword from "./pages/public/ChangePassword";
import ScanQR from "./pages/public/ScanQR";
import NotFound from "./pages/public/NotFound";
import BorrowingReturning from "./pages/public/BorrowingReturning";
import DigitalReservation from "./pages/public/DigitalReservation";
import AcademicSubscriptions from "./pages/public/AcademicSubscriptions";
import StudentDashboard from "./pages/public/StudentDashboard";
import EditProfile from "./pages/public/EditProfile";

// Admin Pages
import AdminLayout from "./pages/admin/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";
import AdminManage from "./pages/admin/AdminManage";
import AdminCatalog from "./pages/admin/AdminCatalog";
import AdminCirculation from "./pages/admin/AdminCirculation";
import AdminPayment from "./pages/admin/AdminPayment";
import AdminBackup from "./pages/admin/AdminBackup";
import AdminReport from "./pages/admin/AdminReport";
import AdminQuery from "./pages/admin/AdminQuery";
import AdminInternet from "./pages/admin/AdminInternet";
import AdminClearance from "./pages/admin/AdminClearance";
import AdminEditHomepage from "./pages/admin/AdminEditHomepage";

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
                {/* Public routes — no auth needed */}
                <Route path="/" element={<Index />} />
                <Route path="/about" element={<About />} />
                <Route path="/services" element={<Services />} />
                <Route path="/services/borrowing" element={<BorrowingReturning />} />
                <Route path="/services/reservation" element={<DigitalReservation />} />
                <Route path="/services/subscriptions" element={<AcademicSubscriptions />} />
                <Route path="/catalogue" element={<Catalogue />} />
                <Route path="/bulletin" element={<Bulletin />} />
                <Route path="/login" element={<Login />} />

                {/* Change password — needs auth but NOT the password-change guard
                    ProtectedRoute would loop if we put must_change_password check here */}
                <Route
                  path="/change-password"
                  element={<ChangePassword />}
                />

                {/* Student routes */}
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

                {/* Admin panel */}
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
                  <Route path="reservations" element={<AdminHome />} />
                  <Route path="holidays" element={<AdminManage />} />
                  <Route path="restrictions" element={<AdminManage />} />
                  <Route path="bulletin" element={<AdminEditHomepage />} />
                  <Route path="subscriptions" element={<AdminEditHomepage />} />
                  <Route path="attendance" element={<AdminReport />} />
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
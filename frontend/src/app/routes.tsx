import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import Home from "@/features/home/pages/Index";
import About from "@/features/about";
import Services from "@/features/home/pages/Services";
import Catalogue from "@/features/catalog/pages/Catalogue";
import Bulletin from "@/features/bulletin";
import Login from "@/features/auth/pages/Login";
import ChangePassword from "@/features/auth/pages/ChangePassword";
import NotFound from "@/pages/NotFound";
import { loadAcademicSubscriptions, loadAdminCatalog, loadAdminContentManagement, loadAdminHome, loadAdminLayout, loadAdminManage, loadLibraryServices, loadStudentDashboard } from "./route-loaders";

const LibraryServices = lazy(loadLibraryServices);
const AcademicSubscriptions = lazy(loadAcademicSubscriptions);
const StudentDashboard = lazy(loadStudentDashboard);
const EditProfile = lazy(() => import("@/features/auth/pages/EditProfile"));
const ScanQR = lazy(() => import("@/features/scan-qr"));

const AdminLayout = lazy(loadAdminLayout);
const AdminHome = lazy(loadAdminHome);
const AdminAnalytics = lazy(() => import("@/features/analytics/admin/pages/AdminAnalytics"));
const AdminManage = lazy(loadAdminManage);
const AdminCatalog = lazy(loadAdminCatalog);
const AdminCirculation = lazy(() => import("@/features/circulation/admin/Index"));
const AdminReservations = lazy(() => import("@/features/reservations/admin/AdminReservations"));
const AdminBackup = lazy(() => import("@/features/backup/admin/AdminBackup"));
const AdminReport = lazy(() => import("@/features/analytics/admin/pages/AdminReport"));
const QueryPreview = lazy(() => import("@/features/query/QueryPreview"));
const AdminClearance = lazy(() => import("@/features/clearance/admin/AdminClearance"));
const AdminClearanceReceipt = lazy(() => import("@/features/clearance/admin/AdminClearanceReceipt"));
const AdminAttendanceLogs = lazy(() => import("@/features/attendance/admin/Index"));
const AdminNotifications = lazy(() => import("@/features/notifications/admin/AdminNotifications"));
const AdminHolidays = lazy(() => import("@/features/library-settings/admin/AdminHolidays"));
const AdminAuditLogs = lazy(() => import("@/features/analytics/admin/pages/AdminAuditLogs"));
const AdminBookTypes = lazy(() => import("@/features/catalog/admin/AdminBookTypes"));
const AdminContentManagement = lazy(loadAdminContentManagement);
const AdminUserGuide = lazy(() => import("@/features/user-guide/admin/AdminUserGuide"));

const RouteFallback = () => (
  <div className="fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-primary/15" aria-label="Loading page" aria-busy="true">
    <div className="h-full w-1/3 bg-warning animate-[route-progress_1.15s_ease-in-out_infinite]" />
  </div>
);

export const AppRoutes = () => (
  <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/services" element={<Services />} />
      <Route path="/services/borrowing" element={<ProtectedRoute><LibraryServices /></ProtectedRoute>} />
      <Route path="/services/subscriptions" element={<AcademicSubscriptions />} />
      <Route path="/catalogue" element={<Catalogue />} />
      <Route path="/bulletin" element={<Bulletin />} />
      <Route path="/login" element={<Login />} />
      <Route path="/scan-qr" element={<ScanQR />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/my-library" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
      <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
      <Route path="/admin/query/preview" element={<ProtectedRoute roles={["admin", "super_admin"]}><QueryPreview /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute roles={["admin", "super_admin", "staff"]}><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminHome />} />
        <Route path="analytics" element={<ProtectedRoute roles={["admin", "super_admin"]}><AdminAnalytics /></ProtectedRoute>} />
        <Route path="manage" element={<AdminManage />} />
        <Route path="catalog" element={<AdminCatalog />} />
        <Route path="book-types" element={<ProtectedRoute roles={["super_admin"]}><AdminBookTypes /></ProtectedRoute>} />
        <Route path="circulation" element={<AdminCirculation />} />
        <Route path="payment" element={<Navigate to="/admin/clearance" replace />} />
        <Route path="backup" element={<ProtectedRoute roles={["super_admin"]}><AdminBackup /></ProtectedRoute>} />
        <Route path="query" element={<ProtectedRoute roles={["admin", "super_admin"]}><AdminReport /></ProtectedRoute>} />
        <Route path="report" element={<Navigate to="/admin/query" replace />} />
        <Route path="audit-logs" element={<ProtectedRoute roles={["super_admin"]}><AdminAuditLogs /></ProtectedRoute>} />
        <Route path="clearance" element={<AdminClearance />} />
        <Route path="clearance/receipt/:receiptNumber" element={<AdminClearanceReceipt />} />
        <Route path="reservations" element={<AdminReservations />} />
        <Route path="holidays" element={<AdminHolidays />} />
        <Route path="restrictions" element={<AdminManage />} />
        <Route path="content" element={<ProtectedRoute roles={["admin", "super_admin"]}><AdminContentManagement /></ProtectedRoute>} />
        <Route path="user-guide" element={<AdminUserGuide />} />
        <Route path="bulletin" element={<Navigate to="/admin/content?tab=bulletin" replace />} />
        <Route path="subscriptions" element={<Navigate to="/admin/content?tab=subscriptions" replace />} />
        <Route path="notifications" element={<ProtectedRoute roles={["admin", "super_admin"]}><AdminNotifications /></ProtectedRoute>} />
        <Route path="attendance-logs" element={<ProtectedRoute roles={["admin", "super_admin"]}><AdminAttendanceLogs /></ProtectedRoute>} />
        <Route path="edit-about" element={<Navigate to="/admin/content?tab=about" replace />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

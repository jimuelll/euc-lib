export const loadLibraryServices = () => import("@/features/borrowing");
export const loadAcademicSubscriptions = () => import("@/features/subscriptions/AcademicSubscriptions");
export const loadStudentDashboard = () => import("@/features/my-library");
export const loadAdminLayout = () => import("@/features/admin/layout/Index");
export const loadAdminHome = () => import("@/features/admin/pages/AdminHome");
export const loadAdminManage = () => import("@/features/admin/manage/Index");
export const loadAdminCatalog = () => import("@/features/catalog/admin/Index");
export const loadAdminContentManagement = () => import("@/features/site-content/admin/AdminContentManagement");

import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar, AdminTopbar } from "./components/AdminLayoutComponents";

const AdminLayoutBuilder = () => {
  const { pathname } = useLocation();

  return (
    <SidebarProvider>
      <div className="admin-shell-backdrop flex h-dvh w-full overflow-hidden bg-background">
        <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-card focus:p-3">Skip to main content</a>
        <AdminSidebar />

        <div className="relative flex min-w-0 flex-1 flex-col">
          <AdminTopbar pathname={pathname} />

          <main id="admin-main" tabIndex={-1} className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-7">
            <div className="mx-auto w-full max-w-[1560px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayoutBuilder;

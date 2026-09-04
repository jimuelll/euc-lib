import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar, AdminTopbar } from "./components/AdminLayoutComponents";

const AdminLayoutBuilder = () => {
  const { pathname } = useLocation();

  return (
    <SidebarProvider>
      <div className="admin-shell-backdrop flex h-dvh w-full overflow-hidden bg-background">
        <AdminSidebar />

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.18),transparent_18rem)]" />
          <AdminTopbar pathname={pathname} />

          <main className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-7">
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

import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar, AdminTopbar } from "./components/AdminLayoutComponents";

const AdminLayoutBuilder = () => {
  const { pathname } = useLocation();

  return (
    <SidebarProvider>
      <div className="admin-shell-backdrop min-h-screen flex w-full bg-background">
        <AdminSidebar />

        <div className="relative flex-1 flex min-w-0 flex-col">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.18),transparent_18rem)]" />
          <AdminTopbar pathname={pathname} />

          <main className="relative flex-1 overflow-x-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
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

import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar, AdminTopbar } from "./components/AdminLayoutComponents";

const AdminLayoutBuilder = () => {
  const { pathname } = useLocation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/20">
        <AdminSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <AdminTopbar pathname={pathname} />

          <main className="flex-1 overflow-x-auto px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayoutBuilder;

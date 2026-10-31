import { LibraryDesignProvider } from "@/components/ui/library-design";
import type { CSSProperties } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar, AdminTopbar } from "./components/AdminLayoutComponents";
import "../admin-theme.css";
import "../admin-workspaces.css";

const AdminLayoutBuilder = () => {
  const { pathname } = useLocation();

  return (
    <SidebarProvider className="h-dvh min-h-0" style={{ "--sidebar-width": "15rem", "--sidebar-width-icon": "4rem" } as CSSProperties}>
      <div className="admin-shell-backdrop flex h-dvh w-full overflow-hidden bg-background">
        <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-card focus:p-3">Skip to main content</a>
        <LibraryDesignProvider enabled={false}><AdminSidebar /></LibraryDesignProvider>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <LibraryDesignProvider><AdminTopbar pathname={pathname} /></LibraryDesignProvider>

          <main data-library-design id="admin-main" tabIndex={-1} className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-5">
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

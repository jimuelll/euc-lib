import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import "../admin-theme.css";

// The body scope also reaches Radix portals and standalone print previews.
export function useAdminTheme() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const accountPage = ["/edit-profile", "/change-password"].includes(pathname);
  const active = pathname === "/admin" || pathname.startsWith("/admin/") || (accountPage && ["admin", "super_admin", "staff"].includes(user?.role ?? ""));
  useLayoutEffect(() => {
    document.body.classList.toggle("admin-workspace", active);
    return () => document.body.classList.remove("admin-workspace");
  }, [active]);
}

import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { MoreHorizontal, UserRound, KeyRound, X } from "lucide-react";
import { Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { dashboardItem, visibleSidebarSections, resolveCurrentItem, getInitials } from "../AdminLayoutData";
import type { SidebarItem } from "../AdminLayout.types";
import { AdminSidebarIcon, adminSidebarIconByUrl } from "./AdminSidebarIcon";

export function AdminSidebar() {
  const { state, isMobile, openMobile, setOpenMobile } = useSidebar();
  const wasOpenMobile = useRef(false);
  useEffect(() => {
    const restoreFocus = wasOpenMobile.current && !openMobile && isMobile;
    wasOpenMobile.current = openMobile;
    if (!restoreFocus) return;
    // The shared sidebar toggle is outside Radix's SheetTrigger context.
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('[data-sidebar="trigger"]')?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [openMobile, isMobile]);
  const compact = state === "collapsed" && !isMobile;
  const { pathname, search } = useLocation();
  const { user, logout } = useAuth();
  const current = resolveCurrentItem(pathname, search, user?.role);
  const name = user?.name || "Administrator";
  const close = () => setOpenMobile(false);
  const renderItem = (item: SidebarItem) => <SidebarMenuItem key={item.url}>
    <SidebarMenuButton asChild tooltip={item.title} isActive={current?.url === item.url} className="admin-nav-link">
      <Link to={item.url} aria-label={item.title} aria-current={current?.url === item.url ? "page" : undefined} onClick={close}>
        <AdminSidebarIcon name={adminSidebarIconByUrl[item.url]} /><span className="admin-nav-label">{item.title}</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>;

  return <Sidebar collapsible="icon" className="border-r-0">
    <div className="admin-sidebar-design" data-compact={compact} data-mobile={isMobile}>
      {isMobile && <><DialogTitle className="sr-only">Administration navigation</DialogTitle><DialogDescription className="sr-only">Browse library administration tools.</DialogDescription></>}
      <SidebarHeader className="admin-brand">
        <Link to="/admin" onClick={close} aria-label="EUC Library dashboard" className="admin-brand-link">
          <img src="/aa1.ico" alt="" width={36} height={36} />
          {!compact && <span className="admin-brand-copy"><strong>EUC LIBRARY</strong><span>Library administration</span></span>}
        </Link>
        {isMobile && <button type="button" className="admin-nav-close" aria-label="Close navigation" onClick={close}><X size={20} /></button>}
      </SidebarHeader>
      <SidebarContent className="admin-nav-scroll">
        <nav aria-label="Administration">
          <SidebarMenu>{renderItem(dashboardItem)}</SidebarMenu>
          {visibleSidebarSections(user?.role).map((section, index) => <section key={section.label} className="admin-nav-section" aria-labelledby={`admin-section-${index}`}>
            <h2 id={`admin-section-${index}`} className={compact ? "sr-only" : "admin-nav-heading"}>{section.label}</h2>
            <SidebarMenu>{section.items.map(renderItem)}</SidebarMenu>
          </section>)}
        </nav>
      </SidebarContent>
      <SidebarFooter className="admin-account-footer">
        <DropdownMenu>
          <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild>
            <button type="button" className="admin-account-trigger" aria-label={`Account menu for ${name}`}>
              <span className="admin-account-initials">{getInitials(user?.name)}</span>
              {!compact && <><span className="admin-account-copy"><span className="admin-account-name">{name}</span><span className="admin-account-role">{user?.role?.replace(/_/g, " ")}</span></span><MoreHorizontal size={16} aria-hidden="true" /></>}
            </button>
          </DropdownMenuTrigger></TooltipTrigger><TooltipContent side={isMobile ? "top" : "right"}>{name}</TooltipContent></Tooltip>
          <DropdownMenuContent side={isMobile ? "top" : "right"} align="end">
            <DropdownMenuLabel>My account</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link to="/edit-profile" onClick={close}><UserRound className="mr-2 size-4" />My account</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/change-password" onClick={close}><KeyRound className="mr-2 size-4" />Change password</Link></DropdownMenuItem>
            <DropdownMenuSeparator /><DropdownMenuItem onSelect={() => void logout()}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="admin-signout-row">
          <Tooltip><TooltipTrigger asChild><button type="button" className="admin-signout" onClick={() => void logout()} aria-label="Sign out"><AdminSidebarIcon name="logout" />{!compact && <span>Sign out</span>}</button></TooltipTrigger><TooltipContent side="right" hidden={!compact}>Sign out</TooltipContent></Tooltip>
        </div>
      </SidebarFooter>
    </div>
  </Sidebar>;
}

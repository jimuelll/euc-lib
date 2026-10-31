import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AdminIcon } from "../../components/AdminIcon";
import { Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {useModerationStats} from "@/features/moderation";
import { useAuth } from "@/context/AuthContext";
import { dashboardItem, helpItem, visibleSidebarSections, resolveCurrentItem, getInitials } from "../AdminLayoutData";
import type { SidebarItem } from "../AdminLayout.types";
import { AdminSidebarIcon, adminSidebarIconByUrl } from "./AdminSidebarIcon";
import { useTheme } from "@/hooks/use-theme";

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
  const { theme, toggleTheme } = useTheme();
  const reviewStats=useModerationStats();
  const navigationRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    const update = () => setMoreBelow(navigation.scrollHeight - navigation.clientHeight - navigation.scrollTop > 2);
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(navigation);
    if (navigation.firstElementChild) observer?.observe(navigation.firstElementChild);
    navigation.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { observer?.disconnect(); navigation.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [compact, isMobile, openMobile, user?.role]);
  const current = resolveCurrentItem(pathname, search, user?.role);
  const name = user?.name || "Administrator";
  const close = () => setOpenMobile(false);
  const renderItem = (item: SidebarItem) => <SidebarMenuItem key={item.url}>
    <SidebarMenuButton asChild tooltip={item.title} isActive={current?.url === item.url} className="admin-nav-link">
      <Link to={item.url} aria-label={item.url==="/admin/moderation"&&reviewStats.data?.pending?`Moderation, ${reviewStats.data.pending} awaiting review`:item.title} aria-current={current?.url === item.url ? "page" : undefined} onClick={close}>
        <AdminSidebarIcon name={adminSidebarIconByUrl[item.url]} /><span className="admin-nav-label">{item.title}</span>{item.url==="/admin/moderation"&&Boolean(reviewStats.data?.pending)&&<span aria-hidden="true" className="admin-moderation-badge" data-urgent={Boolean(reviewStats.data?.urgent)}>{reviewStats.data!.pending>99?"99+":reviewStats.data!.pending}</span>}
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>;

  return <Sidebar collapsible="icon" className="h-dvh border-r-0">
    <div className="admin-sidebar-design" data-compact={compact} data-mobile={isMobile}>
      {isMobile && <><DialogTitle className="sr-only">Administration navigation</DialogTitle><DialogDescription className="sr-only">Browse library administration tools.</DialogDescription></>}
      <SidebarHeader className="admin-brand">
        <Link to="/admin" onClick={close} aria-label="EUC Library dashboard" className="admin-brand-link">
          <img src="/aa1.ico" alt="" width={36} height={36} />
          {!compact && <span className="admin-brand-copy"><strong>EUC LIBRARY</strong><span>Library administration</span></span>}
        </Link>
        {isMobile && <button type="button" className="admin-nav-close" aria-label="Close navigation" onClick={close}><AdminIcon name="close" /></button>}
      </SidebarHeader>
      <div className="admin-nav-region" data-more-below={moreBelow}>
      <SidebarContent ref={navigationRef} className="admin-nav-scroll">
        <nav aria-label="Administration">
          <SidebarMenu>{renderItem(dashboardItem)}</SidebarMenu>
          {visibleSidebarSections(user?.role).map((section, index) => <section key={section.label} className="admin-nav-section" aria-labelledby={`admin-section-${index}`}>
            <h2 id={`admin-section-${index}`} className={compact ? "sr-only" : "admin-nav-heading"}>{section.label}</h2>
            <SidebarMenu>{section.items.map(renderItem)}</SidebarMenu>
          </section>)}
        </nav>
      </SidebarContent>
      </div>
      <SidebarFooter className="admin-account-footer">
        <div className="admin-account-row">
          <DropdownMenu>
            <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild>
              <button type="button" className="admin-account-trigger" aria-label={`Account menu for ${name}`}>
                <span className="admin-account-initials">{getInitials(user?.name)}</span>
                {!compact && <><span className="admin-account-copy"><span className="admin-account-name">{name}</span><span className="admin-account-role">{user?.role?.replace(/_/g, " ")}</span></span><AdminIcon name="chevronDown" className="admin-account-chevron" aria-hidden="true" /></>}
              </button>
            </DropdownMenuTrigger></TooltipTrigger><TooltipContent side={isMobile ? "top" : "right"}>{name}</TooltipContent></Tooltip>
            <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" className="min-w-56">
              <DropdownMenuLabel>{name}</DropdownMenuLabel>
              <DropdownMenuItem asChild><Link to="/edit-profile" onClick={close}><AdminIcon name="account" className="mr-2 size-4" />My account</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/change-password" onClick={close}><AdminIcon name="password" className="mr-2 size-4" />Change password</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to={helpItem.url} onClick={close}><AdminIcon name="help" className="mr-2 size-4" />{helpItem.title}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><a href="/" target="_blank" rel="noreferrer"><AdminIcon name="external" className="mr-2 size-4" />View public website</a></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void logout()}><AdminSidebarIcon name="logout" className="mr-2 size-4" />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {!compact && <Tooltip><TooltipTrigger asChild><button type="button" className="admin-theme-button" onClick={toggleTheme} aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}><AdminIcon name={theme === "dark" ? "sun" : "moon"} /></button></TooltipTrigger><TooltipContent side="top">{theme === "dark" ? "Light theme" : "Dark theme"}</TooltipContent></Tooltip>}
        </div>
      </SidebarFooter>
    </div>
  </Sidebar>;
}

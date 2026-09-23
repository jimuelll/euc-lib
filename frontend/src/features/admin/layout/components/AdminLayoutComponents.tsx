import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Library, ChevronDown, ChevronRight, LogOut, Bell, ExternalLink, Search, UserRound, KeyRound, MoreHorizontal, X } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarHeader, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import { cn } from "@/lib/utils";
import { dashboardItem, helpItem, visibleSidebarSections, resolveCurrentItem, resolveCurrentSection, getInitials } from "../AdminLayoutData";
import type { SidebarItem } from "../AdminLayout.types";

export function AdminSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { pathname, search } = useLocation();
  const { user, logout } = useAuth();
  const current = resolveCurrentItem(pathname, search, user?.role);
  const sections = visibleSidebarSections(user?.role);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("admin-navigation-groups") || "{}"); } catch { return {}; }
  });
  const setGroup = (label: string, open: boolean) => setExpanded(previous => {
    const next = { ...previous, [label]: open };
    try { localStorage.setItem("admin-navigation-groups", JSON.stringify(next)); } catch { /* Storage is optional. */ }
    return next;
  });
  const renderItem = (item: SidebarItem) => <SidebarMenuItem key={item.url}>
    <SidebarMenuButton asChild tooltip={item.title} isActive={current?.url === item.url} className="h-10 text-sm font-medium data-[active=true]:bg-sidebar-accent data-[active=true]:text-white">
      <Link to={item.url} aria-current={current?.url === item.url ? "page" : undefined} onClick={() => setOpenMobile(false)}><item.icon className="size-4" /><span>{item.title}</span></Link>
    </SidebarMenuButton>
  </SidebarMenuItem>;
  return <Sidebar collapsible="icon" className="border-r-0">
    <SidebarHeader className="gap-0 p-3">
      <Link to="/admin" onClick={() => setOpenMobile(false)} className={cn("flex min-h-14 items-center gap-3 rounded-md px-2 text-white", collapsed && "justify-center px-0")} aria-label="EUC Library dashboard">
        <Library className="size-6 shrink-0" />{!collapsed && <div><span className="block text-base font-semibold">EUC Library</span><span className="block text-xs text-white/80">Library administration</span></div>}
      </Link>
      {isMobile && <button type="button" onClick={() => setOpenMobile(false)} className="absolute right-3 top-4 rounded-md p-2 text-white hover:bg-white/10" aria-label="Close navigation"><X className="size-5" /></button>}
    </SidebarHeader>
    <SidebarContent className="gap-0 px-2">
      <SidebarMenu>{renderItem(dashboardItem)}</SidebarMenu>
      {sections.map(section => {
        const active = section.items.some(item => item.url === current?.url);
        return <SidebarGroup key={section.label} className="mt-2 border-t border-white/20 px-0 pb-1 pt-2">
          {collapsed ? <SidebarMenu>{section.items.map(renderItem)}</SidebarMenu> : section.alwaysOpen ? <>
            <p className="px-2 pb-2 pt-2 text-xs font-semibold text-white/85">{section.label}</p>
            <SidebarMenu>{section.items.map(renderItem)}</SidebarMenu>
          </> : <Collapsible open={active || expanded[section.label] === true} onOpenChange={open => setGroup(section.label, open)}>
            <CollapsibleTrigger className="flex min-h-10 w-full items-center justify-between rounded-md px-2 text-xs font-semibold text-white/85 hover:bg-white/10"><span>{section.label}</span><ChevronDown className={cn("size-4 transition-transform", (active || expanded[section.label]) && "rotate-180")} /></CollapsibleTrigger>
            <CollapsibleContent><SidebarMenu>{section.items.map(renderItem)}</SidebarMenu></CollapsibleContent>
          </Collapsible>}
        </SidebarGroup>;
      })}
    </SidebarContent>
    <SidebarFooter className="border-t border-white/20 p-2">
      <div className={cn("flex flex-col gap-1", collapsed && "items-center")}>
        <DropdownMenu><DropdownMenuTrigger asChild><button className={cn("flex min-h-11 w-full min-w-0 items-center gap-3 rounded-md p-2 text-left text-white hover:bg-white/10", collapsed && "w-11 justify-center px-0")} aria-label={`Account menu for ${user?.name || "Administrator"}`}><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/15 text-xs font-semibold">{getInitials(user?.name)}</span>{!collapsed && <span className="min-w-0 flex-1"><span className="block whitespace-normal break-words text-sm font-medium leading-5">{user?.name || "Administrator"}</span><span className="block text-xs capitalize text-white/80">{user?.role?.replace(/_/g, " ")}</span></span>}</button></DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? "top" : "right"} align="end"><DropdownMenuLabel>My account</DropdownMenuLabel><DropdownMenuItem asChild><Link to="/edit-profile"><UserRound className="mr-2 size-4" />My account</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/change-password"><KeyRound className="mr-2 size-4" />Change password</Link></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={logout}><LogOut className="mr-2 size-4" />Sign out</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
        {!collapsed && <button type="button" onClick={() => void logout()} aria-label="Sign out" title="Sign out" className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/25 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"><LogOut className="size-4" aria-hidden="true" /><span>Sign out</span></button>}
      </div>
    </SidebarFooter>
  </Sidebar>;
}

export function AdminTopbar({ pathname }: { pathname: string }) {
  const { search } = useLocation();
  const { user } = useAuth();
  const current = resolveCurrentItem(pathname, search, user?.role);
  const section = current && resolveCurrentSection(current.url);
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [searchOpen, setSearchOpen] = useState(false);
  const sections = visibleSidebarSections(user?.role);
  const canManageNotifications = user?.role === "admin" || user?.role === "super_admin";
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(open => !open); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const choose = (url: string) => { setSearchOpen(false); navigate(url); };
  return <header className="z-30 shrink-0 border-b border-border bg-card">
    <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3"><SidebarTrigger aria-label="Toggle navigation" /><nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm"><Link to="/admin" className="hidden text-muted-foreground hover:text-foreground md:block">Home</Link><ChevronRight className="hidden size-3 text-muted-foreground md:block" />{section && <><span className="hidden text-muted-foreground lg:block">{section.label}</span><ChevronRight className="hidden size-3 text-muted-foreground lg:block" /></>}<span aria-current="page" className="truncate font-medium">{current?.title || "Library administration"}{pathname.includes("/receipt/") ? " / Receipt" : ""}</span></nav></div>
      <div className="flex shrink-0 items-center gap-2"><Button variant="outline" size="sm" onClick={() => setSearchOpen(true)} aria-label="Find a tool"><Search className="size-4 sm:mr-2" /><span className="hidden sm:inline">Find a tool</span><kbd className="ml-5 hidden text-xs text-muted-foreground xl:inline">Ctrl K</kbd></Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="relative" aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}><Bell className="size-4" />{unreadCount > 0 && <span className="absolute right-1 top-1 rounded-full bg-primary px-1 text-xs text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1rem))] p-0"><DropdownMenuLabel className="flex items-center justify-between border-b p-4">Notifications{unreadCount > 0 && <button className="text-xs text-action" onClick={() => void markAllAsRead()}>Mark all read</button>}</DropdownMenuLabel><div className="max-h-80 overflow-y-auto">{notifications.length ? notifications.slice(0, 8).map(notification => <DropdownMenuItem key={notification.id} className="flex flex-col items-start gap-1 px-4 py-3" onSelect={() => { if (!notification.is_read) void markAsRead(notification.id); if (notification.href) navigate(notification.href); else if (canManageNotifications) navigate("/admin/notifications"); }}><span className="font-medium">{notification.title}</span><span className="line-clamp-2 text-sm text-muted-foreground">{notification.body}</span>{!notification.is_read && <span className="text-xs text-action">Unread</span>}</DropdownMenuItem>) : <p className="p-6 text-sm text-muted-foreground">No notifications yet.</p>}</div>{canManageNotifications && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => navigate("/admin/notifications")} className="p-3 text-action">Manage notifications</DropdownMenuItem></>}</DropdownMenuContent>
        </DropdownMenu><ThemeToggle />
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="px-2 sm:px-3" aria-label="More options"><MoreHorizontal className="size-4 sm:mr-2" /><span className="hidden sm:inline">More</span></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end"><DropdownMenuLabel>More</DropdownMenuLabel><DropdownMenuItem asChild><Link to={helpItem.url}><helpItem.icon className="mr-2 size-4" />{helpItem.title}</Link></DropdownMenuItem><DropdownMenuItem asChild><a href="/" target="_blank" rel="noreferrer"><ExternalLink className="mr-2 size-4" />View public website</a></DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}><DialogContent className="overflow-hidden p-0"><DialogTitle className="sr-only">Find a tool</DialogTitle><DialogDescription className="sr-only">Search the tools available to your role. Use arrow keys to select a result.</DialogDescription><Command><CommandInput placeholder="Search tools, pages, or tasks…" /><CommandList><CommandEmpty>No tools found. Try “borrow”, “users”, or “reports”.</CommandEmpty><CommandGroup heading="Quick tasks">{[{ ...dashboardItem }, { ...sections[0]?.items[0], title: "Borrow a copy", url: "/admin/circulation?transaction=borrow" }, { ...sections[0]?.items[0], title: "Return a copy", url: "/admin/circulation?transaction=return" }, helpItem].map(item => <CommandItem key={item.url} value={item.title} onSelect={() => choose(item.url)}>{item.title}</CommandItem>)}</CommandGroup>{sections.map(group => <CommandGroup key={group.label} heading={group.label}>{group.items.map(item => <CommandItem key={item.url} value={`${item.title} ${item.aliases?.join(" ") || ""}`} onSelect={() => choose(item.url)}><item.icon className="mr-3 size-4" />{item.title}</CommandItem>)}</CommandGroup>)}</CommandList></Command></DialogContent></Dialog>
  </header>;
}

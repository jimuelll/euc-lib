import "../admin-topbar.css";
import { LibraryDesignProvider } from "@/components/ui/library-design";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AdminIcon, adminIconByUrl } from "../../components/AdminIcon";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AdminThemeToggle as ThemeToggle } from "../../components/AdminThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import { formatNotificationTime } from "@/features/notifications/notification-time";
import { dashboardItem, helpItem, visibleSidebarSections, resolveCurrentItem, resolveCurrentSection } from "../AdminLayoutData";

export { AdminSidebar } from "./AdminSidebar";

export function AdminTopbar({ pathname }: { pathname: string }) {
  const { search } = useLocation();
  const { user } = useAuth();
  const current = resolveCurrentItem(pathname, search, user?.role);
  const section = current && resolveCurrentSection(current.url);
  const navigate = useNavigate();
  const { notifications, unreadCount, openNotification, markAllAsRead } = useNotifications();
  const searchTrigger = useRef<HTMLButtonElement>(null);
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
  return <header data-library-design className="admin-topbar z-30 shrink-0 border-b border-border bg-card">
    <div className="admin-topbar-row flex h-14 items-center justify-between gap-2 px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3"><SidebarTrigger aria-label="Open administration navigation" className="h-11 w-11 shrink-0 md:h-9 md:w-9" /><nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">{pathname !== "/admin" && <><Link to="/admin" className="hidden text-muted-foreground hover:text-foreground md:block">Home</Link><AdminIcon name="chevronRight" className="hidden size-3 text-muted-foreground md:block" /></>}{section && <><span className="hidden text-muted-foreground lg:block">{section.label}</span><AdminIcon name="chevronRight" className="hidden size-3 text-muted-foreground lg:block" /></>}<span aria-current="page" className="truncate font-semibold md:font-medium">{current?.title || "Library administration"}{pathname.includes("/receipt/") ? " / Receipt" : ""}</span></nav></div>
      <div className="admin-topbar-actions flex shrink-0 items-center gap-1 sm:gap-2"><Button variant="outline" size="sm" className="h-11 px-2.5 md:h-9 md:px-3" ref={searchTrigger} onClick={() => setSearchOpen(true)} aria-label="Find an administration tool"><AdminIcon name="search" className="size-4 sm:mr-2" /><span className="hidden sm:inline">Find a tool</span><kbd className="ml-5 hidden text-xs text-muted-foreground xl:inline">Ctrl K</kbd></Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="relative h-11 w-11 md:h-9 md:w-9" aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}><AdminIcon name="notifications" className="size-4" />{unreadCount > 0 && <span className="admin-topbar-unread">{unreadCount > 9 ? "9+" : unreadCount}</span>}</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(420px,calc(100vw-1rem))] p-0">
            <DropdownMenuLabel className="flex items-center justify-between gap-3 border-b p-4">
              <span>Notifications{unreadCount > 0 && <span className="mt-1 block text-xs font-normal text-muted-foreground">{unreadCount} unread {unreadCount === 1 ? "notification" : "notifications"}</span>}</span>
              {unreadCount > 0 && <button type="button" className="min-h-11 text-xs font-semibold text-action hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => void markAllAsRead()}>Mark all read</button>}
            </DropdownMenuLabel>
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length ? notifications.slice(0, 8).map(notification => <DropdownMenuItem key={notification.id} className={`flex w-full cursor-pointer flex-col items-stretch gap-0 rounded-none border-b border-border/50 px-4 py-3.5 text-left focus:bg-muted hover:bg-muted ${notification.is_read ? "bg-background" : "bg-action/5"}`} onSelect={() => { openNotification(notification.id); }}>
                <div className="flex w-full items-start justify-between gap-4"><span className="min-w-0 break-words text-sm font-semibold leading-snug text-foreground">{notification.title}</span><time className="shrink-0 whitespace-nowrap text-xs leading-5 text-muted-foreground" dateTime={notification.created_at}>{formatNotificationTime(notification.created_at)}</time></div>
                <span className="mt-1.5 line-clamp-2 w-full break-words text-sm leading-relaxed text-muted-foreground">{notification.body}</span>
                {!notification.is_read && <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-action"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"/>Unread</span>}
              </DropdownMenuItem>) : <p className="p-6 text-sm text-muted-foreground">No notifications yet.</p>}
            </div>
            {canManageNotifications && <><DropdownMenuSeparator className="m-0"/><DropdownMenuItem onSelect={() => navigate("/admin/notifications")} className="min-h-11 rounded-none px-4 py-3 text-sm font-semibold text-action">Manage notifications</DropdownMenuItem></>}
          </DropdownMenuContent>
        </DropdownMenu><span className="hidden md:inline-flex"><ThemeToggle /></span>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="hidden h-9 px-2 sm:px-3 md:inline-flex" aria-label="More options"><AdminIcon name="more" className="size-4 sm:mr-2" /><span className="hidden sm:inline">More</span></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end"><DropdownMenuLabel>More</DropdownMenuLabel><DropdownMenuItem asChild><Link to={helpItem.url}><AdminIcon name="help" className="mr-2 size-4" />{helpItem.title}</Link></DropdownMenuItem><DropdownMenuItem asChild><a href="/" target="_blank" rel="noreferrer"><AdminIcon name="external" className="mr-2 size-4" />View public website</a></DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    <LibraryDesignProvider><Dialog open={searchOpen} onOpenChange={setSearchOpen}><DialogContent onCloseAutoFocus={event => { event.preventDefault(); searchTrigger.current?.focus(); }} className="library-tool-search overflow-hidden p-0"><DialogTitle className="sr-only">Find a tool</DialogTitle><DialogDescription className="sr-only">Search the tools available to your role. Use arrow keys to select a result.</DialogDescription><Command><CommandInput placeholder="Search tools, pages, or tasks…" /><CommandList><CommandEmpty>No tools found. Try “borrow”, “users”, or “reports”.</CommandEmpty><CommandGroup heading="Quick tasks">{[{ ...dashboardItem }, { ...sections[0]?.items[0], title: "Borrow a copy", url: "/admin/circulation?transaction=borrow" }, { ...sections[0]?.items[0], title: "Return a copy", url: "/admin/circulation?transaction=return" }, helpItem].map(item => <CommandItem key={item.url} value={item.title} onSelect={() => choose(item.url)}>{item.title}</CommandItem>)}</CommandGroup>{sections.map(group => <CommandGroup key={group.label} heading={group.label}>{group.items.map(item => <CommandItem key={item.url} value={`${item.title} ${item.aliases?.join(" ") || ""}`} onSelect={() => choose(item.url)}><AdminIcon name={adminIconByUrl[item.url] ?? "transactions"} className="mr-3 size-4" />{item.title}</CommandItem>)}</CommandGroup>)}</CommandList></Command><footer className="library-search-help"><span>↑ ↓ Select a tool</span><span>Enter Open</span><span>Esc Close</span></footer></DialogContent></Dialog></LibraryDesignProvider>
  </header>;
}

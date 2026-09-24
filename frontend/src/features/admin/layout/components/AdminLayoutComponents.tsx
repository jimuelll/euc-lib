import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Bell, ExternalLink, Search, MoreHorizontal } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import { dashboardItem, helpItem, visibleSidebarSections, resolveCurrentItem, resolveCurrentSection } from "../AdminLayoutData";

export { AdminSidebar } from "./AdminSidebar";

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
    <div className="flex h-16 items-center justify-between gap-2 px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3"><SidebarTrigger aria-label="Open administration navigation" className="h-11 w-11 shrink-0 md:h-9 md:w-9" /><nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm"><Link to="/admin" className="hidden text-muted-foreground hover:text-foreground md:block">Home</Link><ChevronRight className="hidden size-3 text-muted-foreground md:block" />{section && <><span className="hidden text-muted-foreground lg:block">{section.label}</span><ChevronRight className="hidden size-3 text-muted-foreground lg:block" /></>}<span aria-current="page" className="truncate font-semibold md:font-medium">{current?.title || "Library administration"}{pathname.includes("/receipt/") ? " / Receipt" : ""}</span></nav></div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2"><Button variant="outline" size="sm" className="h-11 px-2.5 md:h-9 md:px-3" onClick={() => setSearchOpen(true)} aria-label="Find an administration tool"><Search className="size-4 sm:mr-2" /><span className="hidden sm:inline">Find a tool</span><kbd className="ml-5 hidden text-xs text-muted-foreground xl:inline">Ctrl K</kbd></Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="relative" aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}><Bell className="size-4" />{unreadCount > 0 && <span className="absolute right-1 top-1 rounded-full bg-primary px-1 text-xs text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1rem))] p-0"><DropdownMenuLabel className="flex items-center justify-between border-b p-4">Notifications{unreadCount > 0 && <button className="text-xs text-action" onClick={() => void markAllAsRead()}>Mark all read</button>}</DropdownMenuLabel><div className="max-h-80 overflow-y-auto">{notifications.length ? notifications.slice(0, 8).map(notification => <DropdownMenuItem key={notification.id} className="flex flex-col items-start gap-1 px-4 py-3" onSelect={() => { if (!notification.is_read) void markAsRead(notification.id); if (notification.href) navigate(notification.href); else if (canManageNotifications) navigate("/admin/notifications"); }}><span className="font-medium">{notification.title}</span><span className="line-clamp-2 text-sm text-muted-foreground">{notification.body}</span>{!notification.is_read && <span className="text-xs text-action">Unread</span>}</DropdownMenuItem>) : <p className="p-6 text-sm text-muted-foreground">No notifications yet.</p>}</div>{canManageNotifications && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => navigate("/admin/notifications")} className="p-3 text-action">Manage notifications</DropdownMenuItem></>}</DropdownMenuContent>
        </DropdownMenu><span className="hidden md:inline-flex"><ThemeToggle /></span>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="hidden px-2 sm:px-3 md:inline-flex" aria-label="More options"><MoreHorizontal className="size-4 sm:mr-2" /><span className="hidden sm:inline">More</span></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end"><DropdownMenuLabel>More</DropdownMenuLabel><DropdownMenuItem asChild><Link to={helpItem.url}><helpItem.icon className="mr-2 size-4" />{helpItem.title}</Link></DropdownMenuItem><DropdownMenuItem asChild><a href="/" target="_blank" rel="noreferrer"><ExternalLink className="mr-2 size-4" />View public website</a></DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}><DialogContent className="overflow-hidden p-0"><DialogTitle className="sr-only">Find a tool</DialogTitle><DialogDescription className="sr-only">Search the tools available to your role. Use arrow keys to select a result.</DialogDescription><Command><CommandInput placeholder="Search tools, pages, or tasks…" /><CommandList><CommandEmpty>No tools found. Try “borrow”, “users”, or “reports”.</CommandEmpty><CommandGroup heading="Quick tasks">{[{ ...dashboardItem }, { ...sections[0]?.items[0], title: "Borrow a copy", url: "/admin/circulation?transaction=borrow" }, { ...sections[0]?.items[0], title: "Return a copy", url: "/admin/circulation?transaction=return" }, helpItem].map(item => <CommandItem key={item.url} value={item.title} onSelect={() => choose(item.url)}>{item.title}</CommandItem>)}</CommandGroup>{sections.map(group => <CommandGroup key={group.label} heading={group.label}>{group.items.map(item => <CommandItem key={item.url} value={`${item.title} ${item.aliases?.join(" ") || ""}`} onSelect={() => choose(item.url)}><item.icon className="mr-3 size-4" />{item.title}</CommandItem>)}</CommandGroup>)}</CommandList></Command></DialogContent></Dialog>
  </header>;
}

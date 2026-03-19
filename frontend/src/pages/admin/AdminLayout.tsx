import { Outlet, useLocation } from "react-router-dom";
import {
  Home, ShieldCheck, BookCopy, ArrowLeftRight, CreditCard, DatabaseBackup,
  FileBarChart, HelpCircle, Wifi, ClipboardCheck, PenSquare, LogOut, Library,
  CalendarDays, FileText, GraduationCap, CalendarOff, ShieldAlert, Clock,
  ChevronDown, Bell,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
  SidebarTrigger, SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import ThemeToggle from "@/components/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface SidebarSection {
  label: string;
  items: { title: string; url: string; icon: typeof Home }[];
}

const sidebarSections: SidebarSection[] = [
  {
    label: "Library Management",
    items: [
      { title: "Home", url: "/admin", icon: Home },
      { title: "Catalog", url: "/admin/catalog", icon: BookCopy },
      { title: "Circulation", url: "/admin/circulation", icon: ArrowLeftRight },
      { title: "Reservations", url: "/admin/reservations", icon: CalendarDays },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "User Management", url: "/admin/manage", icon: ShieldCheck },
      { title: "Holidays", url: "/admin/holidays", icon: CalendarOff },
      { title: "Restrictions", url: "/admin/restrictions", icon: ShieldAlert },
      { title: "Clearance", url: "/admin/clearance", icon: ClipboardCheck },
    ],
  },
  {
    label: "Content Management",
    items: [
      { title: "Bulletin Posts", url: "/admin/bulletin", icon: FileText },
      { title: "Edit Homepage", url: "/admin/edit-homepage", icon: PenSquare },
      { title: "Subscriptions", url: "/admin/subscriptions", icon: GraduationCap },
    ],
  },
  {
    label: "Reports",
    items: [
      { title: "Circulation Report", url: "/admin/report", icon: FileBarChart },
      { title: "Attendance Report", url: "/admin/attendance", icon: Clock },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Payment", url: "/admin/payment", icon: CreditCard },
      { title: "Backup", url: "/admin/backup", icon: DatabaseBackup },
      { title: "Internet Access", url: "/admin/internet", icon: Wifi },
      { title: "Query Tools", url: "/admin/query", icon: HelpCircle },
    ],
  },
];

const allItems = sidebarSections.flatMap((s) => s.items);

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, logout } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r">

      {/* ── Brand header ── */}
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <Library className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground tracking-tight leading-none">
                Admin Dashboard
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5 tracking-wide">
                Library System
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <Separator />

      {/* ── Profile card — sits just below brand, above nav ── */}
      {!collapsed && (
        <div className="px-4 py-4 flex flex-col items-center text-center gap-2">
          <Avatar className="h-14 w-14 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
            <AvatarFallback className="bg-primary/10 text-primary text-base font-bold">
              {getInitials(user?.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">
              Hello, {user?.name?.split(" ")[0] ?? "Admin"}
            </p>
            {/* show email if available, else role */}
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">
              {user?.role?.replace("_", " ") ?? "Administrator"}
            </p>
          </div>
        </div>
      )}

      {!collapsed && <Separator />}

      {/* ── Nav ── */}
      <SidebarContent className="px-2 py-2">
        {sidebarSections.map((section, sectionIndex) => (
          <SidebarGroup key={section.label} className="p-0">
            {sectionIndex > 0 && !collapsed && (
              <div className="mx-2 my-1.5 h-px bg-border/50" />
            )}

            {!collapsed ? (
              <Collapsible defaultOpen={true}>
                <CollapsibleTrigger className="group flex w-full items-center justify-between px-2 py-1.5 rounded-sm text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground hover:bg-accent/30 transition-colors">
                  {section.label}
                  <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {section.items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              end={item.url === "/admin"}
                              className="hover:bg-accent/50"
                              activeClassName="bg-primary/10 text-primary font-medium"
                            >
                              <item.icon className="mr-2 h-4 w-4" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === "/admin"}
                          title={item.title}
                          className="hover:bg-accent/50"
                          activeClassName="bg-primary/10 text-primary font-medium"
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ── Footer — logout only, no duplicate user card ── */}
      <SidebarFooter className="p-3">
        <Separator className="mb-3" />

        {/* Collapsed state: show avatar so user knows who's logged in */}
        {collapsed && (
          <div className="flex justify-center mb-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full gap-2 text-muted-foreground hover:text-foreground",
                  collapsed ? "justify-center" : "justify-start"
                )}
                onClick={logout}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {!collapsed && <span>Logout</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/* ─────────────────────────── layout ─────────────────────────── */
export const AdminLayout = () => {
  const location = useLocation();
  const current = allItems.find((i) =>
    i.url === "/admin"
      ? location.pathname === "/admin"
      : location.pathname.startsWith(i.url)
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">

          {/* ── Topbar ── */}
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/80 backdrop-blur-md px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="h-5 w-px bg-border" />
              <h1 className="font-heading text-sm font-semibold text-foreground">
                {current?.title ?? "Admin"}
              </h1>
            </div>

            <div className="flex items-center gap-1">
              {/* Notification bell with unread badge */}
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {/* Red dot badge */}
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
              </Button>

              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
import { Outlet, useLocation } from "react-router-dom";
import {
  Home, ShieldCheck, BookCopy, ArrowLeftRight, CreditCard, DatabaseBackup,
  FileBarChart, HelpCircle, Wifi, ClipboardCheck, PenSquare, LogOut, Library,
  CalendarDays, FileText, GraduationCap, CalendarOff, ShieldAlert, Clock,
  ChevronDown,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import ThemeToggle from "@/components/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/context/AuthContext"; // ← fix import

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

// Get initials from full name
function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, logout } = useAuth(); // ← real user from context

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Library className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="font-heading text-sm font-bold text-foreground tracking-tight">
              Admin Dashboard
            </span>
          )}
        </div>
      </SidebarHeader>

      <Separator />

      <SidebarContent className="px-2 py-2">
        {sidebarSections.map((section) => {
          const sectionActive = section.items.some((item) =>
            item.url === "/admin"
              ? location.pathname === "/admin"
              : location.pathname.startsWith(item.url)
          );

          return (
            <SidebarGroup key={section.label}>
              {!collapsed ? (
                <Collapsible defaultOpen={sectionActive || section.label === "Library Management"}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                    {section.label}
                    <ChevronDown className="h-3 w-3 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
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
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <Separator className="mb-3" />
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {getInitials(user?.name)} {/* ← real initials */}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.name ?? "Admin"} {/* ← real name */}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {user?.role?.replace("_", " ") ?? "Administrator"} {/* ← real role */}
              </p>
            </div>
          )}
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-2 text-left"
                onClick={logout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {!collapsed && <span>Logout</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

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
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/80 backdrop-blur-md px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <h1 className="font-heading text-sm font-semibold text-foreground">
                {current?.title ?? "Admin"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
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
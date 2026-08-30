import {
  LayoutDashboard, ShieldCheck, BookCopy, ArrowLeftRight, DatabaseBackup,
  FileBarChart, ClipboardCheck, PenSquare,
  CalendarDays, FileText, GraduationCap, CalendarOff, ShieldAlert, Clock, BellRing, ScrollText, Settings2,
} from "lucide-react";
import type { SidebarSection } from "./AdminLayout.types";


const ROLES_WITH_ABOUT_SECTION = new Set(["admin", "super_admin"]);

export const sidebarSections: SidebarSection[] = [
  {
    label: "Library Management",
    items: [
      { title: "Dashboard",    url: "/admin",              icon: LayoutDashboard },
      { title: "Catalog",      url: "/admin/catalog",      icon: BookCopy       },
      { title: "Circulation",  url: "/admin/circulation",  icon: ArrowLeftRight },
      { title: "Reservations", url: "/admin/reservations", icon: CalendarDays   },
      { title: "Clearance",    url: "/admin/clearance",    icon: ClipboardCheck },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "User Management", url: "/admin/manage",       icon: ShieldCheck    },
      { title: "Holidays",        url: "/admin/holidays",     icon: CalendarOff, roles: ["admin", "super_admin"] },
      { title: "Restrictions",    url: "/admin/restrictions", icon: ShieldAlert    },
      { title: "Book Type Policies", url: "/admin/book-types", icon: Settings2, roles: ["admin", "super_admin"] },
    ],
  },
  {
    label: "Content Management",
    items: [
      { title: "Bulletin Posts",      url: "/admin/bulletin",      icon: FileText, roles: ["admin", "super_admin"] },
      { title: "Edit About Section", url: "/admin/edit-about", icon: PenSquare, roles: [...ROLES_WITH_ABOUT_SECTION] },
      { title: "Subscriptions",       url: "/admin/subscriptions", icon: GraduationCap, roles: ["admin", "super_admin"] },
      { title: "Notifications",       url: "/admin/notifications", icon: BellRing, roles: ["admin", "super_admin"] },
    ],
  },
  {
    label: "Reports",
    items: [
      { title: "Analytics",        url: "/admin/analytics",     icon: FileBarChart, roles: ["admin", "super_admin"] },
      { title: "Audit Logs",       url: "/admin/audit-logs",    icon: ScrollText, roles: ["super_admin"]  },
      { title: "Reports", url: "/admin/report",      icon: FileBarChart, roles: ["admin", "super_admin"] },
      { title: "Attendance Logs",  url: "/admin/attendance-logs", icon: Clock, roles: ["admin", "super_admin"] },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Backup",          url: "/admin/backup",   icon: DatabaseBackup, roles: ["admin", "super_admin"] },
    ],
  },
];

export const allSidebarItems = sidebarSections.flatMap((s) => s.items);

export function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function resolveCurrentItem(pathname: string) {
  return allSidebarItems.find((i) =>
    i.url === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(i.url)
  );
}

export function resolveCurrentSection(itemUrl: string) {
  return sidebarSections.find((s) => s.items.some((i) => i.url === itemUrl));
}

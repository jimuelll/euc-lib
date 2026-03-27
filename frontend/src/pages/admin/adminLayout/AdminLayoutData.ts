import {
  Home, ShieldCheck, BookCopy, ArrowLeftRight, CreditCard, DatabaseBackup,
  FileBarChart, HelpCircle, Wifi, ClipboardCheck, PenSquare,
  CalendarDays, FileText, GraduationCap, CalendarOff, ShieldAlert, Clock,
} from "lucide-react";
import type { SidebarSection } from "./AdminLayout.types";

export const sidebarSections: SidebarSection[] = [
  {
    label: "Library Management",
    items: [
      { title: "Home",         url: "/admin",              icon: Home           },
      { title: "Catalog",      url: "/admin/catalog",      icon: BookCopy       },
      { title: "Circulation",  url: "/admin/circulation",  icon: ArrowLeftRight },
      { title: "Reservations", url: "/admin/reservations", icon: CalendarDays   },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "User Management", url: "/admin/manage",       icon: ShieldCheck    },
      { title: "Holidays",        url: "/admin/holidays",     icon: CalendarOff    },
      { title: "Restrictions",    url: "/admin/restrictions", icon: ShieldAlert    },
      { title: "Clearance",       url: "/admin/clearance",    icon: ClipboardCheck },
    ],
  },
  {
    label: "Content Management",
    items: [
      { title: "Bulletin Posts",      url: "/admin/bulletin",      icon: FileText      },
      { title: "Edit About Section",  url: "/admin/edit-about",    icon: PenSquare     },
      { title: "Subscriptions",       url: "/admin/subscriptions", icon: GraduationCap },
    ],
  },
  {
    label: "Reports",
    items: [
      { title: "Circulation Report", url: "/admin/report",     icon: FileBarChart },
      { title: "Attendance Report",  url: "/admin/attendance", icon: Clock        },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Payment",         url: "/admin/payment",  icon: CreditCard     },
      { title: "Backup",          url: "/admin/backup",   icon: DatabaseBackup },
      { title: "Internet Access", url: "/admin/internet", icon: Wifi           },
      { title: "Query Tools",     url: "/admin/query",    icon: HelpCircle     },
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
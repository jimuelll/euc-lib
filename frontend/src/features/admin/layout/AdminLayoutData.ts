import { LayoutDashboard, Users, BookCopy, ArrowLeftRight, DatabaseBackup, FileBarChart, ClipboardCheck, CalendarDays, FileText, CalendarOff, Clock, BellRing, ScrollText, Settings2, BookOpenCheck, FilePenLine, Sparkles, ShieldAlert, Mail, Table2 } from "lucide-react";
import type { SidebarItem, SidebarSection } from "./AdminLayout.types";

const administrators = ["admin", "super_admin"];
const superAdministrators = ["super_admin"];
export const dashboardItem: SidebarItem = { title: "Dashboard", url: "/admin", icon: LayoutDashboard };
export const helpItem: SidebarItem = { title: "Help & user guide", url: "/admin/user-guide", icon: BookOpenCheck, aliases: ["instructions", "help"] };
export const sidebarSections: SidebarSection[] = [
  { label: "Desk", alwaysOpen: true, items: [
    { title: "Borrow & Return", url: "/admin/circulation", icon: ArrowLeftRight, aliases: ["circulation", "checkout", "scan"] },
    { title: "Reservations", url: "/admin/reservations", icon: CalendarDays, aliases: ["holds", "pickup"] },
    { title: "Clearance & Fines", url: "/admin/clearance", icon: ClipboardCheck, aliases: ["payment", "overdue", "receipt"] },
    { title: "Attendance", url: "/admin/attendance", icon: Clock, roles: administrators, aliases: ["visits", "time in", "logs"] },
  ] },
  { label: "Records", alwaysOpen: true, items: [
    { title: "Users", url: "/admin/users", icon: Users, aliases: ["patron", "student", "employee", "restrictions", "accounts"] },
    { title: "Catalog", url: "/admin/catalog", icon: BookCopy, aliases: ["books", "copies", "thesis", "catalogue", "holdings"] },
  ] },
  { label: "Publishing", items: [
    { title: "Website Content", url: "/admin/content", icon: FileText, roles: administrators, aliases: ["homepage", "about", "bulletin", "events", "subscriptions", "edit guide"] },
    { title: "Notifications", url: "/admin/notifications", icon: BellRing, roles: administrators },
    { title: "Email Deliveries", url: "/admin/library-emails", icon: Mail, roles: superAdministrators, aliases: ["email", "brevo", "delivery", "failed emails"] },
    { title: "Moderation", url: "/admin/moderation", icon: ShieldAlert, roles: administrators, aliases: ["reported comments", "safety", "review", "held comments"] },
  ] },
  { label: "Insights", items: [
    { title: "Analytics", url: "/admin/analytics", icon: FileBarChart, roles: administrators },
    { title: "Reports", url: "/admin/reports", icon: Table2, roles: administrators, aliases: ["query", "export", "csv", "explore", "records"] },
    { title: "Audit Logs", url: "/admin/audit-logs", icon: ScrollText, roles: superAdministrators },
  ] },
  { label: "Settings", items: [
    { title: "Academic Calendar", url: "/admin/settings/academic", icon: CalendarOff, roles: administrators, aliases: ["terms", "programs", "departments", "holidays", "academic settings"] },
    { title: "Loan Policies", url: "/admin/settings/loan-policies", icon: Settings2, roles: superAdministrators, aliases: ["book types", "loan duration", "fine rates"] },
    { title: "Catalog Fields", url: "/admin/settings/catalog-fields", icon: FilePenLine, roles: superAdministrators, aliases: ["form builder", "fields", "catalog configuration"] },
    { title: "AI Recommendations", url: "/admin/settings/ai", icon: Sparkles, roles: superAdministrators, aliases: ["embeddings", "metadata"] },
    { title: "Backup & Restore", url: "/admin/settings/backup", icon: DatabaseBackup, roles: superAdministrators },
  ] },
];
export const allSidebarItems = [dashboardItem, ...sidebarSections.flatMap(section => section.items), helpItem];
export const canAccessItem = (item: SidebarItem, role?: string) => !item.roles || item.roles.includes(role ?? "");
export const visibleSidebarSections = (role?: string) => sidebarSections.map(section => ({ ...section, items: section.items.filter(item => canAccessItem(item, role)) })).filter(section => section.items.length);
export function getInitials(name?: string) { return name?.trim().split(/\s+/).filter(Boolean).map(part => part[0]).filter((_, index, parts) => index === 0 || index === parts.length - 1).join("").toUpperCase() || "?"; }
export function resolveCurrentItem(pathname: string, search = "", role?: string) {
  const candidates = role ? allSidebarItems.filter(item => canAccessItem(item, role)) : allSidebarItems;
  const tab = new URLSearchParams(search).get("tab");
  return candidates.find(item => item.url.includes("?") && item.url.split("?")[0] === pathname && new URLSearchParams(item.url.split("?")[1]).get("tab") === tab)
    ?? candidates.find(item => !item.url.includes("?") && (pathname === item.url || (item.url !== "/admin" && pathname.startsWith(item.url + "/"))));
}
export function resolveCurrentSection(itemUrl: string) { return sidebarSections.find(section => section.items.some(item => item.url === itemUrl)); }

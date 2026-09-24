import type { ReactNode, SVGProps } from "react";

const gold = "var(--admin-sidebar-gold)";
const drawings = {
  dashboard: <><path d="M3 3h7v7H3zM14 14h7v7h-7zM3 14h7v7H3z" /><path d="M14 3h7v7h-7z" fill={gold} stroke={gold} /></>,
  circulation: <><path d="M4 5h7v14H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM5 16h6M14 6h7m-3-3 3 3-3 3" /><path d="M21 17h-7m3-3-3 3 3 3" stroke={gold} /></>,
  reservations: <><path d="M20 13V5H3v16h10M3 9h17M7 3v4M16 3v4" /><path d="M15 13h6v9l-3-2-3 2z" stroke={gold} /></>,
  clearance: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2zM8 7h8M8 10h5" /><path d="m9 15 2 2 5-5" stroke={gold} /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6" /><path d="M18 13a5 5 0 0 1 3 5v3" stroke={gold} /></>,
  catalog: <><path d="M3 4h5v17H3zM16 5l4-1 3 16-4 1zM4 8h3" /><path d="M10 3h4v18h-4zM11 7h2" stroke={gold} /></>,
  attendance: <><circle cx="10" cy="10" r="7" /><path d="m13 20 3 2 6-7" /><path d="M10 6v4l3 2" stroke={gold} /></>,
  content: <><path d="M12 21H3V3h18v9M3 8h18M6 12h6M6 16h3" /><path d="m14 17 5-5 3 3-5 5-4 1z" stroke={gold} /></>,
  notifications: <><path d="M5 17h14l-2-4V9a5 5 0 0 0-10 0v4zM12 2v2" /><path d="M10 20a2 2 0 0 0 4 0" stroke={gold} /></>,
  analytics: <><path d="M3 21h18M5 17v-5h4v5M11 17V8h4v9" /><path d="M17 17V3h4v14" stroke={gold} /></>,
  reports: <><path d="M18 21H4V3h11l5 5v3M15 3v5h5M7 7h4M7 11h5M7 15h3" /><path d="m12 19 3-4 3 2 4-5" stroke={gold} /></>,
  academic: <><path d="M21 11V5H3v16h8M7 3v4M17 3v4M3 9h18M16 12v10M21 12v10M19 19h4" /><circle cx="16" cy="15" r="2" fill={gold} stroke={gold} /></>,
  policies: <><path d="M4 3h12v7M4 3a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h5M5 7h7M5 11h3M16 10l6 2v4c0 3-3 5-6 6-3-1-6-3-6-6v-4z" /><path d="m13 16 2 2 4-4" stroke={gold} /></>,
  configuration: <><path d="M3 4h18v5H3zM3 13h8v7H3zM15 17l4-5 3 2-4 5" /><path d="m15 17-1 4 4-2z" stroke={gold} /></>,
  recommendations: <><path d="M12 9v12M12 11C9 8 5 8 2 9v11c4-1 7-1 10 1 3-2 6-2 10-1v-8" /><path d="m18 2 1 3 3 1-3 1-1 3-1-3-3-1 3-1z" stroke={gold} /></>,
  audit: <><path d="M12 21H3V3h14v6M6 7h1M10 7h3M6 11h1M6 15h1" /><circle cx="17" cy="16" r="6" /><path d="M17 12v4l3 1" stroke={gold} /></>,
  backup: <><ellipse cx="10" cy="5" rx="7" ry="3" /><path d="M3 5v12c0 3 7 4 11 2M17 5v5M3 11c2 2 6 3 9 2" /><path d="M15 15a4 4 0 1 1 1 7M15 11v4h4" stroke={gold} /></>,
  logout: <><path d="M10 3H3v18h7M7 7v10" /><path d="M10 12h12m-4-4 4 4-4 4" stroke={gold} /></>,
} satisfies Record<string, ReactNode>;

export type AdminSidebarIconName = keyof typeof drawings;
export const adminSidebarIconByUrl: Record<string, AdminSidebarIconName> = {
  "/admin": "dashboard", "/admin/circulation": "circulation", "/admin/reservations": "reservations",
  "/admin/clearance": "clearance", "/admin/manage": "users", "/admin/catalog": "catalog",
  "/admin/attendance-logs": "attendance", "/admin/content": "content", "/admin/notifications": "notifications",
  "/admin/analytics": "analytics", "/admin/query": "reports", "/admin/holidays": "academic",
  "/admin/book-types": "policies", "/admin/catalog?tab=builder": "configuration",
  "/admin/catalog?tab=ai": "recommendations", "/admin/audit-logs": "audit", "/admin/backup": "backup",
};

export function AdminSidebarIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: AdminSidebarIconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props} aria-hidden="true" focusable="false">{drawings[name]}</svg>;
}

import type { ReactNode, SVGProps } from "react";

const gold = "var(--admin-icon-accent, currentColor)";
const drawings = {
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
  home: <><path d="m3 10 9-7 9 7v11H3zM9 21v-8h6v8" /></>,
  information: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><circle cx="12" cy="7" r=".7" fill="currentColor" /></>,
  dashboard: <><path d="M3 3h7v7H3zM14 14h7v7h-7zM3 14h7v7H3z" /><path d="M14 3h7v7h-7z" fill={gold} stroke={gold} /></>,
  circulation: <><path d="M4 5h7v14H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM5 16h6M14 6h7m-3-3 3 3-3 3" /><path d="M21 17h-7m3-3-3 3 3 3" stroke={gold} /></>,
  reservations: <><path d="M20 13V5H3v16h10M3 9h17M7 3v4M16 3v4" /><path d="M15 13h6v9l-3-2-3 2z" stroke={gold} /></>,
  clearance: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2zM8 7h8M8 10h5" /><path d="m9 15 2 2 5-5" stroke={gold} /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6" /><path d="M18 13a5 5 0 0 1 3 5v3" stroke={gold} /></>,
  catalog: <><path d="M3 4h5v17H3zM16 5l4-1 3 16-4 1zM4 8h3" /><path d="M10 3h4v18h-4zM11 7h2" stroke={gold} /></>,
  attendance: <><circle cx="10" cy="10" r="7" /><path d="m13 20 3 2 6-7" /><path d="M10 6v4l3 2" stroke={gold} /></>,
  attendanceActivity: <><circle cx="8" cy="7" r="3" /><path d="M2 21v-3a6 6 0 0 1 10-4" /><circle cx="17" cy="16" r="5" /><path d="M17 13v3l2 1" /></>,
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
  borrow: <><path d="M4 4h8v16H4zM7 7h2M7 17h2M15 12h7m-3-3 3 3-3 3" /></>,
  return: <><path d="M4 4h8v16H4zM7 7h2M7 17h2M22 12h-7m3-3-3 3 3 3" /></>,
  overdue: <><path d="M11 21H4V3h12v7M7 7h5M7 11h2" /><circle cx="17" cy="16" r="5" /><path d="M17 13v3l2 1" /></>,
  fines: <><ellipse cx="8" cy="15" rx="5" ry="2" /><path d="M3 15v4c0 3 10 3 10 0v-4M11 11V6c0-3 10-3 10 0v9c0 2-3 3-5 3" /><ellipse cx="16" cy="6" rx="5" ry="2" /><path d="M12 10c2 1 6 1 9 0" /></>,
  transactions: <><path d="M5 3h11l3 3v15H5zM15 3v5h4M8 11h8M8 15h8M8 18h5" /></>,
  arrowRight: <path d="M4 12h16m-6-6 6 6-6 6" />,
  chevronRight: <path d="m9 5 7 7-7 7" />,
  chevronDown: <path d="m5 9 7 7 7-7" />,
  refresh: <><path d="M20 9a8 8 0 1 0-1 9M20 3v6h-6" /></>,
  search: <><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  archive: <><path d="M3 3h18v5H3zM5 8v13h14V8M9 12h6" /></>,
  external: <><path d="M13 3h8v8M21 3 10 14M9 3H3v18h18v-6" /></>,
  help: <><path d="M12 6v15M12 8C9 5 5 5 2 6v14c4-1 7-1 10 1 3-2 6-2 10-1V6c-3-1-7-1-10 2" /></>,
  warning: <><path d="m12 3 10 18H2zM12 9v5" /><circle cx="12" cy="17" r=".5" fill="currentColor" /></>,
  moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>,
  plus: <path d="M12 4v16M4 12h16" />,
  copy: <><path d="M8 3h13v15H8zM3 7v14h13M11 7h7M11 11h7" /></>,
  image: <><path d="M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5" /><circle cx="15" cy="7" r="2" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  userPlus: <><circle cx="9" cy="7" r="3" /><path d="M2 21v-3a7 7 0 0 1 12-5M18 9v8M14 13h8" /></>,
  scan: <><path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  password: <><circle cx="8" cy="8" r="5" /><path d="m12 12 9 9m-4-4 3-3m-6 0 3-3" /></>,
} satisfies Record<string, ReactNode>;

export type AdminIconName = keyof typeof drawings;
export const adminIconByUrl: Record<string, AdminIconName> = {
  "/admin/user-guide": "help", "/admin": "dashboard", "/admin/circulation": "circulation", "/admin/reservations": "reservations",
  "/admin/clearance": "clearance", "/admin/manage": "users", "/admin/catalog": "catalog",
  "/admin/attendance-logs": "attendance", "/admin/content": "content", "/admin/notifications": "notifications",
  "/admin/analytics": "analytics", "/admin/query": "reports", "/admin/holidays": "academic",
  "/admin/book-types": "policies", "/admin/catalog?tab=builder": "configuration",
  "/admin/catalog?tab=ai": "recommendations", "/admin/audit-logs": "audit", "/admin/backup": "backup",
};

export function AdminIcon({ name, accent = false, ...props }: SVGProps<SVGSVGElement> & { name: AdminIconName; accent?: boolean }) {
  return <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props} data-accent={accent ? "gold" : undefined} aria-hidden="true" focusable="false">{drawings[name]}</svg>;
}


import { forwardRef, type ReactNode, type SVGProps } from "react";
import { cn } from "@/lib/utils";

const ribbon = (d: string) => <path data-library-accent="" d={d} />;
const glyphs: Record<string, ReactNode> = {
  ai: <><path d="m10 3 2.5 6.5L19 12l-6.5 2.5L10 21l-2.5-6.5L1 12l6.5-2.5zM19 2v6M16 5h6"/></>,
  barcode: <><path d="M3 4v16M6 4v16M10 4v16M17 4v16M21 4v16"/><path data-library-accent="" d="M13 4h2v16h-2z"/></>,
  lock: <><path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4"/><path data-library-accent="" d="M11 14.5h2v3h-2z"/></>,
  edit: <><path d="M4 20l1-5L16 4l4 4L9 19z"/><path data-library-accent="" d="M14 6l4 4-1.5 1.5-4-4z"/></>,
  grip: <path d="M9 5h2v2H9zM13 5h2v2h-2zM9 11h2v2H9zM13 11h2v2h-2zM9 17h2v2H9zM13 17h2v2h-2z"/>,
  borrow: <><path d="M3 3h11v18H3zM6.5 3v18M14 12h7M18 8.5l3.5 3.5-3.5 3.5"/><path data-library-accent="" d="M9 3h3v6l-1.5-1.3L9 9z"/></>,
  return: <><path d="M10 3h11v18H10zM13.500 3v18M10 12H3M6.500 8.500L3 12l3.500 3.500"/><path data-library-accent="" d="M16 3h3v6l-1.500-1.300L16 9z"/></>,
  reservations: <><path d="M3 5h18v16H3zM3 10h18M8 2v6M16 2v6"/><path data-library-accent="" d="M13 13h4v4h-4z"/></>,
  overdue: <><path d="M4 2h10l4 4v7M4 2v19h8M8 9h6M8 13h3"/><circle cx="17" cy="18" r="4.500"/><path data-library-accent="" d="M16.400 15.500h1.200v2.700h-1.200z"/></>,
  fines: <><path d="M4 7h13v4H4zM4 11v4h13v-4M4 15v4h13v-4"/><circle data-library-accent="" cx="19" cy="7" r="3"/></>,
  clearance: <><path d="M4 3h16v18H4zM7 7h10M7 11h5m-4 5 3 3 6-6" />{ribbon("M14 3h3v3h-3z")}</>,
  catalog: <><path d="M3 3h4v18H3zM9 3h4v18H9zM15.500 4.500l4-1 3 16-4 1z"/><path data-library-accent="" d="M3 7h4v3H3z"/></>,
  records: <><path d="M3 3h4v18H3zM9 3h4v18H9zM15.500 4.500l4-1 3 16-4 1z"/><path data-library-accent="" d="M3 7h4v3H3z"/></>,
  audit: <><path d="M4 2h16v20H4zM8 7h8M8 11h8M8 15h4"/><path data-library-accent="" d="M14 15h4v4h-4z"/></>,
  attendance: <><circle cx="9" cy="7" r="3.500"/><path d="M2 21c0-4.500 3-7 7-7s7 2.500 7 7z"/><path data-library-accent="" d="M18 3h4v4h-4z"/></>,
  attendanceActivity: <><circle cx="8" cy="7" r="3" /><path d="M2 21v-3a6 6 0 0 1 10-4" /><circle cx="17" cy="16" r="5" /><path d="M17 13v3l2 1" />{ribbon("M16 10h2v2h-2z")}</>,
  users: <><circle cx="9" cy="8" r="3.500"/><path d="M2 21c0-4.500 3-6.500 7-6.500s7 2 7 6.500"/><path data-library-accent="" d="M17 4h4v4h-4z"/></>,
  analytics: <><path d="M3 21h18M5 21v-8h4v8M11 21V8h4v13M17 21v-5h3v5"/><path data-library-accent="" d="M11 3h4v2.500h-4z"/></>,
  search: <><circle cx="10.500" cy="10.500" r="6.500"/><path d="M15.500 15.500L21 21"/><path data-library-accent="" d="M8 9.500h5v2H8z"/></>,
  similar: <><path d="M3 4h9v16H3zM6.500 4v16M15 8h6v12h-6z"/><path data-library-accent="" d="M15 3.500h4v2.500h-4z"/></>,
  comment: <><path d="M3 4h18v13h-8l-5 4v-4H3z"/><path data-library-accent="" d="M7 8h6v2H7z"/></>,
  like: <><path d="M20.5 5.5a5 5 0 0 0-7 0L12 7l-1.5-1.5a5 5 0 0 0-7 7L12 21l8.5-8.5a5 5 0 0 0 0-7z" />{ribbon("M15 5h3v2h-3z")}</>,
  pending: <><circle cx="12" cy="13" r="8"/><path d="M12 8.500V13l3 2"/><path data-library-accent="" d="M9.500 1.500h5v3h-5z"/></>,
  notifications: <><path d="M5 17h14l-2-4V9a5 5 0 0 0-10 0v4zM10 21h4" />{ribbon("M10 2h4v3h-4z")}</>,
  backup: <><path d="M3 4h18v16H3zM3 9h18M12 12v6m-3-3 3 3 3-3" />{ribbon("M6 4h3v3H6z")}</>,
  academic: <><path d="M3 4h18v17H3zM3 9h18M7 2v5M17 2v5M7 13h3M7 17h3M14 13h3M14 17h3" />{ribbon("M14 9h4v3h-4z")}</>,
  content: <><path d="M3 3h18v18H3zM3 8h18M7 12h10M7 16h7" />{ribbon("M6 3h3v3H6z")}</>,
  reports: <><path d="M4 3h11l5 5v13H4zM15 3v5h5M8 12h8M8 16h6" />{ribbon("M7 3h3v3H7z")}</>,
  auth: <><path d="M12 2l8 3v7c0 5-3.500 8-8 10-4.500-2-8-5-8-10V5z"/><circle data-library-accent="" cx="12" cy="11" r="2.200"/></>,
  expiring: <><path d="M6 2h12M6 22h12M7 2c0 6 5 7 5 10s-5 4-5 10M17 2c0 6-5 7-5 10s5 4 5 10"/><path data-library-accent="" d="M10 18h4v3h-4z"/></>,
  holdings: <><path d="M3 3h18v5H3zM3 10h18v5H3zM3 17h18v4H3z"/><path data-library-accent="" d="M6 4.500h3v2H6z"/></>,
  import: <><path d="M4 15v6h16v-6M12 3v12M7 10l5 5 5-5"/><path data-library-accent="" d="M10 17.500h4v2h-4z"/></>,
  export: <><path d="M4 15v6h16v-6M12 15V3M7 8l5-5 5 5"/><path data-library-accent="" d="M10 17.500h4v2h-4z"/></>,
  filters: <><path d="M3 6h18M6 12h12M10 18h4"/><path data-library-accent="" d="M15 3.500h4v5h-4z"/></>,
  qr: <><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM19 19h2v2h-2z"/><path data-library-accent="" d="M5.500 5.500h2v2h-2z"/></>,
  publish: <><path d="M3 11l18-8-8 18-2.500-7.500z"/><circle data-library-accent="" cx="10" cy="14" r="1.600"/></>,
  arrow: <><path d="M3 12h17M14 6l6 6-6 6"/></>,
  copy: <><path d="M8 8h13v13H8zM4 16V3h13"/></>,
  chev: <><path d="M9 5l7 7-7 7"/></>,
};
const aliases: Record<string, string> = { transactions: "records", configuration: "records", recommendations: "similar", policies: "records", clock: "pending", arrowRight: "arrow", chevronRight: "chev" };

/** Existing drawings can supply less common meanings without importing an entire icon pack. */
export const LibraryIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement> & { name: string; fallback?: ReactNode }>(
  ({ name, fallback, className, children, ...props }, ref) => <svg ref={ref} width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="square" strokeLinejoin="miter" aria-hidden={props["aria-label"] ? undefined : true} focusable="false" {...props} className={cn("library-icon", className)}>
    {glyphs[aliases[name] || name] || fallback || glyphs.records}{children}
  </svg>,
);
LibraryIcon.displayName = "LibraryIcon";

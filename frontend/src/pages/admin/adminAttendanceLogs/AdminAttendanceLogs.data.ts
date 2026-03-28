import { LogIn, LogOut, TrendingUp } from "lucide-react";
import type { AttendanceLog, AttendanceStats, FilterType, FormattedTime } from "./AdminAttendanceLogs.types";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAGE_SIZE = 50;

export const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all",       label: "All"      },
  { value: "check_in",  label: "Time In"  },
  { value: "check_out", label: "Time Out" },
];

export const STAT_CARDS = (stats: AttendanceStats) => [
  {
    key:   "checkIns",
    icon:  LogIn,
    value: stats.checkIns,
    label: "Time In",
  },
  {
    key:   "checkOuts",
    icon:  LogOut,
    value: stats.checkOuts,
    label: "Time Out",
  },
  {
    key:       "inside",
    icon:      TrendingUp,
    value:     Math.max(0, stats.currentlyInside),
    label:     "Inside Now",
    highlight: true,
  },
] as const;

export const TABLE_HEADERS = ["Name / ID", "Role", "Type", "Time"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const formatTimestamp = (iso: string): FormattedTime => {
  const d = new Date(iso);
  return {
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  };
};

export const formatTodayLabel = (): string =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
    year:    "numeric",
  });

export const deriveStats = (logs: AttendanceLog[]): AttendanceStats => {
  const checkIns  = logs.filter((l) => l.type === "check_in").length;
  const checkOuts = logs.filter((l) => l.type === "check_out").length;
  return { checkIns, checkOuts, currentlyInside: checkIns - checkOuts };
};

export const applyFilters = (
  logs: AttendanceLog[],
  filter: FilterType,
  search: string,
): AttendanceLog[] => {
  const q = search.toLowerCase();
  return logs.filter((l) => {
    const matchType   = filter === "all" || l.type === filter;
    const matchSearch =
      !q ||
      l.name.toLowerCase().includes(q) ||
      l.student_employee_id.toLowerCase().includes(q);
    return matchType && matchSearch;
  });
};
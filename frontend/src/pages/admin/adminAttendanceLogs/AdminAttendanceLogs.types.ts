// ─── Domain Types ─────────────────────────────────────────────────────────────

export interface AttendanceLog {
  id: number;
  type: "check_in" | "check_out";
  timestamp: string;
  name: string;
  student_employee_id: string;
  role: string;
}

export type FilterType = "all" | "check_in" | "check_out";

// ─── Derived / View Types ─────────────────────────────────────────────────────

export interface AttendanceStats {
  checkIns: number;
  checkOuts: number;
  currentlyInside: number;
}

export interface FormattedTime {
  time: string;
  date: string;
}

// ─── Fetch State ──────────────────────────────────────────────────────────────

export interface FetchState {
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
}
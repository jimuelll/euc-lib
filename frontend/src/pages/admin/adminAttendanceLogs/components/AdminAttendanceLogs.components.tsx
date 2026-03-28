import { ChevronDown, Clock, AlertTriangle, Loader2, LogIn, LogOut, Search } from "lucide-react";
import type { AttendanceLog, AttendanceStats, FilterType } from "../AdminAttendanceLogs.types";
import {
  FILTER_OPTIONS,
  STAT_CARDS,
  TABLE_HEADERS,
  formatTimestamp,
} from "../AdminAttendanceLogs.data";

// ─── Shared style token ───────────────────────────────────────────────────────

const LABEL_CLS = "text-[10px] font-bold uppercase tracking-[0.18em]";
const FONT      = { fontFamily: "var(--font-heading)" };

// ─── Stats Strip ─────────────────────────────────────────────────────────────

interface StatsStripProps {
  stats: AttendanceStats;
  loading: boolean;
}

export const StatsStrip = ({ stats, loading }: StatsStripProps) => (
  <div className="grid grid-cols-3 border border-border">
    {STAT_CARDS(stats).map((card, i) => {
      const Icon = card.icon;
      return (
        <div
          key={card.key}
          className={`flex flex-col items-center justify-center gap-1 px-4 py-6 ${
            i < 2 ? "border-r border-border" : ""
          }`}
        >
          <Icon className={`h-5 w-5 mb-1 ${"highlight" in card && card.highlight ? "text-warning" : "text-muted-foreground"}`} />
          <span
            className="text-3xl font-bold text-foreground tabular-nums"
            style={FONT}
          >
            {loading ? "—" : card.value}
          </span>
          <span
            className={`${LABEL_CLS} text-muted-foreground/50`}
            style={FONT}
          >
            {card.label}
          </span>
        </div>
      );
    })}
  </div>
);

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface FilterBarProps {
  filter: FilterType;
  search: string;
  onFilterChange: (f: FilterType) => void;
  onSearchChange: (s: string) => void;
}

export const FilterBar = ({ filter, search, onFilterChange, onSearchChange }: FilterBarProps) => (
  <div className="flex flex-col sm:flex-row gap-3">
    {/* Type tabs */}
    <div className="flex border border-border shrink-0">
      {FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onFilterChange(opt.value)}
          className={`px-4 py-2.5 ${LABEL_CLS} border-r last:border-r-0 border-border transition-colors ${
            filter === opt.value
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted"
          }`}
          style={FONT}
        >
          {opt.label}
        </button>
      ))}
    </div>

    {/* Search */}
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by name or ID…"
        className="w-full border border-border bg-background pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary transition-colors"
      />
    </div>
  </div>
);

// ─── Table Header ─────────────────────────────────────────────────────────────

export const TableHeader = () => (
  <div className="bg-primary">
    <div className="h-[2px] w-full bg-warning" />
    <div className="grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[2fr_1fr_1fr_auto] px-4 sm:px-6 py-3 gap-4">
      {TABLE_HEADERS.map((h) => (
        <span
          key={h}
          className={`${LABEL_CLS} text-primary-foreground/40`}
          style={FONT}
        >
          {h}
        </span>
      ))}
    </div>
  </div>
);

// ─── Table Row ────────────────────────────────────────────────────────────────

interface TableRowProps {
  log: AttendanceLog;
  index: number;
}

export const TableRow = ({ log, index }: TableRowProps) => {
  const { time, date } = formatTimestamp(log.timestamp);
  const isIn = log.type === "check_in";

  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[2fr_1fr_1fr_auto] items-center px-4 sm:px-6 py-3.5 gap-4 transition-colors hover:bg-muted/30 ${
        index % 2 !== 0 ? "bg-muted/10" : ""
      }`}
    >
      {/* Name / ID */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{log.name}</p>
        <p className="text-[11px] font-mono text-muted-foreground/50 truncate">
          {log.student_employee_id}
        </p>
      </div>

      {/* Role */}
      <span
        className={`${LABEL_CLS} tracking-[0.12em] text-muted-foreground/50 hidden sm:block`}
        style={FONT}
      >
        {log.role}
      </span>

      {/* Type badge */}
      <div className="flex items-center gap-1.5">
        {isIn ? (
          <LogIn className="h-3.5 w-3.5 text-foreground/60 shrink-0" />
        ) : (
          <LogOut className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        )}
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.12em] hidden sm:block ${
            isIn ? "text-foreground/70" : "text-muted-foreground/40"
          }`}
          style={FONT}
        >
          {isIn ? "In" : "Out"}
        </span>
      </div>

      {/* Time */}
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-foreground tabular-nums" style={FONT}>
          {time}
        </p>
        <p className="text-[10px] text-muted-foreground/40 hidden sm:block">{date}</p>
      </div>
    </div>
  );
};

// ─── Empty / Loading / Error States ──────────────────────────────────────────

export const LoadingState = () => (
  <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground bg-background">
    <Loader2 className="h-5 w-5 animate-spin" />
    <span className={`${LABEL_CLS}`} style={FONT}>Loading…</span>
  </div>
);

export const ErrorState = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center gap-3 py-20 text-destructive/70 bg-background">
    <AlertTriangle className="h-5 w-5" />
    <span className="text-sm">{message}</span>
  </div>
);

interface EmptyStateProps {
  isFiltered: boolean;
}

export const EmptyState = ({ isFiltered }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-2 py-20 bg-background">
    <Clock className="h-8 w-8 text-muted-foreground/20" />
    <p className={`${LABEL_CLS} text-muted-foreground/30`} style={FONT}>
      {isFiltered ? "No matching records" : "No entries yet today"}
    </p>
  </div>
);

// ─── Load More / Footer ───────────────────────────────────────────────────────

interface LoadMoreProps {
  loadingMore: boolean;
  onLoadMore: () => void;
}

export const LoadMoreButton = ({ loadingMore, onLoadMore }: LoadMoreProps) => (
  <div className="border-t border-border bg-background">
    <button
      onClick={onLoadMore}
      disabled={loadingMore}
      className={`w-full flex items-center justify-center gap-2 py-3.5 ${LABEL_CLS} text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-40`}
      style={FONT}
    >
      {loadingMore ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ChevronDown className="h-3.5 w-3.5" />
      )}
      {loadingMore ? "Loading…" : "Load More"}
    </button>
  </div>
);

interface TableFooterProps {
  visibleCount: number;
  totalCount: number;
  isFiltered: boolean;
}

export const TableFooter = ({ visibleCount, totalCount, isFiltered }: TableFooterProps) => (
  <div className="border-t border-border bg-muted/10 px-4 sm:px-6 py-3">
    <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em]" style={FONT}>
      Showing {visibleCount} {visibleCount === 1 ? "record" : "records"}
      {isFiltered && ` · filtered from ${totalCount} total`}
    </p>
  </div>
);
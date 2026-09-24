import { Search, RefreshCw } from "lucide-react";
import { FILTER_OPTIONS } from "../reservations.types";

interface ReservationsToolbarProps {
  search:         string;
  statusFilter:   string;
  loading:        boolean;
  showArchived:   boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onRefresh:      () => void;
}

const ReservationsToolbar = ({
  search, statusFilter, loading, showArchived,
  onSearchChange, onStatusChange, onRefresh,
}: ReservationsToolbarProps) => (
  <div className="flex flex-col xl:flex-row gap-0 border border-border">

    {/* Search */}
    <div className="relative flex-1">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/35 pointer-events-none" />
      <input
        aria-label="Search reservations"
        placeholder="Search by student ID, name, or book title…"
        className="h-11 w-full border-b border-border bg-background pl-10 pr-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary md:text-sm xl:border-b-0 xl:border-r"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>

    {/* Status filter — hidden in archived mode (all archived records are terminal) */}
    {!showArchived && (
      <div className="flex items-center gap-0 overflow-x-auto border-b xl:border-b-0 xl:border-r border-border">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatusChange(opt.value)}
            aria-pressed={statusFilter === opt.value}
            className={`h-11 shrink-0 border-r border-border px-3.5 text-sm font-semibold transition-colors last:border-r-0 ${
              statusFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )}

    {/* Refresh */}
    <button
      onClick={onRefresh}
      disabled={loading}
      className="flex h-11 w-full items-center justify-center border-t border-border text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground disabled:opacity-40 xl:w-10 xl:border-t-0"
      title="Refresh"
      aria-label="Refresh reservations"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
    </button>
  </div>
);

export default ReservationsToolbar;

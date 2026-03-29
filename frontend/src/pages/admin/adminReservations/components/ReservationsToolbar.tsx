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
  <div className="flex flex-col sm:flex-row gap-0 border border-border">

    {/* Search */}
    <div className="relative flex-1">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/35 pointer-events-none" />
      <input
        placeholder="Search by student ID, name, or book title…"
        className="w-full h-9 pl-10 pr-4 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 outline-none border-b sm:border-b-0 sm:border-r border-border focus:border-primary transition-colors"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>

    {/* Status filter — hidden in archived mode (all archived records are terminal) */}
    {!showArchived && (
      <div className="flex items-center gap-0 overflow-x-auto border-b sm:border-b-0 sm:border-r border-border">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatusChange(opt.value)}
            className={`h-9 px-3.5 text-[10px] font-bold uppercase tracking-[0.12em] shrink-0 border-r last:border-r-0 border-border transition-colors ${
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
      className="flex items-center justify-center h-9 w-full sm:w-9 border-t sm:border-t-0 border-border text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 disabled:opacity-40 transition-colors"
      title="Refresh"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
    </button>
  </div>
);

export default ReservationsToolbar;
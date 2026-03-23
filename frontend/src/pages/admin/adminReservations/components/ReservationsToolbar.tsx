import { Search, Filter, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FILTER_OPTIONS } from "../reservations.types";

interface ReservationsToolbarProps {
  search:       string;
  statusFilter: string;
  loading:      boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onRefresh:    () => void;
}

const ReservationsToolbar = ({
  search,
  statusFilter,
  loading,
  onSearchChange,
  onStatusChange,
  onRefresh,
}: ReservationsToolbarProps) => (
  <div className="flex flex-col sm:flex-row gap-3">

    {/* Search input */}
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        placeholder="Search by student ID, name, or book title…"
        className="pl-9 h-9 text-sm"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>

    {/* Status filter pills */}
    <div className="flex items-center gap-1.5 flex-wrap">
      <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onStatusChange(opt.value)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
            statusFilter === opt.value
              ? "bg-foreground text-background border-foreground"
              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>

    {/* Refresh */}
    <Button
      size="sm"
      variant="outline"
      className="h-9 shrink-0"
      onClick={onRefresh}
      disabled={loading}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
    </Button>
  </div>
);

export default ReservationsToolbar;
import { useState, useEffect, useCallback } from "react";
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getCirculationLog } from "../circulation.api";
import type { CirculationLogEntry } from "../circulation.api";
import { useDebounce } from "@/hooks/use-debounce";

const statusConfig: Record<
  CirculationLogEntry["status"],
  { label: string; className: string }
> = {
  borrowed: { label: "Active",   className: "border-info/30 text-info bg-info/5"               },
  overdue:  { label: "Overdue",  className: "border-destructive/30 text-destructive bg-destructive/5" },
  returned: { label: "Returned", className: "border-success/30 text-success bg-success/5"       },
};

const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span
    className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${className ?? ""}`}
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {children}
  </span>
);

const ColHeader = ({ children }: { children: React.ReactNode }) => (
  <th className="px-4 py-2.5 text-left">
    <span
      className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {children}
    </span>
  </th>
);

const CirculationLog = () => {
  const [rows,       setRows]       = useState<CirculationLogEntry[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,       setPage]       = useState(1);
  const [status,     setStatus]     = useState("all");
  const [search,     setSearch]     = useState("");
  const [loading,    setLoading]    = useState(false);

  const debouncedSearch = useDebounce(search, 400);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCirculationLog({
        status: status === "all" ? undefined : status,
        search: debouncedSearch || undefined,
        page,
        limit:  20,
      });
      setRows(result.rows);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, debouncedSearch, page]);

  useEffect(() => { fetchLog(); }, [fetchLog]);
  useEffect(() => { setPage(1); }, [status, debouncedSearch]);

  return (
    <div className="mt-8 space-y-0">

      {/* ── Section header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 border border-border border-b-0 px-5 py-3 bg-muted/30">
        <div className="flex items-center gap-2.5">
          <div className="h-px w-4 bg-warning shrink-0" />
          <h3
            className="text-[10px] font-bold uppercase tracking-[0.25em] text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Circulation Log
          </h3>
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {total} records
        </span>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="flex gap-0 border border-border border-b-0">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/35 pointer-events-none" />
          <input
            placeholder="Search user, book, ISBN…"
            className="w-full h-9 pl-10 pr-4 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 outline-none border-r border-border focus:border-r-primary transition-colors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter */}
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-36 rounded-none border-0 border-l-0 text-[11px] font-bold uppercase tracking-[0.12em] bg-background focus:ring-0 px-3 shrink-0"
            style={{ fontFamily: "var(--font-heading)" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none border-border">
            {[
              { value: "all",      label: "All"      },
              { value: "borrowed", label: "Active"   },
              { value: "overdue",  label: "Overdue"  },
              { value: "returned", label: "Returned" },
            ].map(({ value, label }) => (
              <SelectItem
                key={value}
                value={value}
                className="rounded-none text-[11px] font-bold uppercase tracking-[0.12em]"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className="border border-border overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <ColHeader>User</ColHeader>
              <ColHeader>Book</ColHeader>
              <ColHeader>Borrowed</ColHeader>
              <ColHeader>Due</ColHeader>
              <ColHeader>Returned</ColHeader>
              <ColHeader>Issued by</ColHeader>
              <ColHeader>Status</ColHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-primary/40" />
                    <span
                      className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      Loading…
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <span
                    className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/35"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    No records found
                  </span>
                </td>
              </tr>
            )}

            {!loading && rows.map((row) => {
              const cfg = statusConfig[row.status];
              return (
                <tr key={row.id} className="hover:bg-muted/15 transition-colors">
                  {/* User */}
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground leading-tight">{row.user_name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/50">{row.student_employee_id}</p>
                  </td>

                  {/* Book */}
                  <td className="px-4 py-3 max-w-[180px]">
                    <p className="text-sm font-medium text-foreground truncate leading-tight">{row.book_title}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/50 truncate">{row.isbn ?? "—"}</p>
                  </td>

                  {/* Borrowed */}
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(row.borrowed_at).toLocaleDateString()}
                  </td>

                  {/* Due */}
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(row.due_date).toLocaleDateString()}
                  </td>

                  {/* Returned */}
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {row.returned_at
                      ? new Date(row.returned_at).toLocaleDateString()
                      : <span className="text-muted-foreground/30">—</span>
                    }
                  </td>

                  {/* Issued by */}
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {row.issued_by_name ?? <span className="text-muted-foreground/30">—</span>}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge className={cfg.className}>{cfg.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border border-border border-t-0 px-4 py-2.5 bg-muted/10">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-0 border border-border overflow-hidden">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center justify-center h-7 w-7 border-r border-border text-muted-foreground hover:bg-muted/40 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center justify-center h-7 w-7 text-muted-foreground hover:bg-muted/40 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CirculationLog;
import { useState, useEffect, useCallback } from "react";
import { Loader2, Search, ChevronLeft, ChevronRight, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { getCirculationLog, archiveBorrowing, restoreBorrowing } from "../circulation.api";
import type { CirculationLogEntry } from "../circulation.api";
import { useDebounce } from "@/hooks/use-debounce";
import { useAdminConfirmDialog } from "../../components/useAdminConfirmDialog";

const statusConfig: Record<
  CirculationLogEntry["status"],
  { label: string; className: string }
> = {
  borrowed: { label: "Active",   className: "border-info/30 text-info bg-info/5"                     },
  overdue:  { label: "Overdue",  className: "border-destructive/30 text-destructive bg-destructive/5" },
  returned: { label: "Returned", className: "border-success/30 text-success bg-success/5"             },
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
  const [rows,         setRows]         = useState<CirculationLogEntry[]>([]);
  const [total,        setTotal]        = useState(0);
  const [totalPages,   setTotalPages]   = useState(1);
  const [page,         setPage]         = useState(1);
  const [status,       setStatus]       = useState("all");
  const [search,       setSearch]       = useState("");
  const [loading,      setLoading]      = useState(false);
  const [showArchived, setShowArchived] = useState(false);  // ← NEW
  const [actionId,     setActionId]     = useState<number | null>(null); // tracks which row is mid-action
  const { confirm, confirmDialog } = useAdminConfirmDialog();

  const debouncedSearch = useDebounce(search, 400);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCirculationLog({
        status:   status === "all" ? undefined : status,
        search:   debouncedSearch || undefined,
        page,
        limit:    20,
        archived: showArchived || undefined,
      });
      setRows(result.rows);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, debouncedSearch, page, showArchived]);

  useEffect(() => { fetchLog(); }, [fetchLog]);
  useEffect(() => { setPage(1); }, [status, debouncedSearch, showArchived]);

  // ── Toggle archived — resets page & clears selection ─────────────────────
  const handleToggleArchived = () => {
    setShowArchived((prev) => !prev);
    setPage(1);
  };

  // ── Archive a returned borrowing record ───────────────────────────────────
  const handleArchive = async (row: CirculationLogEntry) => {
    const shouldArchive = await confirm({
      title: `Archive "${row.book_title}" record?`,
      description: "The borrowing record will be removed from the active circulation log until restored.",
      actionLabel: "Archive Record",
      tone: "danger",
    });
    if (!shouldArchive) return;
    setActionId(row.id);
    try {
      await archiveBorrowing(row.id);
      toast.success("Borrowing record archived");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setTotal((t) => t - 1);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to archive record");
    } finally {
      setActionId(null);
    }
  };

  // ── Restore a soft-deleted borrowing record ───────────────────────────────
  const handleRestore = async (row: CirculationLogEntry) => {
    const shouldRestore = await confirm({
      title: `Restore "${row.book_title}" record?`,
      description: "The borrowing record will return to the active circulation log.",
      actionLabel: "Restore Record",
    });
    if (!shouldRestore) return;
    setActionId(row.id);
    try {
      await restoreBorrowing(row.id);
      toast.success("Borrowing record restored");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setTotal((t) => t - 1);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to restore record");
    } finally {
      setActionId(null);
    }
  };

  const colSpan = showArchived ? 8 : 8; // keeps consistent (action column always present)

  return (
    <div className="mt-8 space-y-0">
      {confirmDialog}

      {/* ── Section header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 border border-border border-b-0 px-5 py-3 bg-muted/30">
        <div className="flex items-center gap-2.5">
          <div className="h-px w-4 bg-warning shrink-0" />
          <h3
            className="text-[10px] font-bold uppercase tracking-[0.25em] text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {showArchived ? "Archived Records" : "Circulation Log"}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {total} records
          </span>
          {/* ── Archived toggle ── */}
          <button
            onClick={handleToggleArchived}
            title={showArchived ? "Showing archived — click for active" : "Show archived records"}
            className={`flex items-center gap-1.5 border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${
              showArchived
                ? "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
                : "border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <Archive className="h-3 w-3" />
            {showArchived ? "Archived" : "Active"}
          </button>
        </div>
      </div>

      {/* Archived banner */}
      {showArchived && (
        <div className="flex items-center gap-2.5 px-4 py-2 bg-warning/5 border border-t-0 border-b-0 border-warning/20">
          <Archive className="h-3 w-3 text-warning/60 shrink-0" />
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-warning/70"
            style={{ fontFamily: "var(--font-heading)" }}>
            Showing archived records — restore to make them visible in the active log
          </p>
        </div>
      )}

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

        {/* Status filter — hidden in archived mode since all archived records are returned */}
        {!showArchived && (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger
              className="h-9 w-36 rounded-none border-0 border-l-0 text-[11px] font-bold uppercase tracking-[0.12em] bg-background focus:ring-0 px-3 shrink-0"
              style={{ fontFamily: "var(--font-heading)" }}
            >
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
        )}
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
                <td colSpan={8} className="px-4 py-10 text-center">
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
                <td colSpan={8} className="px-4 py-10 text-center">
                  <span
                    className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/35"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {showArchived ? "No archived records found" : "No records found"}
                  </span>
                </td>
              </tr>
            )}

            {!loading && rows.map((row) => {
              const cfg        = statusConfig[row.status];
              const isActioning = actionId === row.id;

              return (
                <tr
                  key={row.id}
                  className={`transition-colors hover:bg-muted/15 ${showArchived ? "opacity-70" : ""}`}
                >
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

                  {/* Action column */}
                  <td className="px-4 py-3">
                    {showArchived ? (
                      // ── Restore button ──
                      <button
                        onClick={() => handleRestore(row)}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 border border-warning/40 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-warning hover:bg-warning hover:text-warning-foreground disabled:opacity-40 transition-colors"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {isActioning
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <ArchiveRestore className="h-3 w-3" />
                        }
                        Restore
                      </button>
                    ) : (
                      // ── Archive button — only for returned records ──
                      row.status === "returned" ? (
                        <button
                          onClick={() => handleArchive(row)}
                          disabled={isActioning}
                          className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50 hover:border-destructive/40 hover:text-destructive disabled:opacity-40 transition-colors"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          {isActioning
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Trash2 className="h-3 w-3" />
                          }
                          Archive
                        </button>
                      ) : (
                        <span className="text-muted-foreground/20 text-[10px]">—</span>
                      )
                    )}
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


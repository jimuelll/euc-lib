import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { getCirculationLog } from "../circulation.api";
import type { CirculationLogEntry } from "../circulation.api";
import { useDebounce } from "@/hooks/use-debounce";

const statusConfig: Record<
  CirculationLogEntry["status"],
  { label: string; className: string }
> = {
  borrowed: { label: "Active",   className: "bg-info/10 text-info border-info/20" },
  overdue:  { label: "Overdue",  className: "bg-destructive/10 text-destructive border-destructive/20" },
  returned: { label: "Returned", className: "bg-success/10 text-success border-success/20" },
};

const CirculationLog = () => {
  const [rows, setRows]           = useState<CirculationLogEntry[]>([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]           = useState(1);
  const [status, setStatus]       = useState("all");
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(false);

  const debouncedSearch = useDebounce(search, 400);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCirculationLog({
        status:  status === "all" ? undefined : status,
        search:  debouncedSearch || undefined,
        page,
        limit:   20,
      });
      setRows(result.rows);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch {
      // silently show empty state
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, debouncedSearch, page]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [status, debouncedSearch]);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold text-foreground">
          Circulation Log
        </h3>
        <span className="text-xs text-muted-foreground">{total} records</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search user, book, ISBN..."
            className="pl-8 h-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-32 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="borrowed">Active</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2.5 font-medium text-muted-foreground">User</th>
              <th className="px-3 py-2.5 font-medium text-muted-foreground">Book</th>
              <th className="px-3 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Borrowed</th>
              <th className="px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Due</th>
              <th className="px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Returned</th>
              <th className="px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Issued by</th>
              <th className="px-3 py-2.5 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No records found.
                </td>
              </tr>
            )}
            {!loading && rows.map((row) => {
              const cfg = statusConfig[row.status];
              return (
                <tr key={row.id} className="border-t hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">{row.user_name}</p>
                    <p className="text-muted-foreground">{row.student_employee_id}</p>
                  </td>
                  <td className="px-3 py-2.5 max-w-[160px]">
                    <p className="font-medium text-foreground truncate">{row.book_title}</p>
                    <p className="text-muted-foreground truncate">{row.isbn ?? "—"}</p>
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell text-muted-foreground">
                    {new Date(row.borrowed_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">
                    {new Date(row.due_date).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">
                    {row.returned_at
                      ? new Date(row.returned_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground">
                    {row.issued_by_name ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className={cfg.className}>
                      {cfg.label}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CirculationLog;
import { useEffect, useState, type FormEvent } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPage, AdminPanel, AdminStatCard, AdminStatGrid } from "./components/AdminPage";
import { getCirculationLog, type CirculationLogEntry, type CirculationLogResult, type CirculationLogSummary } from "./adminCirculation/circulation.api";
const emptySummary: CirculationLogSummary = {
  total_records: 0,
  borrowed_count: 0,
  overdue_count: 0,
  returned_count: 0,
  unique_borrowers: 0,
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const AdminReport = () => {
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [summary, setSummary] = useState<CirculationLogSummary>(emptySummary);
  const [rows, setRows] = useState<CirculationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    try {
      const result: CirculationLogResult = await getCirculationLog({
        status: status === "all" ? undefined : status,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page: 1,
        limit: 50,
      });

      setRows(result.rows);
      setSummary(result.summary ?? emptySummary);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadReport();
  };

  return (
    <AdminPage
      eyebrow="Reports"
      title="Circulation Report"
      description="Filter circulation activity by borrowing date and status, then review the resulting summary and transaction list."
      contentWidth="wide"
      actions={
        <Button type="button" variant="outline" className="rounded-none" onClick={() => void loadReport()} disabled={loading}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Report
        </Button>
      }
    >
      <AdminPanel title="Filters" description="Choose a circulation status and optional borrowing date range.">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="report-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="report-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="borrowed">Borrowed</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-from">After this date</Label>
              <Input id="report-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-to">Before this date</Label>
              <Input id="report-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
          </div>

          <div className="flex justify-end border-t border-border/70 pt-4">
            <Button type="submit" disabled={loading}>Run report</Button>
          </div>
        </form>
      </AdminPanel>

      <AdminStatGrid>
        <AdminStatCard label="Records" value={String(summary.total_records)} helperText="Transactions matching the selected report filter." />
        <AdminStatCard label="Borrowed" value={String(summary.borrowed_count)} helperText="Currently active borrowed records in this report." />
        <AdminStatCard label="Overdue" value={String(summary.overdue_count)} helperText="Overdue records in the filtered timeframe." />
        <AdminStatCard label="Returned" value={String(summary.returned_count)} helperText={`${summary.unique_borrowers} unique borrower(s) included.`} />
      </AdminStatGrid>

      <AdminPanel title="Results" description="The latest 50 matching circulation records from the current data.">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {["Student", "Book", "Borrowed At", "Due At", "Returned At", "Status"].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/70 last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{row.user_name}</div>
                      <div className="text-xs text-muted-foreground">{row.student_employee_id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{row.book_title}</div>
                      <div className="text-xs text-muted-foreground">{row.copy_barcode ?? row.isbn ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.borrowed_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.due_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.returned_at)}</td>
                    <td className="px-4 py-3 text-foreground">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">No circulation records matched the selected filters.</p>
          </div>
        )}
      </AdminPanel>
    </AdminPage>
  );
};

export default AdminReport;

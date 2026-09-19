import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Download, ExternalLink, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/utils/apiError";
import { downloadReportCsv, fetchReport, type QueryReport, type ReportFilters, type ReportResult } from "./api";
import { formatQueryValue } from "./format";

const reports: Array<{ value: QueryReport; label: string; description: string; ranking?: boolean }> = [
  { value: "fined", label: "Fined", description: "Charges, payments, adjustments, and outstanding balances." },
  { value: "daily_users", label: "Daily Library Users", description: "Unique patrons and physical check-ins by day." },
  { value: "date_due", label: "Date Due", description: "Current loans due within the selected period." },
  { value: "top_users", label: "Top 10 Users", description: "Rank patrons by borrowing or library check-ins.", ranking: true },
  { value: "daily_stats", label: "Statistics for Daily Users", description: "Daily attendance trend with average visits per patron." },
  { value: "resource_usage", label: "Statistics for Resource Usage", description: "Borrowing demand by title and book type." },
];
const emptyFilters = (report: QueryReport): ReportFilters => ({ report, search: "", dateFrom: "", dateTo: "", ranking: report === "top_users" ? "borrowings" : "" });
const number = new Intl.NumberFormat("en-PH");

export default function ReportWorkspace() {
  const [draft, setDraft] = useState<ReportFilters>(emptyFilters("fined"));
  const [applied, setApplied] = useState<ReportFilters>(emptyFilters("fined"));
  const [result, setResult] = useState<ReportResult | null>(null); const [loading, setLoading] = useState(true); const [exporting, setExporting] = useState(false); const [error, setError] = useState("");
  const selected = reports.find((item) => item.value === draft.report) ?? reports[0];
  const changed = JSON.stringify(draft) !== JSON.stringify(applied);
  const load = useCallback(async (filters: ReportFilters, page = 1) => { setLoading(true); setError(""); try { setResult(await fetchReport({ ...filters, page, limit: 25 })); } catch (failure) { setResult(null); setError(getApiErrorMessage(failure, "Unable to load this report.")); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(applied); }, [load, applied]);
  const update = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const run = (event: FormEvent) => { event.preventDefault(); if (draft.dateFrom && draft.dateTo && String(draft.dateFrom) > String(draft.dateTo)) { setError("The start date must be on or before the end date."); return; } setApplied({ ...draft }); };
  const choose = (report: QueryReport) => { const next = emptyFilters(report); setDraft(next); setApplied(next); };
  const reset = () => { const next = emptyFilters(draft.report); setDraft(next); setApplied(next); };
  const previewUrl = useMemo(() => { const params = new URLSearchParams(); Object.entries(applied).forEach(([key, value]) => { if (value) params.set(key, String(value)); }); return `/admin/query/reports/preview?${params.toString()}`; }, [applied]);
  const download = async () => { setExporting(true); setError(""); try { await downloadReportCsv(applied); } catch (failure) { setError(getApiErrorMessage(failure, "Unable to download this report.")); } finally { setExporting(false); } };
  return <div className="space-y-5">
    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Run operational reports for fines, attendance, due dates, patron activity, and collection usage.</p>
    {error && <div role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
    <form onSubmit={run} className="border-y border-border bg-muted/20 px-3 py-4 sm:px-5"><div className="grid gap-3 md:grid-cols-[minmax(15rem,0.8fr)_minmax(14rem,1fr)_auto] md:items-end">
      <div className="space-y-1.5"><Label htmlFor="report-type" className="text-xs font-medium text-muted-foreground">Report type</Label><Select value={draft.report} onValueChange={(value) => choose(value as QueryReport)}><SelectTrigger id="report-type" className="h-11 rounded-none bg-background"><SelectValue /></SelectTrigger><SelectContent>{reports.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label htmlFor="report-search" className="text-xs font-medium text-muted-foreground">Search</Label><div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="report-search" value={String(draft.search ?? "")} onChange={(event) => update("search", event.target.value)} className="h-11 rounded-none bg-background pl-10" placeholder="Search this report…" /></div></div>
      <Button type="submit" className="h-11 rounded-none"><Search className="mr-2 h-4 w-4" />Run report</Button></div>
      <div className="mt-4 grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-2 lg:grid-cols-4"><div className="space-y-1.5"><Label htmlFor="report-date-from" className="text-xs font-medium text-muted-foreground">Start date</Label><Input id="report-date-from" type="date" value={String(draft.dateFrom ?? "")} onChange={(event) => update("dateFrom", event.target.value)} className="h-11 rounded-none bg-background" /></div><div className="space-y-1.5"><Label htmlFor="report-date-to" className="text-xs font-medium text-muted-foreground">End date</Label><Input id="report-date-to" type="date" value={String(draft.dateTo ?? "")} onChange={(event) => update("dateTo", event.target.value)} className="h-11 rounded-none bg-background" /></div>{selected.ranking && <div className="space-y-1.5"><Label htmlFor="report-ranking" className="text-xs font-medium text-muted-foreground">Rank users by</Label><Select value={String(draft.ranking)} onValueChange={(value) => update("ranking", value)}><SelectTrigger id="report-ranking" className="h-11 rounded-none bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="borrowings">Most borrowings</SelectItem><SelectItem value="checkins">Most library check-ins</SelectItem></SelectContent></Select></div>}<div className="flex items-end justify-end"><Button type="button" variant="ghost" className="rounded-none" onClick={reset}>Reset filters</Button></div></div><p className="mt-3 text-xs text-muted-foreground">{selected.description}</p></form>
    <section className="admin-panel-surface admin-etched-border overflow-hidden border border-border bg-card" aria-busy={loading}><div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{selected.label}</h2><p className="mt-1 text-xs text-muted-foreground">{loading ? "Loading report…" : `${number.format(result?.pagination?.total ?? 0)} matching rows`}{changed ? " · Run the report to apply changes" : ""}</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" className="rounded-none" disabled={loading || !result} onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="mr-2 h-4 w-4" />Preview CSV</Button><Button type="button" variant="outline" size="sm" className="rounded-none" disabled={loading || !result || exporting} onClick={() => void download()}>{exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download CSV</Button></div></div>
      {loading ? <div className="space-y-2 p-4">{[0,1,2,3,4].map((item) => <Skeleton key={item} className="h-12 w-full rounded-none" />)}</div> : result?.rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border bg-muted/30">{result.columns.map((column) => <th key={column.key} className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted-foreground">{column.label}</th>)}</tr></thead><tbody className="divide-y divide-border">{result.rows.map((row, index) => <tr key={index} className="hover:bg-muted/20">{result.columns.map((column) => <td key={column.key} className="max-w-[26rem] px-4 py-3 align-top">{formatQueryValue(row[column.key], column.type)}</td>)}</tr>)}</tbody></table></div> : <div className="px-5 py-12 text-center text-sm text-muted-foreground">No rows match this report. Adjust the dates or search.</div>}
      <div className="flex items-center justify-between border-t border-border bg-muted/15 px-4 py-3 text-sm text-muted-foreground"><span>{number.format(result?.pagination?.total ?? 0)} rows</span><div className="flex items-center gap-3"><Button type="button" variant="outline" size="sm" className="rounded-none" disabled={!result || loading || result.pagination?.page === 1} onClick={() => void load(applied, (result?.pagination?.page ?? 1) - 1)}>Previous</Button><span>Page {result?.pagination?.page ?? 1} of {result?.pagination?.totalPages ?? 1}</span><Button type="button" variant="outline" size="sm" className="rounded-none" disabled={!result || loading || (result.pagination?.page ?? 1) >= (result.pagination?.totalPages ?? 1)} onClick={() => void load(applied, (result?.pagination?.page ?? 1) + 1)}>Next</Button></div></div>
    </section>
  </div>;
}

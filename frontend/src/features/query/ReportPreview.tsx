import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Printer } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/utils/apiError";
import { downloadReportCsv, fetchReportPreview, type QueryReport, type ReportFilters } from "./api";
import { formatQueryGeneratedAt, formatQueryValue } from "./format";
import { queryKeys } from "./query.keys";

const valid = new Set<QueryReport>(["fined", "daily_users", "date_due", "top_users", "daily_stats", "resource_usage", "holdings_inventory"]);
const number = new Intl.NumberFormat("en-PH");

export default function ReportPreview() {
  const [params] = useSearchParams();
  const filters = useMemo(() => {
    const raw = Object.fromEntries(params.entries()) as ReportFilters;
    return { ...raw, report: valid.has(raw.report) ? raw.report : "fined" };
  }, [params]);
  const previewQuery = useQuery({
    queryKey: queryKeys.reportPreview(filters),
    queryFn: ({ signal }) => fetchReportPreview(filters, signal),
  });
  const result = previewQuery.data;
  const generated = previewQuery.dataUpdatedAt ? new Date(previewQuery.dataUpdatedAt) : null;
  const queryError = previewQuery.isError ? getApiErrorMessage(previewQuery.error, "Unable to prepare this preview.") : "";
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    setDownloading(true);
    setDownloadError("");
    try { await downloadReportCsv(filters); }
    catch (failure) { setDownloadError(getApiErrorMessage(failure, "Unable to download this report.")); }
    finally { setDownloading(false); }
  };

  return <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8"><div className="mx-auto max-w-[1600px] space-y-5">
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{result?.label ?? "Report"} preview</h1><p className="mt-2 text-sm text-muted-foreground">{generated ? `Generated ${formatQueryGeneratedAt(generated)} · ` : ""}{number.format(result?.rows.length ?? 0)} rows</p></div>
      <div className="flex gap-2 print:hidden"><Button variant="outline" className="rounded-none" onClick={() => window.print()} disabled={!result}><Printer className="mr-2 h-4 w-4" />Print</Button><Button className="rounded-none" disabled={!result || downloading} onClick={() => void download()}>{downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download CSV</Button></div>
    </header>
    {(queryError || downloadError) && <p role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{queryError || downloadError} {queryError && <Button type="button" variant="link" className="ml-2 h-auto p-0" onClick={() => void previewQuery.refetch()}>Try again</Button>}</p>}
    {previewQuery.isPending ? <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing preview…</div> : result && <section className="overflow-hidden border border-border bg-card"><div className="overflow-x-auto"><table className="admin-stack-results w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border bg-muted/30">{result.columns.map((column) => <th key={column.key} className="px-4 py-3 text-xs font-semibold text-muted-foreground">{column.label}</th>)}</tr></thead><tbody className="divide-y divide-border">{result.rows.map((row, index) => <tr key={index}>{result.columns.map((column) => <td data-mobile-label={column.label} key={column.key} className="px-4 py-3">{formatQueryValue(row[column.key], column.type)}</td>)}</tr>)}</tbody></table></div>{!result.rows.length && <p className="px-5 py-12 text-center text-sm text-muted-foreground">No rows match this report.</p>}</section>}
  </div></main>;
}

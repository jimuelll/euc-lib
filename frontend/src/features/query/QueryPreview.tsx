import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Printer } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/utils/apiError";
import { downloadQueryCsv, fetchQueryPreview, type QueryDataset, type QueryFilters } from "./api";
import { formatQueryGeneratedAt, formatQueryValue } from "./format";
import { queryKeys } from "./query.keys";

const datasets = new Set<QueryDataset>(["catalog", "users", "borrowings", "reservations", "attendance", "notifications", "subscriptions", "clearance"]);
const number = new Intl.NumberFormat("en-PH");

const QueryPreview = () => {
  const [params] = useSearchParams();
  const filters = useMemo(() => {
    const raw = Object.fromEntries(params.entries()) as QueryFilters;
    return { ...raw, dataset: datasets.has(raw.dataset) ? raw.dataset : "catalog" };
  }, [params]);
  const previewQuery = useQuery({
    queryKey: queryKeys.recordPreview(filters),
    queryFn: ({ signal }) => fetchQueryPreview(filters, signal),
  });
  const result = previewQuery.data;
  const error = previewQuery.isError ? getApiErrorMessage(previewQuery.error, "Unable to prepare this preview. Narrow the filters or try again.") : "";
  const loading = previewQuery.isPending;
  const generatedAt = previewQuery.dataUpdatedAt ? new Date(previewQuery.dataUpdatedAt) : null;
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const activeFilters = Object.entries(filters).filter(([key, value]) => !["dataset", "page", "limit"].includes(key) && Boolean(value) && String(value) !== "all");
  const download = async () => { setDownloading(true); setDownloadError(""); try { await downloadQueryCsv(filters); } catch (failure) { setDownloadError(getApiErrorMessage(failure, "Unable to download this CSV.")); } finally { setDownloading(false); } };

  return <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8 lg:px-12">
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl" style={{ fontFamily: "var(--font-heading)" }}>{result?.label ?? "Query"} preview</h1><p className="mt-2 text-sm text-muted-foreground">{generatedAt ? `Generated ${formatQueryGeneratedAt(generatedAt)} · ` : ""}{number.format(result?.rows.length ?? 0)} matching records</p></div>
        <div className="flex flex-wrap gap-2 print:hidden"><Button type="button" variant="outline" className="rounded-none" onClick={() => window.print()} disabled={!result}><Printer className="mr-2 h-4 w-4" />Print</Button><Button type="button" className="rounded-none" onClick={() => void download()} disabled={!result || downloading}>{downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download CSV</Button></div>
      </header>
      <p className="border-y border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">{activeFilters.length ? `Filters: ${activeFilters.map(([key, value]) => `${key}: ${value}`).join(" · ")}` : "All records"}</p>
      {(error || downloadError) && <p role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error || downloadError} {error && <Button type="button" variant="link" className="ml-2 h-auto p-0" onClick={() => void previewQuery.refetch()}>Try again</Button>}</p>}
      {loading ? <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing spreadsheet preview…</div> : result && <section className="admin-panel-surface admin-etched-border overflow-hidden border border-border bg-card"><div className="overflow-x-auto"><table className="admin-stack-results w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border bg-muted/30">{result.columns.map((column) => <th key={column.key} scope="col" className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted-foreground">{column.label}</th>)}</tr></thead><tbody className="divide-y divide-border">{result.rows.map((row, index) => <tr key={index}>{result.columns.map((column) => <td data-mobile-label={column.label} key={column.key} className="max-w-[26rem] px-4 py-3 align-top"><span className="block break-words">{formatQueryValue(row[column.key], column.type)}</span></td>)}</tr>)}</tbody></table></div>{!result.rows.length && <p className="px-5 py-12 text-center text-sm text-muted-foreground">No records match this query.</p>}</section>}
    </div>
  </main>;
};

export default QueryPreview;

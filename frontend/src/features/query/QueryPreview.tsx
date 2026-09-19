import { useEffect, useMemo, useState } from "react";
import { Download, Printer, RefreshCcw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/utils/apiError";
import { downloadQueryCsv, fetchQueryPreview, type QueryDataset, type QueryFilters, type QueryResult } from "./api";

const datasets = new Set<QueryDataset>(["catalog", "users", "borrowings", "reservations", "attendance", "notifications", "subscriptions"]);
const dateTime = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" });
const display = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);

const QueryPreview = () => {
  const [params] = useSearchParams(); const filters = useMemo(() => Object.fromEntries(params.entries()) as QueryFilters, [params]);
  const dataset = datasets.has(filters.dataset) ? filters.dataset : "catalog"; const activeFilters = { ...filters, dataset };
  const [result, setResult] = useState<QueryResult | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); void fetchQueryPreview(activeFilters).then(setResult).catch((failure) => setError(getApiErrorMessage(failure, "Unable to prepare this CSV preview."))).finally(() => setLoading(false)); }, [params]);
  const meaningfulFilters = Object.entries(activeFilters).filter(([key, value]) => !["dataset", "page", "limit"].includes(key) && Boolean(value) && String(value) !== "all");
  return <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-8 lg:px-12"><div className="mx-auto max-w-[1600px] space-y-6"><header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-3xl font-semibold tracking-[-0.03em]" style={{ fontFamily: "var(--font-heading)" }}>{result?.label ?? "Query"} CSV preview</h1><p className="mt-2 text-sm text-muted-foreground">Generated {dateTime.format(new Date())} · {result?.rows.length.toLocaleString() ?? 0} exported record(s)</p></div><div className="flex flex-wrap gap-2 print:hidden"><Button variant="outline" className="rounded-none" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button><Button className="rounded-none" onClick={() => void downloadQueryCsv(activeFilters)}><Download className="mr-2 h-4 w-4" />Download CSV</Button></div></header><div className="border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">{meaningfulFilters.length ? `Filters: ${meaningfulFilters.map(([key, value]) => `${key}: ${value}`).join(" · ")}` : "Filters: All records"}</div>{error ? <p role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}{loading ? <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground"><RefreshCcw className="mr-2 h-4 w-4 animate-spin" />Preparing spreadsheet preview…</div> : result ? <div className="overflow-x-auto border border-border"><table className="w-full min-w-max text-left text-sm"><thead><tr className="border-b border-border bg-muted/50">{result.columns.map((column) => <th key={column.key} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{column.label}</th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={`${index}-${String(row[result.columns[0]?.key])}`} className="border-b border-border/70 last:border-b-0">{result.columns.map((column) => <td key={column.key} className="whitespace-nowrap px-4 py-3">{display(row[column.key])}</td>)}</tr>)}</tbody></table></div> : null}</div></main>;
};

export default QueryPreview;

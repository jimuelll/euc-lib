import { useAdminFilters } from "@/features/admin";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronDown, Download, ExternalLink, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/utils/apiError";
import { downloadQueryCsv, fetchQuery, fetchQueryMeta, type QueryDataset, type QueryFilters, type QueryMeta, type QueryResult } from "./api";
import { formatQueryValue } from "./format";

const INITIAL_DATASET: QueryDataset = "catalog";
const wideScreen = () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
const initialFilters = (dataset: QueryDataset): QueryFilters => ({ dataset, search: "", dateFrom: "", dateTo: "" });
const number = new Intl.NumberFormat("en-PH");
const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const fallbackDatasets: QueryMeta["datasets"] = [
  { value: "catalog", label: "Catalog", filters: ["materialType", "bookType", "category", "availability", "condition"] },
  { value: "users", label: "Users", filters: ["role", "accountStatus", "program"] },
  { value: "borrowings", label: "Borrowings", filters: ["status", "borrowerRole", "bookType", "issuedBy"] },
  { value: "reservations", label: "Reservations", filters: ["status", "bookType"] },
  { value: "attendance", label: "Attendance", filters: ["purpose", "scanType"] },
  { value: "notifications", label: "Notifications", filters: ["audience", "notificationStatus"] },
  { value: "subscriptions", label: "Academic subscriptions", filters: ["category", "subscriptionStatus"] },
  { value: "clearance", label: "Clearance exceptions", filters: ["clearanceReason"] },
];

type Option = { value: string; label: string };
const choices = (values: string[]): Option[] => values.map((value) => ({ value, label: value.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()) }));
const validDate = (value: string) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

function FilterSelect({ id, label, value, options, onChange }: { id: string; label: string; value?: string | number; options: Option[]; onChange: (next: string) => void }) {
  return <div className="min-w-0 space-y-1.5"><Label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</Label><Select value={String(value || "all")} onValueChange={onChange}><SelectTrigger id={id} className="h-11 w-full rounded-md bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}

const QueryExplorer = () => {
  const [meta, setMeta] = useState<QueryMeta | null>(null);
  const { applied, setApplied, page, setPage } = useAdminFilters<QueryFilters>("records", initialFilters(INITIAL_DATASET));
  const [draft, setDraft] = useState<QueryFilters>(applied);
  useEffect(() => { setDraft(applied); }, [applied]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(wideScreen);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const datasets = meta?.datasets ?? fallbackDatasets;
  const selected = datasets.find((dataset) => dataset.value === draft.dataset) ?? fallbackDatasets[0];
  const filterNames = selected.filters;
  const isClearance = draft.dataset === "clearance";
  const draftChanged = JSON.stringify(draft) !== JSON.stringify(applied);
  const activeFilterCount = Object.entries(draft).filter(([key, value]) => !["dataset", "search"].includes(key) && value !== undefined && value !== "" && value !== "all").length;
  const update = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  const load = useCallback(async (filters: QueryFilters, page = 1) => {
    const currentId = ++requestId.current;
    setLoading(true); setError("");
    try {
      const next = await fetchQuery({ ...filters, page, limit: 25 });
      if (currentId === requestId.current) setResult(next);
    } catch (failure) {
      if (currentId === requestId.current) { setResult(null); setError(getApiErrorMessage(failure, "Unable to load records. Check the filters and try again.")); }
    } finally { if (currentId === requestId.current) setLoading(false); }
  }, []);

  useEffect(() => {
    void fetchQueryMeta().then(setMeta).catch((failure) => setError(getApiErrorMessage(failure, "Filter options could not be loaded. Try refreshing the page.")));

    return () => { requestId.current += 1; };
  }, [load]);
  useEffect(() => {
    const screen = window.matchMedia("(min-width: 768px)");
    const onWidthChange = () => setShowFilters(screen.matches);
    screen.addEventListener("change", onWidthChange);
    return () => screen.removeEventListener("change", onWidthChange);
  }, []);

  useEffect(() => { void load(applied, page); }, [applied, page, load]);

  const chooseDataset = (dataset: QueryDataset) => {
    const next = initialFilters(dataset);
    setDraft(next); setApplied(next); setResult(null);
    setShowFilters(wideScreen());

  };
  const reset = () => {
    const next = initialFilters(draft.dataset);
    setDraft(next); setApplied(next);

  };
  const run = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!isClearance && (!validDate(String(draft.dateFrom ?? "")) || !validDate(String(draft.dateTo ?? "")))) { setError("Choose valid start and end dates."); return; }
    if (!isClearance && draft.dateFrom && draft.dateTo && String(draft.dateFrom) > String(draft.dateTo)) { setError("The start date must be on or before the end date."); return; }
    setApplied({ ...draft });

  };

  const previewUrl = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(applied).forEach(([key, value]) => { if (value !== undefined && value !== "" && value !== "all") params.set(key, String(value)); });
    return `/admin/query/preview?${params.toString()}`;
  }, [applied]);
  const exportCsv = async () => {
    setExporting(true); setError("");
    try { await downloadQueryCsv(applied); }
    catch (failure) { setError(getApiErrorMessage(failure, "Unable to download this CSV. Narrow the filters or try again.")); }
    finally { setExporting(false); }
  };

  const selectFilter = (key: string, label: string, options: Option[]) => <FilterSelect key={key} id={`query-${key}`} label={label} value={draft[key]} options={options} onChange={(value) => update(key, value)} />;
  const contextFilters = <>
    {filterNames.includes("materialType") && selectFilter("materialType", "Material type", [{ value: "book", label: "Books" }, { value: "thesis", label: "Theses" }])}
    {filterNames.includes("bookType") && selectFilter("bookType", "Book type", (meta?.bookTypes ?? []).map((item) => ({ value: String(item.id), label: item.name })))}
    {filterNames.includes("category") && selectFilter("category", "Category", (draft.dataset === "subscriptions" ? meta?.subscriptionCategories ?? [] : meta?.categories ?? []).map((item) => ({ value: item.value, label: item.value })))}
    {filterNames.includes("availability") && selectFilter("availability", "Availability", [{ value: "available", label: "Available" }, { value: "unavailable", label: "Unavailable" }])}
    {filterNames.includes("condition") && selectFilter("condition", "Copy condition", choices(["good", "damaged", "lost"]))}
    {(filterNames.includes("role") || filterNames.includes("borrowerRole")) && selectFilter(filterNames.includes("role") ? "role" : "borrowerRole", "Role", choices(meta?.roles ?? []))}
    {filterNames.includes("accountStatus") && selectFilter("accountStatus", "Account status", [{ value: "1", label: "Active" }, { value: "0", label: "Inactive" }])}
    {filterNames.includes("program") && selectFilter("program", "Program / course", (meta?.programs ?? []).map((item) => ({ value: String(item.id), label: item.name })))}
    {filterNames.includes("status") && selectFilter("status", "Status", choices(draft.dataset === "borrowings" ? ["borrowed", "overdue", "returned"] : ["pending", "ready", "fulfilled", "cancelled", "expired"]))}
    {filterNames.includes("issuedBy") && selectFilter("issuedBy", "Issued by", (meta?.issuers ?? []).map((item) => ({ value: String(item.id), label: item.name })))}
    {filterNames.includes("purpose") && selectFilter("purpose", "Purpose", [{ value: "entry_exit", label: "Entry / exit" }, { value: "borrowing", label: "Borrowing" }])}
    {filterNames.includes("scanType") && selectFilter("scanType", "Scan type", [{ value: "check_in", label: "Check in" }, { value: "check_out", label: "Check out" }])}
    {filterNames.includes("audience") && selectFilter("audience", "Audience", [{ value: "public", label: "All users" }, { value: "user", label: "Individual user" }, { value: "role", label: "Role" }])}
    {filterNames.includes("notificationStatus") && selectFilter("notificationStatus", "Notification status", choices(["active", "inactive", "expired"]))}
    {filterNames.includes("subscriptionStatus") && selectFilter("subscriptionStatus", "Subscription status", [{ value: "1", label: "Active" }, { value: "0", label: "Inactive" }])}
    {filterNames.includes("clearanceReason") && selectFilter("clearanceReason", "Reason", [{ value: "overdue", label: "Overdue returns" }, { value: "fines", label: "Unpaid fines" }, { value: "both", label: "Both" }])}
  </>;

  return <div className="space-y-5">
    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Search library records, review live clearance exceptions, and export the matching results.</p>
    {error && <div role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

    <form onSubmit={run} className="border-y border-border bg-muted/20 px-3 py-4 sm:px-5">
      <div className="grid gap-3 md:grid-cols-[minmax(12rem,0.65fr)_minmax(14rem,1fr)_auto] md:items-end">
        <div className="min-w-0 space-y-1.5"><Label htmlFor="query-dataset" className="text-xs font-medium text-muted-foreground">Record type</Label><Select value={draft.dataset} onValueChange={(value) => chooseDataset(value as QueryDataset)}><SelectTrigger id="query-dataset" className="h-11 rounded-md bg-background"><SelectValue /></SelectTrigger><SelectContent>{datasets.map((dataset) => <SelectItem key={dataset.value} value={dataset.value}>{dataset.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="min-w-0 space-y-1.5"><Label htmlFor="query-search" className="text-xs font-medium text-muted-foreground">Search</Label><div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="query-search" className="h-11 rounded-md bg-background pl-10" value={String(draft.search ?? "")} onChange={(event) => update("search", event.target.value)} placeholder={isClearance ? "Patron, ID, or overdue title…" : `Search ${selected.label.toLowerCase()}…`} /></div></div>
        <Button type="submit" className="h-11 rounded-md" disabled={loading}><Search className="mr-2 h-4 w-4" />Run query</Button>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3"><button type="button" className="flex min-h-9 items-center gap-2 text-sm font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={showFilters} aria-controls="query-extra-filters" onClick={() => setShowFilters((open) => !open)}><SlidersHorizontal className="h-4 w-4" />Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}<ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`} /></button><Button type="button" variant="ghost" size="sm" className="rounded-md" onClick={reset}>Reset filters</Button></div>
      <div id="query-extra-filters" className={`${showFilters ? "grid" : "hidden"} mt-3 gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
        {!isClearance && <><div className="space-y-1.5"><Label htmlFor="query-date-from" className="text-xs font-medium text-muted-foreground">Start date</Label><Input id="query-date-from" type="date" className="h-11 rounded-md bg-background" value={String(draft.dateFrom ?? "")} onChange={(event) => update("dateFrom", event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="query-date-to" className="text-xs font-medium text-muted-foreground">End date</Label><Input id="query-date-to" type="date" className="h-11 rounded-md bg-background" value={String(draft.dateTo ?? "")} onChange={(event) => update("dateTo", event.target.value)} /></div></>}
        {contextFilters}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{isClearance ? "Live exceptions based on current overdue returns and unpaid fines." : "Leave dates empty to include all recorded dates."}</p>
    </form>

    {result?.summary && <div className="grid border-y border-border bg-card sm:grid-cols-3"><div className="px-5 py-4"><p className="text-xs text-muted-foreground">Patrons with overdue returns</p><p className="mt-1 text-xl font-semibold tabular-nums">{number.format(result.summary.overduePatrons)}</p><p className="text-xs text-muted-foreground">{number.format(result.summary.overdueItems)} overdue items</p></div><div className="border-y border-border px-5 py-4 sm:border-x sm:border-y-0"><p className="text-xs text-muted-foreground">Patrons with unpaid fines</p><p className="mt-1 text-xl font-semibold tabular-nums">{number.format(result.summary.unpaidFinePatrons)}</p></div><div className="px-5 py-4"><p className="text-xs text-muted-foreground">Total unpaid fines</p><p className="mt-1 text-xl font-semibold tabular-nums">{money.format(result.summary.outstandingAmount)}</p></div></div>}

    <section className="admin-panel-surface admin-etched-border overflow-hidden border border-border bg-card" aria-busy={loading}>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>{result?.label ?? selected.label}</h2><p className="mt-1 text-xs text-muted-foreground">{loading ? "Loading records…" : `${number.format(result?.pagination?.total ?? 0)} matching records`}{draftChanged ? " · Showing the last run; run the query to apply changes" : ""}</p></div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" className="rounded-md" disabled={loading || !result} onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="mr-2 h-4 w-4" />Preview CSV</Button><Button type="button" variant="outline" size="sm" className="rounded-md" disabled={loading || exporting || !result} onClick={() => void exportCsv()}>{exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download CSV</Button></div>
      </div>
      {loading ? <div className="space-y-2 p-4" aria-label="Loading query results">{[0, 1, 2, 3, 4].map((row) => <Skeleton key={row} className="h-12 w-full rounded-md" />)}</div> : result?.rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border bg-muted/30">{result.columns.map((column) => <th key={column.key} scope="col" className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted-foreground">{column.label}</th>)}</tr></thead><tbody className="divide-y divide-border">{result.rows.map((row, index) => <tr key={`${result.pagination?.page ?? 1}-${index}`} className="hover:bg-muted/20">{result.columns.map((column, columnIndex) => <td key={column.key} className={`max-w-[26rem] px-4 py-3 align-top text-foreground ${columnIndex === 0 ? "font-medium" : ""}`}><span className="block min-w-0 break-words">{column.key === "outstandingAmount" ? money.format(Number(row[column.key] ?? 0)) : formatQueryValue(row[column.key], column.type)}</span></td>)}</tr>)}</tbody></table></div> : <div className="px-5 py-12 text-center text-sm text-muted-foreground">No records match these filters. Adjust the search or reset the filters.</div>}
      <div className="flex flex-col gap-3 border-t border-border bg-muted/15 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{number.format(result?.pagination?.total ?? 0)} record{result?.pagination?.total === 1 ? "" : "s"}</span><div className="flex items-center justify-between gap-3"><Button type="button" variant="outline" size="sm" className="rounded-md" disabled={loading || !result || result.pagination?.page === 1} onClick={() => setPage((result?.pagination?.page ?? 1) - 1)}>Previous</Button><span className="whitespace-nowrap tabular-nums">Page {result?.pagination?.page ?? 1} of {result?.pagination?.totalPages ?? 1}</span><Button type="button" variant="outline" size="sm" className="rounded-md" disabled={loading || !result || (result.pagination?.page ?? 1) >= (result.pagination?.totalPages ?? 1)} onClick={() => setPage((result?.pagination?.page ?? 1) + 1)}>Next</Button></div></div>
    </section>
  </div>;
};

export default QueryExplorer;

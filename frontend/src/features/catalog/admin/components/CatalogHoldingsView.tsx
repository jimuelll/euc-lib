import { useEffect, useState } from "react";
import { ArrowLeft, Barcode, BookOpen, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { fetchAcademicPrograms, type AcademicProgram } from "@/features/library-settings";
import { fetchCatalogHoldings, type CatalogHolding, type CatalogHoldingsResponse } from "../catalog.api";

type Props = { onBack: () => void; onSelect: (holding: CatalogHolding) => void };
const emptyResult: CatalogHoldingsResponse = { rows: [], total: 0, page: 1, limit: 25, pagination: { page: 1, limit: 25, total: 0, totalPages: 1 } };

export default function CatalogHoldingsView({ onBack, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [completion, setCompletion] = useState("all");
  const [programId, setProgramId] = useState("");
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [result, setResult] = useState(emptyResult);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { void fetchAcademicPrograms().then(setPrograms).catch(() => setPrograms([])); }, []);
  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void fetchCatalogHoldings({ query, status, completion, programId: programId ? Number(programId) : undefined, page: result.page })
        .then((next) => { if (alive) setResult(next); })
        .catch(() => { if (alive) { setResult(emptyResult); setError("Could not load holdings. Try again."); } })
        .finally(() => { if (alive) setLoading(false); });
    }, query ? 180 : 0);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [query, status, completion, programId, result.page]);

  const changeFilter = (change: () => void) => { change(); setResult((current) => ({ ...current, page: 1 })); };
  const page = (nextPage: number) => setResult((current) => ({ ...current, page: nextPage }));

  return <section className="space-y-4" aria-labelledby="holdings-view-heading">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><Button variant="outline" size="icon" className="shrink-0" aria-label="Back to catalog" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button><div><h2 id="holdings-view-heading" className="text-lg font-semibold text-foreground">Book holdings</h2><p className="mt-1 text-sm text-muted-foreground">Search accessioned copies, unaccessioned copies, and voided accession records.</p></div></div>
      <span className="text-sm tabular-nums text-muted-foreground">{result.total} physical cop{result.total === 1 ? "y" : "ies"}</span>
    </div>

    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_190px_190px_200px]">
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search holdings" className="pl-9" placeholder="Title, author, barcode, accession…" value={query} onChange={(event) => changeFilter(() => setQuery(event.target.value))} /></div>
      <Select value={status} onValueChange={(value) => changeFilter(() => setStatus(value))}><SelectTrigger aria-label="Filter by copy status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All copy states</SelectItem><SelectItem value="available">Available</SelectItem><SelectItem value="borrowed">Borrowed</SelectItem><SelectItem value="reserved">Reserved</SelectItem><SelectItem value="voided">Accession voided</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>
      <Select value={completion} onValueChange={(value) => changeFilter(() => setCompletion(value))}><SelectTrigger aria-label="Filter by holding details"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All holdings</SelectItem><SelectItem value="complete">Accessioned</SelectItem><SelectItem value="missing">Needs accession</SelectItem></SelectContent></Select>
      <Select value={programId || "all"} onValueChange={(value) => changeFilter(() => setProgramId(value === "all" ? "" : value))}><SelectTrigger aria-label="Filter by course"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All courses</SelectItem>{programs.map((program) => <SelectItem key={program.id} value={String(program.id)}>{program.name}</SelectItem>)}</SelectContent></Select>
    </div>

    <div className="overflow-hidden border border-border bg-card">
      {loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading holdings…</div> : result.rows.length === 0 ? <div className="px-5 py-14 text-center"><BookOpen className="mx-auto h-8 w-8 text-muted-foreground/40" /><p className="mt-3 text-sm font-medium text-foreground">{error || "No holdings match these filters"}</p><p className="mt-1 text-sm text-muted-foreground">{error ? "" : "Try another search or show copies that need an accession number."}</p></div> : <><div className="admin-mobile-records divide-y divide-border md:hidden" aria-label="Book holdings">{result.rows.map((holding) => <article key={holding.copy_id} className="min-w-0 space-y-3 p-4"><div><h3 className="break-words font-semibold">{holding.title}</h3><p className="text-sm text-muted-foreground">{holding.author || "Unknown author"}</p></div><dl className="grid gap-2 text-sm"><div><dt className="text-muted-foreground">Copy / accession</dt><dd className="break-all">{holding.barcode} · {holding.accession_voided ? `Voided ${holding.accession_number}` : holding.accession_number ? `Acc. ${holding.accession_number}` : "Needs accession"}</dd></div><div><dt className="text-muted-foreground">Course and location</dt><dd className="break-words">{holding.course || "—"} · {holding.location || "—"}</dd></div><div><dt className="text-muted-foreground">Circulation</dt><dd>{!holding.is_active ? "Inactive" : holding.accession_voided ? "Accession voided" : holding.circulation_status === "available" && !holding.accession_number ? "Unavailable" : holding.circulation_status}</dd></div></dl><Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => onSelect(holding)}>{holding.accession_number ? "Edit holding" : "Add holding"}</Button></article>)}</div><div className="admin-desktop-table overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm">
        <thead><tr className="border-b border-border bg-muted/30">{["Book and author", "Copy / accession", "Course", "Location", "Circulation", ""].map((heading) => <th key={heading} className="px-4 py-3 text-xs font-semibold text-muted-foreground">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{result.rows.map((holding) => <tr key={holding.copy_id} className="hover:bg-muted/20">
          <td className="max-w-[280px] px-4 py-3"><p className="truncate font-medium text-foreground">{holding.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{holding.author || "Unknown author"}</p></td>
          <td className="px-4 py-3"><div className="flex items-center gap-1.5 font-mono text-xs text-foreground"><Barcode className="h-3.5 w-3.5 text-muted-foreground" />{holding.barcode}</div><p className={`mt-1 text-xs ${holding.accession_voided || !holding.accession_number ? "font-medium text-warning" : "text-muted-foreground"}`}>{holding.accession_voided ? `Voided · ${holding.accession_number}` : holding.accession_number ? `Acc. ${holding.accession_number}` : "Needs accession"}</p></td>
          <td className="max-w-[180px] px-4 py-3"><p className="truncate">{holding.course || "—"}</p>{holding.course_code && <p className="mt-1 text-xs text-muted-foreground">{holding.course_code}</p>}</td>
          <td className="max-w-[150px] truncate px-4 py-3 text-muted-foreground">{holding.location || "—"}</td>
          <td className="px-4 py-3"><span className="font-medium">{!holding.is_active ? "Inactive" : holding.accession_voided ? "Accession voided" : holding.circulation_status === "available" && !holding.accession_number ? "Unavailable" : holding.circulation_status}</span>{holding.accession_number && <p className="mt-1 text-xs text-muted-foreground">{holding.condition}</p>}</td>
          <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => onSelect(holding)}>{holding.accession_number ? "Edit holding" : "Add holding"}</Button></td>
        </tr>)}</tbody>
      </table></div></>}
      <div className="flex flex-col gap-3 border-t border-border bg-muted/15 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Page {result.pagination.page} of {result.pagination.totalPages}</span><div className="flex justify-between gap-2 sm:justify-end"><Button size="sm" variant="outline" disabled={result.pagination.page <= 1 || loading} onClick={() => page(result.pagination.page - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={result.pagination.page >= result.pagination.totalPages || loading} onClick={() => page(result.pagination.page + 1)}>Next</Button></div></div>
    </div>
  </section>;
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookMarked, BrainCircuit, Loader2, Sparkles, X } from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
import { toast } from "@/components/ui/sonner";

export type Recommendation = { id: number; title: string; author?: string | null; material_type: "book" | "thesis"; available?: number; reason: string; source: "rule" | "ai" };
type Response = { material_type: "book" | "thesis"; rows: Recommendation[] };

export function RecommendationStrip({ materialType, seedBookId, personal = false, title }: { materialType: "book" | "thesis"; seedBookId?: number | null; personal?: boolean; title?: string }) {
  const [rows, setRows] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(Boolean(seedBookId || personal));
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (!personal && !seedBookId) { setRows([]); setLoading(false); return; }
      setLoading(true);
      try {
        const response = await axiosInstance.get<Response>(personal ? "/api/recommendations/me" : `/api/catalogue/books/${seedBookId}/recommendations`, { params: personal ? { materialType } : undefined, signal: controller.signal });
        setRows(response.data.rows || []);
      } catch (error: any) { if (error.name !== "CanceledError") setRows([]); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load(); return () => controller.abort();
  }, [materialType, personal, seedBookId]);
  const dismiss = async (bookId: number) => {
    setRows((current) => current.filter((book) => book.id !== bookId));
    try { await axiosInstance.post(`/api/recommendations/${bookId}/dismiss`); }
    catch { toast.error("We could not save that preference. Please try again."); }
  };
  if (!loading && !rows.length) return null;
  const heading = title || (personal ? (materialType === "book" ? "Recommended for you" : "Theses to explore") : (materialType === "book" ? "Similar books" : "Related theses"));
  return <section className="overflow-hidden border border-border bg-card" aria-label={heading}>
    <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/20 px-5 py-4">
      <div className="flex items-center gap-3">
        {materialType === "book" ? <BookMarked className="h-4 w-4 text-warning" /> : <BrainCircuit className="h-4 w-4 text-warning" />}
        <div><h2 className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>{heading}</h2><p className="mt-0.5 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">{materialType === "book" ? "Books selected for relevance" : "Reference-only research"}</p></div>
      </div><Link to="/catalogue" className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary hover:underline">Browse all</Link>
    </div>
    {loading ? <div className="flex h-28 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-warning" /></div> : <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
      {rows.map((book) => <article key={book.id} className="group relative min-w-0 px-4 py-4 transition-colors hover:bg-muted/30">
        {personal ? <button type="button" onClick={() => void dismiss(book.id)} aria-label={`Not interested in ${book.title}`} className="absolute right-2 top-2 rounded-sm p-1 text-muted-foreground/50 opacity-100 transition-colors hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"><X className="h-3.5 w-3.5" /></button> : null}
        <Link to={`/catalogue?q=${encodeURIComponent(book.title)}`} className="block pr-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning">
          {book.source === "ai" ? <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-primary-foreground" title="Selected through Gemini semantic similarity"><Sparkles className="h-3 w-3 text-warning" aria-hidden="true" />AI semantic match</span> : null}
          <p className="line-clamp-2 text-[13px] font-bold leading-5 text-foreground group-hover:text-primary" style={{ fontFamily: "var(--font-heading)" }}>{book.title}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{book.author || "Unknown author"}</p><p className="mt-3 min-h-8 text-[10px] leading-4 text-muted-foreground">{book.reason}</p><p className={`mt-2 text-[10px] font-bold uppercase tracking-[0.1em] ${book.material_type === "thesis" ? "text-warning" : book.available ? "text-success" : "text-muted-foreground"}`}>{book.material_type === "thesis" ? "Reference only" : book.available ? "Available" : "Checked out"}</p>
        </Link>
      </article>)}
    </div>}
  </section>;
}

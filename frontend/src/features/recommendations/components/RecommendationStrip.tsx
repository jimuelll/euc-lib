import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookMarked, BrainCircuit, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { dismissRecommendation, fetchRecommendations } from "../api";

export type Recommendation = { id: number; title: string; author?: string | null; image_url?: string | null; material_type: "book" | "thesis"; available?: number; needs_policy?: boolean; availability_status?: "available" | "checked_out" | "reserved" | "unavailable" | "reference_only"; reason: string; source: "rule" | "ai" };

const cardsPerPageForWidth = (width: number) => width >= 850 ? 3 : width >= 560 ? 2 : 1;

function RecommendationCover({ book }: { book: Recommendation }) {
  const fallback = book.material_type === "thesis" ? "/thesis-cover-fallback.svg" : "/book-cover-fallback.svg";
  const imageKey = `${book.id}:${book.image_url || ""}:${book.material_type}`;
  const [failedImageKey, setFailedImageKey] = useState<string | null>(null);
  const failed = failedImageKey === imageKey;
  const src = book.material_type === "thesis" || failed || !book.image_url ? fallback : book.image_url;
  const alt = book.material_type === "thesis" ? "Generic thesis cover" : book.image_url && !failed ? `Cover of ${book.title}` : "Generic book cover";
  return <img src={src} alt={alt} onError={() => setFailedImageKey(imageKey)} className="h-[124px] w-[82px] shrink-0 border border-border bg-muted/20 object-contain sm:h-[144px] sm:w-[96px] 2xl:h-[132px] 2xl:w-[88px]" />;
}
export function RecommendationStrip({ materialType, seedBookId, personal = false, title }: { materialType: "book" | "thesis"; seedBookId?: number | null; personal?: boolean; title?: string }) {
  const [rows, setRows] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(Boolean(seedBookId || personal));
  const [pageIndex, setPageIndex] = useState(0);
  const [cardsPerPage, setCardsPerPage] = useState(() => typeof window === "undefined" ? 1 : cardsPerPageForWidth(window.innerWidth));
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setPageIndex(0);
      if (!personal && !seedBookId) { setRows([]); setLoading(false); return; }
      setLoading(true);
      try {
        const response = await fetchRecommendations({ materialType, seedBookId, personal, signal: controller.signal });
        setRows(response.rows || []);
        setPageIndex(0);
      } catch (error: any) { if (error.name !== "CanceledError") setRows([]); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load(); return () => controller.abort();
  }, [materialType, personal, seedBookId]);
  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;
    const update = (width: number) => setCardsPerPage(cardsPerPageForWidth(width));
    const measure = () => update(element.getBoundingClientRect().width || window.innerWidth);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) update(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setPageIndex((current) => Math.min(current, Math.max(0, Math.ceil(rows.length / cardsPerPage) - 1)));
  }, [rows.length, cardsPerPage]);
  const dismiss = async (bookId: number) => {
    setRows((current) => current.filter((book) => book.id !== bookId));
    try { await dismissRecommendation(bookId); }
    catch { toast.error("We could not save that preference. Please try again."); }
  };
  if (!loading && !rows.length) return null;
  const heading = title || (personal ? (materialType === "book" ? "Recommended for you" : "Theses to explore") : (materialType === "book" ? "Similar books" : "Related theses"));
  const pageCount = Math.max(1, Math.ceil(rows.length / cardsPerPage));
  const activePage = Math.min(pageIndex, pageCount - 1);
  const visibleRows = rows.slice(activePage * cardsPerPage, (activePage + 1) * cardsPerPage);
  const availabilityLabel = (book: Recommendation) => {
    if (book.material_type === "thesis" || book.availability_status === "reference_only") return "Reference only";
    switch (book.availability_status) {
      case "available": return "Available";
      case "checked_out": return "Checked out";
      case "reserved": return "Reserved";
      case "unavailable": return "Unavailable";
      default: return book.needs_policy ? "Unavailable" : Number(book.available || 0) > 0 ? "Available" : "Unavailable";
    }
  };
  return <section ref={sectionRef} className="overflow-hidden border border-border bg-card" aria-label={heading}>
    <div className="flex min-h-[68px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-muted/20 px-3 py-2.5 sm:px-5 sm:py-3">
      {materialType === "book" ? <BookMarked className="h-5 w-5 shrink-0 text-warning" /> : <BrainCircuit className="h-5 w-5 shrink-0 text-warning" />}
      <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold text-foreground sm:text-base" style={{ fontFamily: "var(--font-heading)" }}>{heading}</h2><p className="mt-0.5 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">{materialType === "book" ? "Books selected for relevance" : "Reference-only research"}</p></div>
      {!loading && pageCount > 1 ? <nav className="ml-auto flex shrink-0 items-center gap-1" aria-label={`${heading} pages`}>
        <button type="button" onClick={() => setPageIndex(Math.max(0, activePage - 1))} disabled={activePage === 0} aria-label="Previous recommendations" className="grid size-11 place-items-center border border-border text-foreground transition-colors hover:border-warning hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></button>
        <span className="min-w-[68px] px-1 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">{activePage + 1} of {pageCount}</span>
        <button type="button" onClick={() => setPageIndex(Math.min(pageCount - 1, activePage + 1))} disabled={activePage >= pageCount - 1} aria-label="Next recommendations" className="grid size-11 place-items-center border border-border text-foreground transition-colors hover:border-warning hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning disabled:cursor-not-allowed disabled:opacity-40"><ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
      </nav> : null}
    </div>
    {loading ? <div className="flex h-28 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-warning" /></div> : <div className="grid gap-2.5 p-2.5 sm:gap-3 sm:p-4" style={{ gridTemplateColumns: `repeat(${cardsPerPage}, minmax(0, 1fr))` }}>
      {visibleRows.map((book) => <article key={book.id} className="group relative flex min-w-0 flex-col border border-border bg-card transition-colors hover:border-primary/50 hover:bg-muted/20">
        {personal ? <button type="button" onClick={() => void dismiss(book.id)} aria-label={`Not interested in ${book.title}`} className="absolute right-2 top-2 z-10 rounded-sm bg-card/90 p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"><X className="h-3.5 w-3.5" /></button> : null}
        <Link to={`/catalogue?q=${encodeURIComponent(book.title)}`} className={`flex min-h-[148px] min-w-0 flex-1 items-start gap-3 p-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning sm:min-h-[166px] sm:gap-3.5 sm:p-3 ${personal ? "pr-9" : ""}`}>
          <RecommendationCover book={book} />
          <div className="flex min-w-0 flex-1 flex-col py-0.5">
            {book.source === "ai" ? <span className="mb-1.5 inline-grid size-6 place-items-center rounded-full border border-warning/50 bg-primary text-primary-foreground" role="img" aria-label="AI recommendation" title="AI recommendation"><Sparkles className="h-3 w-3 text-warning" aria-hidden="true" /></span> : null}
            <p className="line-clamp-2 break-words text-[13px] font-bold leading-5 text-foreground group-hover:text-primary sm:text-sm" style={{ fontFamily: "var(--font-heading)" }}>{book.title}</p>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{book.author || "Unknown author"}</p>
            <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-muted-foreground">{book.reason}</p>
          </div>
        </Link>
        <div className={`border-t border-border px-2 py-2 text-center text-[10px] font-bold uppercase tracking-[0.1em] ${book.material_type === "thesis" ? "text-warning" : book.availability_status === "available" || (!book.availability_status && Number(book.available || 0) > 0) ? "text-success" : book.availability_status === "unavailable" || (!book.availability_status && book.needs_policy) ? "text-destructive" : "text-muted-foreground"}`}>
          {availabilityLabel(book)}
        </div>
      </article>)}
    </div>}
  </section>;
}

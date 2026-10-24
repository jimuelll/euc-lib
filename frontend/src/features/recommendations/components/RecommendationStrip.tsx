import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookMarked, BrainCircuit, Loader2, X } from "@/components/ui/library-glyphs";
import { toast } from "@/components/ui/sonner";
import { dismissRecommendation, fetchRecommendations, type RecommendationsResponse } from "../api";
import { recommendationsKeys } from "../recommendations.keys";

export type Recommendation = { id: number; title: string; author?: string | null; image_url?: string | null; material_type: "book" | "thesis"; available?: number; needs_policy?: boolean; availability_status?: "available" | "checked_out" | "reserved" | "unavailable" | "reference_only"; reason: string; source: "rule" | "ai" };

const cardsPerPageForWidth = (width: number) => width >= 850 ? 3 : width >= 560 ? 2 : 1;

function RecommendationCover({ book }: { book: Recommendation }) {
  const fallback = book.material_type === "thesis" ? "/thesis-cover-fallback.svg" : "/book-cover-fallback.svg";
  const imageKey = `${book.id}:${book.image_url || ""}:${book.material_type}`;
  const [failedImageKey, setFailedImageKey] = useState<string | null>(null);
  const failed = failedImageKey === imageKey;
  const src = book.material_type === "thesis" || failed || !book.image_url ? fallback : book.image_url;
  const alt = book.material_type === "thesis" ? "Generic thesis cover" : book.image_url && !failed ? `Cover of ${book.title}` : "Generic book cover";
  return <img src={src} alt={alt} onError={() => setFailedImageKey(imageKey)} className="h-20 w-14 shrink-0 border border-border bg-muted/20 object-contain" />;
}
export function RecommendationStrip({ materialType, seedBookId, personal = false, title }: { materialType: "book" | "thesis"; seedBookId?: number | null; personal?: boolean; title?: string }) {
  const queryClient = useQueryClient();
  const [pageIndex, setPageIndex] = useState(0);
  const [cardsPerPage, setCardsPerPage] = useState(() => typeof window === "undefined" ? 1 : cardsPerPageForWidth(window.innerWidth));
  const sectionRef = useRef<HTMLElement>(null);
  const query = useQuery({
    queryKey: personal ? recommendationsKeys.personalType(materialType) : recommendationsKeys.related(seedBookId ?? 0, materialType),
    queryFn: ({ signal }) => fetchRecommendations({ materialType, seedBookId, personal, signal }),
    enabled: Boolean(personal || seedBookId),
  });
  const rows = query.data?.rows ?? [];
  const loading = query.isPending && Boolean(personal || seedBookId);
  useEffect(() => setPageIndex(0), [materialType, personal, seedBookId]);
  const dismissMutation = useMutation({
    mutationFn: dismissRecommendation,
    onMutate: async (bookId) => {
      await queryClient.cancelQueries({ queryKey: recommendationsKeys.personal() });
      const snapshot = queryClient.getQueriesData<RecommendationsResponse>({ queryKey: recommendationsKeys.personal() });
      snapshot.forEach(([key, result]) => {
        if (result) queryClient.setQueryData<RecommendationsResponse>(key, { ...result, rows: result.rows.filter((book) => book.id !== bookId) });
      });
      return snapshot;
    },
    onError: (_error, _bookId, snapshot: Array<[QueryKey, RecommendationsResponse | undefined]> | undefined) => {
      snapshot?.forEach(([key, result]) => { if (result) queryClient.setQueryData(key, result); });
      toast.error("We could not save that preference. Please try again.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: recommendationsKeys.personal() }),
  });
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
  const dismiss = async (bookId: number) => { try { await dismissMutation.mutateAsync(bookId); } catch { /* The mutation restores the cache and shows the error. */ } };
  if (!loading && !rows.length) return null;
  const heading = title || (personal ? (materialType === "book" ? "Recommended for you" : "Theses to explore") : (materialType === "book" ? "Similar books" : "Related theses"));
  const pageCount = Math.max(1, Math.ceil(rows.length / cardsPerPage));
  const activePage = Math.min(pageIndex, pageCount - 1);
  const visibleRows = rows.slice(activePage * cardsPerPage, (activePage + 1) * cardsPerPage);
  const aiCount = rows.filter(book => book.source === "ai").length;
  const selectionLabel = aiCount > 0
    ? aiCount === rows.length ? "AI-selected, ranked by relevance" : "Includes AI selections, ranked by relevance"
    : materialType === "book" ? "Books selected for relevance" : "Reference-only research";
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
  return <section ref={sectionRef} className="library-recommendations border border-border bg-card" aria-label={heading}>
    <div className="library-recommendation-heading flex items-start gap-2 border-b border-border bg-background px-3.5 py-2">
      {materialType === "book" ? <BookMarked className="size-4 shrink-0" /> : <BrainCircuit className="size-4 shrink-0" />}
      <div className="min-w-0 flex-1"><h2>{heading}</h2><p className="mt-1 text-xs text-muted-foreground">{selectionLabel}</p></div>
    </div>
    {loading ? <div className="flex h-28 items-center justify-center" role="status" aria-label="Loading recommendations"><Loader2 className="h-4 w-4 animate-spin text-warning" /></div> : <div className="grid gap-3 p-3" style={{ gridTemplateColumns: `repeat(${cardsPerPage}, minmax(0, 1fr))` }}>
      {visibleRows.map((book) => <article key={book.id} className="group relative flex min-w-0 flex-col border border-border bg-card transition-colors hover:border-primary/50 hover:bg-muted/20">
        <Link to={`/catalogue?q=${encodeURIComponent(book.title)}`} className="flex min-w-0 flex-1 items-start gap-3 p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning">
          <RecommendationCover book={book} />
          <div className="flex min-w-0 flex-1 flex-col py-0.5">
            <p className="library-recommendation-title break-words text-base font-bold leading-5 text-foreground group-hover:text-primary">{book.title}</p>
            <p className="mt-1 break-words text-[13px] leading-5 text-muted-foreground">{book.author || "Unknown author"}</p>
            {book.reason?.trim() && !/^similar subject and catalogue details[.!]?$/i.test(book.reason.trim()) && <p className="mt-2 break-words text-[13px] leading-5 text-muted-foreground">{book.reason}</p>}
          </div>
        </Link>
        <div className={`flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-sm font-bold ${book.material_type === "thesis" ? "text-warning" : availabilityLabel(book) === "Available" ? "text-success" : book.availability_status === "unavailable" || (!book.availability_status && book.needs_policy) ? "text-destructive" : "text-muted-foreground"}`}>
          <span className="inline-flex items-center gap-2">{availabilityLabel(book) === "Available" && <i aria-hidden="true" className="h-4 w-[7px] shrink-0 border-[1.5px] border-current bg-current" />}{availabilityLabel(book)}</span>
          {personal ? <button type="button" onClick={() => void dismiss(book.id)} aria-label={`Not interested in ${book.title}`} className="grid size-11 shrink-0 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4" /></button> : null}
        </div>
      </article>)}
    </div>}
    {!loading && pageCount > 1 ? <nav className="library-recommendation-pagination flex items-center justify-between gap-3 border-t border-border px-3.5 py-2" aria-label={`${heading} pages`}>
      <span className="text-xs text-muted-foreground" aria-live="polite">{activePage + 1} of {pageCount}</span><div className="flex gap-1">
        <button type="button" onClick={() => setPageIndex(Math.max(0, activePage - 1))} disabled={activePage === 0} aria-label="Previous recommendations" className="grid size-11 place-items-center border border-border hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground"><ArrowLeft className="size-4" /></button>
        <button type="button" onClick={() => setPageIndex(Math.min(pageCount - 1, activePage + 1))} disabled={activePage >= pageCount - 1} aria-label="Next recommendations" className="grid size-11 place-items-center border border-border hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground"><ArrowRight className="size-4" /></button>
      </div></nav> : null}
  </section>;
}

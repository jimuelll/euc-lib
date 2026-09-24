import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, ChevronDown, Loader2, Search, SlidersHorizontal } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PublicPageMasthead from "@/components/layout/PublicPageMasthead";
import { Skeleton } from "@/components/ui/skeleton";
import { RecommendationStrip } from "@/features/recommendations";
import { useDebounce } from "@/hooks/use-debounce";
import { fetchPublicCatalogSchema, searchPublicCatalogue, type PublicCatalogBook as Book, type PublicCatalogFacets, type PublicCatalogSchemaField as SchemaField } from "@/features/catalog/api";

const CORE_KEYS = new Set(["id", "title", "author", "isbn", "category", "edition", "publication_year", "copies", "image_url"]);
const EMPTY_FACETS: PublicCatalogFacets = {
  format: { all: 0, book: 0, thesis: 0 },
  availability: { all: 0, available: 0, unavailable: 0 },
  subjects: [],
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3">
    <div className="h-px w-6 shrink-0 bg-warning" />
    <p className="text-xs font-bold uppercase tracking-[0.22em] text-warning" style={{ fontFamily: "var(--font-heading)" }}>{children}</p>
  </div>
);

function FilterChoice({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className="flex min-h-9 w-full items-center gap-2.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning">
      <span aria-hidden="true" className={"grid size-4 shrink-0 place-items-center border " + (active ? "border-warning bg-primary text-warning" : "border-input bg-background")}>{active ? <Check className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" /> : null}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="tabular-nums text-xs text-muted-foreground/75">{count}</span>
    </button>
  );
}

function BookCover({ book }: { book: Book }) {
  const thesis = book.material_type === "thesis";
  const fallback = thesis ? "/thesis-cover-fallback.svg" : "/book-cover-fallback.svg";
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [book.image_url, book.material_type]);
  const src = thesis || failed || !book.image_url ? fallback : book.image_url;
  return <img src={src} alt={thesis ? "Generic thesis cover" : book.image_url && !failed ? "Cover of " + book.title : "Generic book cover"} onError={() => setFailed(true)} className="h-[116px] w-[78px] shrink-0 border border-border bg-muted/20 object-contain sm:h-[138px] sm:w-[92px]" />;
}

const Catalogue = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [books, setBooks] = useState<Book[]>([]);
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [facets, setFacets] = useState<PublicCatalogFacets>(EMPTY_FACETS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  const paramsKey = searchParams.toString();
  const params = useMemo(() => new URLSearchParams(paramsKey), [paramsKey]);
  const queryParam = params.get("q") || "";
  const materialType = params.get("format") || "all";
  const availability = params.get("availability") || "all";
  const selectedSubject = params.get("subject") || "";
  const sort = params.get("sort") || "relevance";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const debouncedQuery = useDebounce(query, 350);
  const committedQuery = useRef(queryParam);

  useEffect(() => {
    if (committedQuery.current !== queryParam) {
      committedQuery.current = queryParam;
      setQuery(queryParam);
      return;
    }
    const trimmedQuery = debouncedQuery.trim();
    if (trimmedQuery === queryParam) return;
    const next = new URLSearchParams(searchParams);
    if (trimmedQuery) next.set("q", trimmedQuery);
    else next.delete("q");
    next.delete("page");
    setSearchParams(next, { replace: true });
  }, [debouncedQuery, queryParam, searchParams, setSearchParams]);

  useEffect(() => {
    fetchPublicCatalogSchema().then(setSchema).catch(() => {});
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const syncFiltersToViewport = (event: MediaQueryListEvent | MediaQueryList) => setFiltersOpen(event.matches);
    syncFiltersToViewport(desktop);
    desktop.addEventListener("change", syncFiltersToViewport);
    return () => desktop.removeEventListener("change", syncFiltersToViewport);
  }, []);

  const updateParam = (key: string, value: string, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "all" && !(key === "sort" && value === "relevance")) next.set(key, value);
    else next.delete(key);
    if (resetPage) next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const submitSearch = () => {
    const next = new URLSearchParams(searchParams);
    const trimmed = query.trim();
    if (trimmed) next.set("q", trimmed);
    else next.delete("q");
    next.delete("page");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    void searchPublicCatalogue({
      query: params.get("q") || "",
      title: params.get("title") || "",
      author: params.get("author") || "",
      isbn: params.get("isbn") || "",
      format: params.get("format") || "all",
      availability: params.get("availability") || "all",
      subject: params.get("subject") || "",
      sort: params.get("sort") || "relevance",
      page,
    }).then((result) => {
      if (!current) return;
      setBooks(result.rows ?? []);
      setPagination(result.pagination);
      setFacets(result.facets ?? EMPTY_FACETS);
    }).catch((err: any) => {
      if (!current) return;
      setError(err.response?.data?.message ?? "Something went wrong while loading the catalogue.");
      setBooks([]);
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [paramsKey, page]);

  useEffect(() => setSelectedBook(null), [paramsKey]);

  const extraFields = schema
    .filter((field) => field.public && !CORE_KEYS.has(field.key))
    .sort((a, b) => a.order - b.order);
  const getLabelForKey = (key: string) => schema.find((field) => field.key === key)?.label ?? key;
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    for (const key of ["format", "availability", "subject", "sort", "title", "author", "isbn", "page"]) next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const filterControls = (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-foreground">Format</legend>
        <div className="space-y-0.5">
          <FilterChoice label="All formats" count={facets.format.all} active={materialType === "all"} onClick={() => updateParam("format", "all")} />
          <FilterChoice label="Books" count={facets.format.book} active={materialType === "book"} onClick={() => updateParam("format", "book")} />
          <FilterChoice label="Theses" count={facets.format.thesis} active={materialType === "thesis"} onClick={() => updateParam("format", "thesis")} />
        </div>
      </fieldset>
      <div className="h-px bg-border" />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-foreground">Availability</legend>
        <div className="space-y-0.5">
          <FilterChoice label="All items" count={facets.availability.all} active={availability === "all"} onClick={() => updateParam("availability", "all")} />
          <FilterChoice label="Available" count={facets.availability.available} active={availability === "available"} onClick={() => updateParam("availability", "available")} />
          <FilterChoice label="Unavailable" count={facets.availability.unavailable} active={availability === "unavailable"} onClick={() => updateParam("availability", "unavailable")} />
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Availability counts books with accessioned copies.</p>
      </fieldset>
      <div className="h-px bg-border" />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-foreground">Subject</legend>
        {facets.subjects.length ? (
          <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
            {facets.subjects.map((subject) => (
              <FilterChoice key={subject.value} label={subject.value} count={subject.count} active={selectedSubject.toLocaleLowerCase() === subject.value.toLocaleLowerCase()} onClick={() => updateParam("subject", selectedSubject.toLocaleLowerCase() === subject.value.toLocaleLowerCase() ? "" : subject.value)} />
            ))}
          </div>
        ) : <p className="text-xs leading-5 text-muted-foreground">No subjects in this result set.</p>}
      </fieldset>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <PublicPageMasthead title="Library Catalogue" description="Search books and reference theses in the library's collection.">
        <div className="max-w-4xl">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-warning" />
              {loading ? <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-warning" /> : null}
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") submitSearch(); }}
                placeholder="Search by title, author, or ISBN…"
                aria-label="Search the public catalogue"
                className="h-12 w-full border border-primary-foreground/35 bg-primary/50 pl-11 pr-11 text-sm text-primary-foreground outline-none transition-colors placeholder:text-primary-foreground/75 focus:border-warning focus:bg-primary/70 focus-visible:ring-2 focus-visible:ring-warning"
                style={{ caretColor: "hsl(var(--warning))" }}
              />
            </div>
            <button type="button" onClick={submitSearch} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 border border-warning px-6 text-xs font-bold uppercase tracking-[0.16em] text-warning transition-colors hover:bg-warning hover:text-warning-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-primary focus-visible:ring-warning">
              <Search className="size-4" /> Search
            </button>
          </div>
          <details className="group mt-3">
            <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground/90 marker:hidden hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning">
              <SlidersHorizontal className="size-4" /> Advanced search
            </summary>
            <div className="mt-3 grid gap-3 border border-primary-foreground/20 bg-black/10 p-4 sm:grid-cols-3">
              {([["title", "Title"], ["author", "Author"], ["isbn", "ISBN"]] as const).map(([key, label]) => (
                <label key={key} className="block text-xs font-semibold text-primary-foreground/90">
                  {label}
                  <input
                    value={params.get(key) || ""}
                    onChange={(event) => updateParam(key, event.target.value)}
                    placeholder={"Search " + label.toLowerCase()}
                    className="mt-1.5 h-10 w-full border border-primary-foreground/25 bg-primary/50 px-3 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/70 focus:border-warning focus-visible:ring-2 focus-visible:ring-warning"
                  />
                </label>
              ))}
            </div>
          </details>
        </div>
      </PublicPageMasthead>

      <main className="bg-background">
        <div className="container px-5 py-7 sm:px-8 sm:py-9 lg:px-12 xl:px-16">
          <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
            <aside className="self-start border border-border bg-card lg:sticky lg:top-5" aria-label="Catalogue filters">
              <details open={filtersOpen} onToggle={(event) => setFiltersOpen(event.currentTarget.open)} className="group/filter">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between border-b border-border px-4 text-xs font-bold uppercase tracking-[0.18em] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-warning">
                  Filter results <span className="text-warning">⌄</span>
                </summary>
                <div className="p-4">
                  {filterControls}
                  <button type="button" onClick={clearFilters} className="mt-5 min-h-9 text-xs font-semibold text-primary underline underline-offset-4 hover:text-primary/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning">Clear filters</button>
                </div>
              </details>
            </aside>

            <section aria-label="Catalogue results" className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <SectionLabel>{loading ? "Loading catalogue" : pagination.total + " result" + (pagination.total === 1 ? "" : "s") + " found"}</SectionLabel>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Sort by
                  <select value={sort} onChange={(event) => updateParam("sort", event.target.value)} className="min-h-10 min-w-40 border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-warning">
                    <option value="relevance">Relevance</option>
                    <option value="title_asc">Title A–Z</option>
                    <option value="title_desc">Title Z–A</option>
                    <option value="newest">Newest first</option>
                  </select>
                </label>
              </div>

              {error ? <div className="mb-4 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</div> : null}

              {loading ? (
                <div className="space-y-3" aria-label="Loading catalogue results">
                  {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-36 w-full rounded-md" />)}
                </div>
              ) : books.length === 0 ? (
                <div className="border border-border bg-card px-5 py-14 text-center">
                  <p className="text-base font-semibold text-foreground">No catalogue records found</p>
                  <p className="mt-2 text-sm text-muted-foreground">Try another search or clear one of the selected filters.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {books.map((book, index) => {
                    const isReferenceOnly = book.material_type === "thesis";
                    const selectionAction = isReferenceOnly ? "View related theses" : "View similar books";
                    const isSelected = selectedBook?.id === book.id;
                    const available = Number(book.available ?? 0) > 0;
                    const availabilityLabel = available ? "Available" : "Unavailable";
                    const extraValues = extraFields.flatMap((field) => {
                      const value = book[field.key];
                      if (value === undefined || value === null || value === "") return [];
                      return [{ key: field.key, label: getLabelForKey(field.key), value: Array.isArray(value) ? value.join(", ") : String(value) }];
                    });
                    return (
                      <Fragment key={book.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedBook((current) => current?.id === book.id ? null : book)}
                          aria-expanded={isSelected}
                          aria-controls={isSelected ? `recommendations-${book.id}` : undefined}
                          className={"group flex w-full flex-row items-start gap-3 border border-border bg-card p-3 text-left transition-colors hover:border-warning/50 hover:bg-secondary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning sm:items-stretch sm:gap-4 sm:p-4 " + (selectedBook?.id === book.id ? "border-warning bg-secondary/40" : "")}
                        >
                          <BookCover book={book} />
                          <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                            <span className="hidden w-7 shrink-0 pt-1 text-right text-xs font-bold tracking-[0.12em] text-muted-foreground/65 sm:block" style={{ fontFamily: "var(--font-heading)" }}>{String((page - 1) * pagination.limit + index + 1).padStart(2, "0")}</span>
                            <div className="min-w-0 flex-1">
                              <h2 className="break-words text-base font-bold leading-6 tracking-tight text-foreground group-hover:text-primary sm:text-[17px]" style={{ fontFamily: "var(--font-heading)" }}>{book.title}</h2>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                                {book.author ? <span>{book.author}</span> : <span>Unknown author</span>}
                                {book.category ? <><span aria-hidden="true" className="text-border">·</span><span>{book.category}</span></> : null}
                                {book.edition ? <><span aria-hidden="true" className="text-border">·</span><span>{book.edition} ed.</span></> : null}
                                {book.publication_year ? <><span aria-hidden="true" className="text-border">·</span><span>{book.publication_year}</span></> : null}
                              </div>
                              {book.isbn ? <p className="mt-1.5 break-all text-xs tracking-wide text-muted-foreground">ISBN {book.isbn}</p> : null}
                              {isReferenceOnly ? <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-warning">Thesis · Reference only</p> : null}
                              {extraValues.length ? (
                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                                  {extraValues.slice(0, 6).map((field) => <span key={field.key} className="min-w-0 break-words text-xs leading-relaxed text-muted-foreground"><span className="mr-1 font-semibold text-foreground/75">{field.label}:</span>{field.value}</span>)}
                                </div>
                              ) : null}
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 sm:hidden">
                                {!isReferenceOnly ? <span className="inline-flex items-center gap-2"><span className={"size-2 rounded-full " + (available ? "bg-success" : "bg-destructive")} /><span className={"text-xs font-bold uppercase tracking-[0.1em] " + (available ? "text-success" : "text-destructive")}>{availabilityLabel}</span></span> : <span className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Reference only</span>}
                                <span className="inline-flex min-h-9 items-center gap-1.5 border border-warning px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-warning">{selectionAction}<ChevronDown className={"h-3.5 w-3.5 transition-transform " + (isSelected ? "rotate-180" : "")} aria-hidden="true" /></span>
                              </div>
                            </div>
                          </div>
                          <div className="hidden w-full shrink-0 border-t border-border pt-3 sm:flex sm:w-40 sm:flex-col sm:items-start sm:justify-center sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 lg:w-44">
                            {!isReferenceOnly ? (
                              <>
                                <span className={"inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] " + (available ? "text-success" : "text-destructive")}>
                                  <span className={"size-2 rounded-full " + (available ? "bg-success" : "bg-destructive")} />{availabilityLabel}
                                </span>
                                <span className="mt-1 text-xs leading-5 text-muted-foreground">{book.available ?? 0} of {book.registered_copies ?? 0} accessioned copies available</span>
                              </>
                            ) : <span className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Reference only</span>}
                            <span className="mt-auto inline-flex items-center gap-2 self-end border border-warning px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-warning transition-colors group-hover:bg-warning group-hover:text-warning-foreground">{selectionAction}<ChevronDown className={"h-3.5 w-3.5 transition-transform " + (isSelected ? "rotate-180" : "")} aria-hidden="true" /></span>
                          </div>
                        </button>
                        {isSelected ? (
                          <div id={`recommendations-${book.id}`} className="border border-t-0 border-border bg-secondary/20 px-4 py-5 sm:px-6">
                            <RecommendationStrip seedBookId={book.id} materialType={book.material_type || "book"} title={(book.material_type === "thesis" ? "Related theses for " : "Similar books to ") + book.title} />
                          </div>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </div>
              )}

              {!loading && pagination.totalPages > 1 ? (
                <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
                  <button type="button" className="min-h-11 px-3 text-xs font-semibold text-primary disabled:opacity-40" disabled={pagination.page <= 1} onClick={() => updateParam("page", String(pagination.page - 1), false)}>Previous</button>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</span>
                  <button type="button" className="min-h-11 px-3 text-xs font-semibold text-primary disabled:opacity-40" disabled={pagination.page >= pagination.totalPages} onClick={() => updateParam("page", String(pagination.page + 1), false)}>Next</button>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Catalogue;

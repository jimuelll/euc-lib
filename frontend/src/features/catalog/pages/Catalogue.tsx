import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, LayoutGrid, List, Loader2, Search, X } from "@/components/ui/library-glyphs";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { getApiErrorMessage } from "@/utils/apiError";
import { fetchPublicCatalogSchema, searchPublicCatalogue, type PublicCatalogBook as Book, type PublicCatalogFacets } from "../api";
import { catalogKeys, normalizeCatalogSearch } from "../catalog.keys";
import CatalogueResult, { CatalogueSimilarPanel } from "./CatalogueResult";
import "./catalogue.css";

const EMPTY_FACETS: PublicCatalogFacets = { format: { all: 0, book: 0, thesis: 0 }, availability: { all: 0, available: 0, unavailable: 0 }, categories: [] };

function FilterChoice({ label, count, active, onClick, countsReady }: { label: string; count: number; active: boolean; onClick: () => void; countsReady: boolean }) {
  return <button type="button" aria-pressed={active} disabled={countsReady && count === 0 && !active && !label.startsWith("All ")} onClick={onClick} className="catalogue-filter-choice">
    <span aria-hidden="true" className={"catalogue-filter-check " + (active ? "is-active" : "")}>{active && <Check />}</span>
    <span>{label}</span><span className="catalogue-filter-count">{countsReady ? count : "—"}</span>
  </button>;
}

export default function Catalogue() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const view = searchParams.get("view") === "grid" ? "grid" : "list";
  const recordsRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [columns, setColumns] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 901px)").matches);
  const [advancedOpen, setAdvancedOpen] = useState(() => ["title", "author", "isbn", "year_from"].some(key => searchParams.has(key)));
  const paramsKey = searchParams.toString();
  const params = useMemo(() => new URLSearchParams(paramsKey), [paramsKey]);
  const queryParam = params.get("q") || "";
  const materialType = params.get("format") || "all";
  const availability = params.get("availability") || "all";
  const selectedCategory = params.get("category") || "";
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

  const schemaQuery = useQuery({ queryKey: catalogKeys.schema(), queryFn: ({ signal }) => fetchPublicCatalogSchema(signal) });
  const searchFilters = useMemo(() => normalizeCatalogSearch({
    query: params.get("q") || "", title: params.get("title") || "", author: params.get("author") || "", isbn: params.get("isbn") || "",
    year_from: params.get("year_from") || "", format: materialType, availability, category: selectedCategory, sort, page,
  }), [params, materialType, availability, selectedCategory, sort, page]);
  const catalogQuery = useQuery({
    queryKey: catalogKeys.search(searchFilters), queryFn: ({ signal }) => searchPublicCatalogue(searchFilters, signal),
    placeholderData: previous => previous,
  });
  const books = catalogQuery.data?.rows ?? [];
  const facets = catalogQuery.data?.facets ?? EMPTY_FACETS;
  const pagination = catalogQuery.data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 };
  const countsReady = !!catalogQuery.data && !catalogQuery.isFetching && !catalogQuery.isError;
  const loading = catalogQuery.isPending;
  const error = catalogQuery.isError ? getApiErrorMessage(catalogQuery.error, "Something went wrong while loading the catalogue.") : null;

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 901px)");
    const sync = (event: MediaQueryListEvent | MediaQueryList) => setFiltersOpen(event.matches);
    sync(desktop); desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);
  useEffect(() => setSelectedBook(null), [paramsKey]);
  useEffect(() => {
    if (!filtersOpen || window.matchMedia("(min-width: 901px)").matches) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setFiltersOpen(false); sidebarRef.current?.querySelector("summary")?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  const updateParam = (key: string, value: string, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "all" && !(key === "sort" && value === "relevance")) next.set(key, value);
    else next.delete(key);
    if (resetPage) next.delete("page");
    setSearchParams(next, { replace: true });
  };
  const closePanel = () => {
    setSelectedBook(null);
    triggerRef.current?.focus();
  };
  useEffect(() => {
    if (!selectedBook) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setSelectedBook(null); triggerRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedBook]);
  useEffect(() => {
    const element = recordsRef.current;
    if (!element || view !== "grid") return;
    const measure = () => setColumns(getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length || 1);
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [view, books.length, loading]);
  const selectedIndex = books.findIndex(book => book.id === selectedBook?.id);
  const panelAfter = selectedIndex < 0 ? -1 : Math.min(books.length, Math.ceil((selectedIndex + 1) / columns) * columns) - 1;
  const submitSearch = () => updateParam("q", query.trim());
  const clearFilters = () => {
    setQuery("");
    const next = new URLSearchParams(searchParams);
    for (const key of ["q", "format", "availability", "category", "sort", "title", "author", "isbn", "year_from", "page"]) next.delete(key);
    setSearchParams(next, { replace: true });
  };
  const chips = [
    ...(["q", "title", "author", "isbn", "year_from"] as const).flatMap(key => {
      const value = params.get(key);
      const label = { q: "", title: "Title: ", author: "Author: ", isbn: "ISBN: ", year_from: "From " }[key];
      return value ? [{ key, label: key === "q" ? "“" + value + "”" : label + value }] : [];
    }),
    ...(materialType !== "all" ? [{ key: "format", label: materialType === "thesis" ? "Theses" : "Books" }] : []),
    ...(selectedCategory ? [{ key: "category", label: selectedCategory }] : []),
    ...(availability !== "all" ? [{ key: "availability", label: availability === "available" ? "Available now" : "Unavailable" }] : []),
  ];
  const choice = (key: string, value: string, label: string, count: number, active: boolean) => <FilterChoice key={value} label={label} count={count} active={active} countsReady={countsReady} onClick={() => updateParam(key, active && value !== "all" ? "all" : value)} />;
  const firstResult = (pagination.page - 1) * pagination.limit + 1;
  const lastResult = Math.min(pagination.total, firstResult + books.length - 1);
  const pageNumbers = Array.from(new Set([1, ...Array.from({ length: 5 }, (_, index) => pagination.page + index - 2), pagination.totalPages])).filter(value => value >= 1 && value <= pagination.totalPages).sort((a, b) => a - b);

  return <div className="min-h-screen bg-background"><Navbar />
    <main data-library-design className="catalogue-page"><div className="catalogue-inner">
      <header className="catalogue-heading">
        <h1>Library catalogue</h1><p>Search books and reference theses in the library's collection.</p>
        <form className="catalogue-search" role="search" onSubmit={event => { event.preventDefault(); submitSearch(); }}>
          <label className="sr-only" htmlFor="catalogue-search">Search the public catalogue</label>
          <input id="catalogue-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by title, author, or ISBN…" />
          <button type="submit" className="catalogue-primary">{catalogQuery.isFetching ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}Search</button>
        </form>
        <details className="catalogue-advanced" open={advancedOpen} onToggle={event => setAdvancedOpen(event.currentTarget.open)}>
          <summary><ChevronDown aria-hidden="true" />Advanced search</summary>
          <div className="catalogue-advanced-fields">
            {([["author", "Author"], ["year_from", "Published from (year)"], ["title", "Title"], ["isbn", "ISBN"]] as const).map(([key, label]) => <label key={key}>{label}<input value={params.get(key) || ""} inputMode={key === "year_from" ? "numeric" : undefined} maxLength={key === "year_from" ? 4 : undefined} onChange={event => updateParam(key, key === "year_from" ? event.target.value.replace(/\D/g, "") : event.target.value)} /></label>)}
          </div>
        </details>
        {chips.length > 0 && <div className="catalogue-chips" aria-label="Active filters">{chips.map(chip => <span className="catalogue-chip" key={chip.key}>{chip.label}<button type="button" aria-label={"Remove filter " + chip.label} onClick={() => updateParam(chip.key, "")}><X aria-hidden="true" /></button></span>)}{chips.length > 1 && <button type="button" className="catalogue-text-button" onClick={clearFilters}>Clear all</button>}</div>}
      </header>
      <div className="catalogue-layout">
        <aside ref={sidebarRef} className="catalogue-sidebar" aria-label="Catalogue filters"><details open={filtersOpen} onToggle={event => setFiltersOpen(event.currentTarget.open)}>
          <summary><span className="catalogue-filter-desktop-label">Filter results</span><span className="catalogue-filter-mobile-label">Filters</span><ChevronDown aria-hidden="true" /></summary>
          <fieldset className="catalogue-filter-group"><legend>Format</legend>
            {choice("format", "all", "All formats", facets.format.all, materialType === "all")}
            {choice("format", "book", "Books", facets.format.book, materialType === "book")}
            {choice("format", "thesis", "Theses", facets.format.thesis, materialType === "thesis")}
          </fieldset>
          <fieldset className="catalogue-filter-group"><legend>Availability</legend>
            {choice("availability", "all", "All items", facets.availability.all, availability === "all")}
            {choice("availability", "available", "Available", facets.availability.available, availability === "available")}
            {choice("availability", "unavailable", "Unavailable", facets.availability.unavailable, availability === "unavailable")}
            <p>Availability counts accessioned books.</p>
          </fieldset>
          <fieldset className="catalogue-filter-group"><legend>Category</legend><div className="catalogue-category-options">
            {facets.categories.length ? facets.categories.map(category => choice("category", category.value, category.value, category.count, selectedCategory.toLocaleLowerCase() === category.value.toLocaleLowerCase())) : <p>No categories in this result set.</p>}
          </div></fieldset>
          <button type="button" className="catalogue-text-button catalogue-clear" onClick={clearFilters}>Clear filters</button>
        </details></aside>
        <section className="catalogue-results" aria-label="Catalogue results" aria-busy={catalogQuery.isFetching}>
          <div className="catalogue-results-bar">
            <span className="catalogue-result-count" aria-live="polite">{loading ? "Loading catalogue…" : pagination.total ? "Showing " + firstResult + "–" + lastResult + " of " + pagination.total : "No results"}</span>
            <label className="catalogue-available-toggle"><input type="checkbox" role="switch" checked={availability === "available"} onChange={event => updateParam("availability", event.target.checked ? "available" : "all")} /><i aria-hidden="true">{availability === "available" && <Check />}</i><span>Available now ({countsReady ? facets.availability.available : "—"})</span></label>
            <label className="sr-only" htmlFor="catalogue-sort">Sort by</label><select id="catalogue-sort" value={sort} onChange={event => updateParam("sort", event.target.value)}><option value="relevance">Relevance</option><option value="title_asc">Title A–Z</option><option value="title_desc">Title Z–A</option><option value="most_available">Most available</option><option value="newest">Newest first</option></select>
            <div className="catalogue-view-toggle" aria-label="Result view"><button type="button" aria-label="List view" aria-pressed={view === "list"} onClick={() => updateParam("view", "list", false)}><List aria-hidden="true" /></button><button type="button" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => updateParam("view", "grid", false)}><LayoutGrid aria-hidden="true" /></button></div>
          </div>
          {error && <div className="catalogue-error" role="alert"><p>{error}</p><button type="button" className="catalogue-text-button" onClick={() => void catalogQuery.refetch()}>Try again</button></div>}
          {loading ? <div className="catalogue-loading" role="status" aria-label="Loading catalogue results">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-32 w-full" />)}</div> :
            books.length === 0 ? !error && <div className="catalogue-empty"><b>No titles match your filters.</b><p>Try fewer filters or a different spelling.</p><button type="button" className="catalogue-primary" onClick={clearFilters}>Clear all filters</button></div> :
            <div ref={recordsRef} className={"catalogue-records is-" + view}>{books.map((book, index) => <Fragment key={book.id}>
              <CatalogueResult book={book} schema={schemaQuery.data ?? []} grid={view === "grid"} expanded={selectedBook?.id === book.id} onClose={closePanel} onToggle={trigger => {
                if (selectedBook?.id === book.id) closePanel();
                else { triggerRef.current = trigger; setSelectedBook(book); }
              }} />
              {view === "grid" && index === panelAfter && selectedBook && <div className="catalogue-panel-row" style={{ "--source-column": selectedIndex % columns, "--grid-columns": columns } as CSSProperties}><CatalogueSimilarPanel key={selectedBook.id} book={selectedBook} onClose={closePanel} /></div>}
            </Fragment>)}</div>}
          {!loading && pagination.totalPages > 1 && <nav className="catalogue-pagination" aria-label="Catalogue pages">
            <button type="button" disabled={pagination.page <= 1} onClick={() => updateParam("page", String(pagination.page - 1), false)}>Previous</button>
            {pageNumbers.map((value, index) => <span key={value}>{index > 0 && value - pageNumbers[index - 1] > 1 && <span className="catalogue-page-gap">…</span>}<button type="button" aria-label={"Page " + value} aria-current={value === pagination.page ? "page" : undefined} onClick={() => updateParam("page", String(value), false)}>{value}</button></span>)}
            <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => updateParam("page", String(pagination.page + 1), false)}>Next</button>
          </nav>}
        </section>
      </div>
    </div></main><Footer />
  </div>;
}

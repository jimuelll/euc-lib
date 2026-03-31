import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/utils/AxiosInstance";

interface Book {
  id: number;
  title: string;
  author?: string;
  isbn?: string;
  category?: string;
  edition?: string;
  publication_year?: number;
  copies?: number;
  [key: string]: unknown;
}

interface SchemaField {
  key: string;
  label: string;
  type: string;
  order: number;
  locked?: boolean;
  public?: boolean;
}

const CORE_KEYS = new Set(["id", "title", "author", "isbn", "category", "edition", "publication_year", "copies"]);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3">
    <div className="h-px w-6 bg-warning shrink-0" />
    <p
      className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {children}
    </p>
  </div>
);

const Catalogue = () => {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") || "");

  const [books, setBooks]             = useState<Book[]>([]);
  const [schema, setSchema]           = useState<SchemaField[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    const nextQuery = searchParams.get("q") || "";
    setQuery((currentQuery) => (currentQuery === nextQuery ? currentQuery : nextQuery));
  }, [searchParams]);

  useEffect(() => {
    const trimmedQuery = debouncedQuery.trim();
    const currentQuery = searchParams.get("q") || "";

    if (trimmedQuery === currentQuery) return;

    const nextParams = new URLSearchParams(searchParams);
    if (trimmedQuery) {
      nextParams.set("q", trimmedQuery);
    } else {
      nextParams.delete("q");
    }

    setSearchParams(nextParams, { replace: true });
  }, [debouncedQuery, searchParams, setSearchParams]);

  useEffect(() => {
    axiosInstance.get("api/admin/catalog-schema")
      .then((res) => setSchema(res.data))
      .catch(() => {});
  }, []);

  const searchBooks = useCallback(async (q: string) => {
    if (!q.trim()) { setBooks([]); setHasSearched(false); return; }
    if (authLoading) return;

    if (!isLoggedIn) {
      setBooks([]);
      setHasSearched(true);
      setError("Catalogue search requires login access.");
      return;
    }

    setLoading(true); setError(null); setHasSearched(true);
    try {
      const res = await axiosInstance.get("api/admin/catalogue/search", { params: { query: q.trim() } });
      setBooks(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Something went wrong");
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [authLoading, isLoggedIn]);

  useEffect(() => { searchBooks(debouncedQuery); }, [debouncedQuery, searchBooks]);

  const extraFields = schema
    .filter((f) => f.public && !CORE_KEYS.has(f.key))
    .sort((a, b) => a.order - b.order);

  const getLabelForKey = (key: string) => schema.find((f) => f.key === key)?.label ?? key;

  const getCopiesLabel = (copies?: number) => {
    if (copies === undefined || copies === null) return null;
    return copies <= 0 ? { available: false } : { available: true };
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Page header band ──
          bg-primary matches the navbar, then a black/20 overlay steps it
          visibly darker in both light and dark mode without hardcoding HSL. */}
      <div className="bg-primary relative overflow-hidden">
        {/* Depth overlay */}
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />
        {/* Gold top rule */}
        <div className="relative z-10 h-[3px] w-full bg-warning" />
        {/* Louvered texture */}
        <div
          className="absolute inset-0 z-10 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
          }}
        />
        {/* Gold left spine */}
        <div className="absolute inset-y-0 left-0 z-10 w-[3px] bg-warning" />
        {/* Bottom border */}
        <div className="absolute inset-x-0 bottom-0 z-10 h-px bg-black/30" />

        <div className="container relative z-20 px-4 sm:px-6 py-14 md:py-16">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px w-6 bg-warning shrink-0" />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Enverga-Candelaria Library
            </span>
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-primary-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Book Catalogue
          </h1>
          <p className="mt-3 text-sm text-primary-foreground/50 max-w-lg leading-relaxed">
            Search and browse the library's collection.
          </p>

          {/* Search input */}
          <div className="mt-8 relative max-w-xl">
            <div className="absolute inset-y-0 left-0 w-[3px] bg-warning z-10" />
            <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-warning/50 pointer-events-none z-10" />
            {loading && (
              <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-warning/50 z-10" />
            )}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, author, or ISBN…"
              className="h-12 w-full border-0 pl-12 pr-11 text-sm outline-none transition-colors duration-150 placeholder:text-primary-foreground/30"
              style={{
                backgroundColor: "hsl(var(--primary) / 0.5)",
                color: "hsl(var(--primary-foreground))",
                fontFamily: "var(--font-body)",
                caretColor: "hsl(var(--warning))",
              }}
              onFocus={(e) => { e.currentTarget.style.backgroundColor = "hsl(var(--primary) / 0.7)"; }}
              onBlur={(e)  => { e.currentTarget.style.backgroundColor = "hsl(var(--primary) / 0.5)"; }}
            />
          </div>
        </div>
      </div>

      {/* ── Results — parchment ground ── */}
      <main className="bg-background">
        <div className="container px-4 sm:px-6 py-10 md:py-14">

          {error && (
            <div className="mb-6 border-l-2 border-destructive bg-destructive/5 px-5 py-3.5">
              <p className="text-xs text-destructive" style={{ fontFamily: "var(--font-heading)" }}>{error}</p>
            </div>
          )}

          {!loading && !error && !hasSearched && (
            <div className="py-16 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground/40" style={{ fontFamily: "var(--font-heading)" }}>
                Start typing to search the catalogue
              </p>
            </div>
          )}

          {!loading && !error && hasSearched && books.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground/40" style={{ fontFamily: "var(--font-heading)" }}>
                No books found matching your search
              </p>
            </div>
          )}

          {!loading && !error && hasSearched && books.length > 0 && (
            <div className="flex items-center border-b border-border pb-4">
              <SectionLabel>{books.length} result{books.length !== 1 ? "s" : ""} found</SectionLabel>
            </div>
          )}

          {books.length > 0 && (
            <div className="border-l border-border">
              {books.map((book, index) => {
                const copies = getCopiesLabel(book.copies as number | undefined);
                return (
                  <div
                    key={book.id}
                    className="border-b border-r border-border bg-background flex items-start gap-6 transition-colors duration-100 hover:bg-secondary/50"
                    style={{ padding: "1.75rem 2rem" }}
                  >
                    <span
                      className="text-[10px] font-bold tracking-[0.15em] text-border shrink-0 mt-0.5 w-6 text-right"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold tracking-tight text-foreground truncate" style={{ fontFamily: "var(--font-heading)" }}>
                        {book.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
                        {book.author && <span className="text-xs text-muted-foreground">{book.author}</span>}
                        {book.category && <><span className="text-border text-xs">·</span><span className="text-xs text-muted-foreground">{book.category}</span></>}
                        {book.edition && <><span className="text-border text-xs">·</span><span className="text-xs text-muted-foreground">{book.edition} ed.</span></>}
                        {book.publication_year && <><span className="text-border text-xs">·</span><span className="text-xs text-muted-foreground">{book.publication_year}</span></>}
                      </div>
                      {book.isbn && (
                        <p className="text-[10px] tracking-[0.08em] text-muted-foreground/50 mt-1.5" style={{ fontFamily: "var(--font-heading)" }}>
                          ISBN {book.isbn}
                        </p>
                      )}
                      {extraFields.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                          {extraFields.map((field) => {
                            const val = book[field.key];
                            if (val === undefined || val === null || val === "") return null;
                            return (
                              <span key={field.key} className="text-[11px] text-muted-foreground">
                                <span className="font-bold uppercase tracking-[0.1em] text-muted-foreground/50" style={{ fontFamily: "var(--font-heading)" }}>
                                  {getLabelForKey(field.key)}
                                </span>{" "}{String(val)}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {copies && (
                      <div className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
                        <span
                          className="text-[10px] font-bold uppercase tracking-[0.15em]"
                          style={{ fontFamily: "var(--font-heading)", color: copies.available ? "hsl(var(--success))" : "hsl(var(--destructive))" }}
                        >
                          {copies.available ? "Available" : "Checked Out"}
                        </span>
                        {copies.available && book.copies && (
                          <span className="text-[10px] tracking-wide text-muted-foreground/50" style={{ fontFamily: "var(--font-heading)" }}>
                            {book.copies} cop{book.copies === 1 ? "y" : "ies"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Catalogue;

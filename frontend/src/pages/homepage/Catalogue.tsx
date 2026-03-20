import { useState, useEffect, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useDebounce } from "@/hooks/use-debounce";
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

const Catalogue = () => {
  const [query, setQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  });

  const [books, setBooks]   = useState<Book[]>([]);
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const debouncedQuery = useDebounce(query, 400);

  // Fetch schema to know labels for extra public fields
  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const res = await axiosInstance.get("api/admin/catalog-schema");
        setSchema(res.data);
      } catch {
        // silently ignore — labels fall back to key names
      }
    };
    fetchSchema();
  }, []);

  const searchBooks = useCallback(async (q: string) => {
    if (!q.trim()) {
      setBooks([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await axiosInstance.get("api/admin/catalogue/search", {
        params: { query: q.trim() },
      });
      setBooks(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Something went wrong");
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    searchBooks(debouncedQuery);
  }, [debouncedQuery, searchBooks]);

  // Extra public fields that aren't part of the core display
  const extraFields = schema
    .filter((f) => f.public && !CORE_KEYS.has(f.key))
    .sort((a, b) => a.order - b.order);

  const getLabelForKey = (key: string) =>
    schema.find((f) => f.key === key)?.label ?? key;

  const getCopiesLabel = (copies?: number) => {
    if (copies === undefined || copies === null) return null;
    if (copies <= 0) return { label: "Checked Out", available: false };
    return { label: `${copies} cop${copies === 1 ? "y" : "ies"} available`, available: true };
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="py-24">
        <div className="container">
          <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Book Catalogue
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Search and browse the library's collection.
          </p>

          <div className="mt-8 flex justify-center">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, author, or ISBN..."
                className="h-11 w-full rounded-md border bg-background pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="mt-8 space-y-3">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {!loading && !error && hasSearched && books.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No books found matching your search.
              </p>
            )}

            {!hasSearched && !loading && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Start typing to search the catalogue.
              </p>
            )}

            {books.map((book) => {
              const copies = getCopiesLabel(book.copies as number | undefined);
              return (
                <div
                  key={book.id}
                  className="flex items-start justify-between rounded-lg border bg-card p-4 gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading text-sm font-medium text-foreground truncate">
                      {book.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {book.author}
                      {book.category ? ` · ${book.category}` : ""}
                      {book.edition ? ` · ${book.edition} ed.` : ""}
                      {book.publication_year ? ` · ${book.publication_year}` : ""}
                    </p>
                    {book.isbn && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        ISBN: {book.isbn}
                      </p>
                    )}
                    {extraFields.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                        {extraFields.map((field) => {
                          const val = book[field.key];
                          if (val === undefined || val === null || val === "") return null;
                          return (
                            <span key={field.key} className="text-xs text-muted-foreground">
                              <span className="font-medium">{getLabelForKey(field.key)}:</span>{" "}
                              {String(val)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Availability — wired to borrowing system later */}
                  {copies && (
                    <span
                      className={`shrink-0 text-xs font-medium ${
                        copies.available ? "text-success" : "text-destructive"
                      }`}
                    >
                      {copies.available ? "Available" : "Checked Out"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Catalogue;
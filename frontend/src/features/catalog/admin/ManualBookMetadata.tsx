import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchManualBookMetadata, fetchManualMetadataBooks, saveManualBookMetadata, type ManualBookMetadata, type ManualMetadataBook } from "./catalog.api";
import { Check, CircleAlert, LoaderCircle, Search, Sparkles } from "lucide-react";
import { catalogKeys } from "../catalog.keys";
import { useDebounce } from "@/hooks/use-debounce";
import { getApiErrorMessage } from "@/utils/apiError";

const statusLabel: Record<ManualMetadataBook["metadataStatus"], string> = {
  missing: "Needs details",
  failed: "Lookup failed",
  ready: "Details found",
  manual: "Added by staff",
};

const statusClass: Record<ManualMetadataBook["metadataStatus"], string> = {
  missing: "border-warning/30 bg-warning/5 text-warning-foreground",
  failed: "border-destructive/25 bg-destructive/5 text-destructive",
  ready: "border-border bg-muted/30 text-muted-foreground",
  manual: "border-success/25 bg-success/5 text-success",
};

const synopsisLabel: Record<ManualMetadataBook["synopsisStatus"], string> = {
  present: "Synopsis added",
  not_checked: "Synopsis not checked",
  no_description: "No online synopsis",
  lookup_failed: "Synopsis lookup failed",
  missing: "Synopsis missing",
};

const synopsisClass: Record<ManualMetadataBook["synopsisStatus"], string> = {
  present: "border-success/25 bg-success/5 text-success",
  not_checked: "border-warning/45 bg-warning/10 text-foreground",
  no_description: "border-warning/45 bg-warning/10 text-foreground",
  lookup_failed: "border-destructive/25 bg-destructive/5 text-destructive",
  missing: "border-warning/45 bg-warning/10 text-foreground",
};

const ManualBookMetadata = ({ backfillRevision = 0 }: { backfillRevision?: number }) => {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedBook, setSelectedBook] = useState<ManualMetadataBook | null>(null);
  const [summary, setSummary] = useState("");
  const [subjectsText, setSubjectsText] = useState("");
  const [publisher, setPublisher] = useState("");
  const [categoriesText, setCategoriesText] = useState("");
  const [language, setLanguage] = useState("");
  const [pageCountText, setPageCountText] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [formError, setFormError] = useState("");
  const debouncedQuery = useDebounce(query.trim(), 220);
  const booksQuery = useQuery({
    queryKey: catalogKeys.manualMetadataBooks({ query: debouncedQuery, needsAttention: !debouncedQuery, page }),
    queryFn: ({ signal }) => fetchManualMetadataBooks({ query: debouncedQuery, needsAttention: !debouncedQuery, page }, signal),
    placeholderData: keepPreviousData,
  });
  const detailsQuery = useQuery({
    queryKey: catalogKeys.manualBookMetadata(selectedBook?.id ?? 0),
    queryFn: ({ signal }) => fetchManualBookMetadata(selectedBook!.id, signal),
    enabled: Boolean(selectedBook),
  });
  const books = booksQuery.data?.rows ?? [];
  const total = booksQuery.data?.pagination.total ?? 0;
  const totalPages = booksQuery.data?.pagination.totalPages ?? 1;
  const loadingBooks = booksQuery.isFetching;
  const listError = booksQuery.isError ? getApiErrorMessage(booksQuery.error, "Books could not be loaded. Try again.") : "";
  const details = detailsQuery.data ?? null;
  const loadingDetails = detailsQuery.isPending;
  const saveMutation = useMutation({
    mutationFn: ({ bookId, payload }: { bookId: number; payload: Parameters<typeof saveManualBookMetadata>[1] }) => saveManualBookMetadata(bookId, payload),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: catalogKeys.embeddings() });
      await queryClient.invalidateQueries({ queryKey: catalogKeys.manualBookMetadata(variables.bookId) });
    },
  });
  const saving = saveMutation.isPending;
  const searchingAllBooks = Boolean(query.trim());

  useEffect(() => {
    if (backfillRevision > 0) void queryClient.invalidateQueries({ queryKey: catalogKeys.embeddings() });
  }, [backfillRevision, queryClient]);

  useEffect(() => {
    const result = detailsQuery.data;
    if (!result || result.book.id !== selectedBook?.id) return;
    setSummary(result.summary);
    setSubjectsText(result.subjects.join("\n"));
    setPublisher(result.additionalDetails.publisher);
    setCategoriesText(result.additionalDetails.categories.join("\n"));
    setLanguage(result.additionalDetails.language);
    setPageCountText(result.additionalDetails.pageCount == null ? "" : String(result.additionalDetails.pageCount));
    setPublishedDate(result.additionalDetails.publishedDate);
  }, [detailsQuery.data, selectedBook?.id]);

  const openBook = (book: ManualMetadataBook) => {
    setSelectedBook(book);
    setSummary("");
    setSubjectsText("");
    setPublisher("");
    setCategoriesText("");
    setLanguage("");
    setPageCountText("");
    setPublishedDate("");
    setFormError("");
  };

  const closeEditor = () => {
    if (saving) return;
    setSelectedBook(null);
    setFormError("");
  };

  const save = async () => {
    if (!selectedBook || !details) return;
    const subjects = [...new Set(subjectsText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean))];
    const categories = [...new Set(categoriesText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean))];
    const cleanPageCount = pageCountText.trim() ? Number(pageCountText) : null;
    if (!summary.trim() && !subjects.length && !publisher.trim() && !categories.length && !language.trim() && cleanPageCount == null && !publishedDate.trim()) {
      setFormError("Add at least one book detail before saving.");
      return;
    }
    if (cleanPageCount != null && (!Number.isInteger(cleanPageCount) || cleanPageCount < 1 || cleanPageCount > 100000)) {
      setFormError("Page count must be a whole number from 1 to 100,000.");
      return;
    }
    setFormError("");
    try {
      const result = await saveMutation.mutateAsync({ bookId: selectedBook.id, payload: {
        summary: summary.trim(), subjects,
        additionalDetails: { publisher: publisher.trim(), categories, language: language.trim(), pageCount: cleanPageCount, publishedDate: publishedDate.trim() },
      } });
      setSummary(result.summary);
      setSubjectsText(result.subjects.join("\n"));
      setPublisher(result.additionalDetails.publisher);
      setCategoriesText(result.additionalDetails.categories.join("\n"));
      setLanguage(result.additionalDetails.language);
      setPageCountText(result.additionalDetails.pageCount == null ? "" : String(result.additionalDetails.pageCount));
      setPublishedDate(result.additionalDetails.publishedDate);
      if (result.embeddingStatus === "ready") {
        if (summary.trim()) toast.success("Book details saved and AI recommendations updated.");
        else toast.warning("Book details saved. The AI synopsis is still missing.");
        setSelectedBook(null);
      } else {
        const message = `Your book details were saved, but AI recommendations could not be updated: ${result.embeddingError || "Please try again later."}`;
        setFormError(message);
        toast.error("Details saved; AI update needs attention.");
      }
    } catch (error: unknown) {
      setFormError(getApiErrorMessage(error, "Details could not be saved. Check your connection and try again."));
    }
  };

  const metadataStatus = details?.metadataStatus || selectedBook?.metadataStatus;
  const currentSynopsisStatus = details?.synopsisStatus || selectedBook?.synopsisStatus;
  return (
    <>
      <section aria-labelledby="manual-ai-details-heading" className="rounded-md border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="manual-ai-details-heading" className="text-base font-semibold text-foreground">Add book details for recommendations</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Add or correct book details here. Saved details help the system suggest similar books.</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><Sparkles className="size-4" />Private AI details</span>
        </div>

        <div className="space-y-4 p-5">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search books by title, author, or ISBN" className="pl-9" placeholder="Search any book by title, author, or ISBN" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
          </div>
          <p className="text-xs leading-5 text-muted-foreground" aria-live="polite">
            {searchingAllBooks ? "Search results include books with and without AI details." : "Showing active books missing a synopsis, useful details, or a ready embedding. Search above to open any active book."}
          </p>

          {loadingBooks && !booksQuery.data ? <div className="space-y-2" aria-label="Loading books">{[0, 1, 2].map((item) => <div key={item} className="h-[68px] animate-pulse rounded-md bg-muted/60" />)}</div> : listError && !booksQuery.data ? (
            <Alert variant="destructive"><CircleAlert className="size-4" /><AlertDescription className="flex flex-wrap items-center justify-between gap-3">{listError}<Button size="sm" variant="outline" onClick={() => void booksQuery.refetch()}>Try again</Button></AlertDescription></Alert>
          ) : books.length ? (
            <>
              <ul className="divide-y divide-border rounded-md border border-border" aria-label={searchingAllBooks ? "Book search results" : "Books needing an AI update"}>
                {books.map((book) => <li key={book.id}>
                  <button type="button" onClick={() => void openBook(book)} className="flex w-full flex-col gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{book.title}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">{book.author || "Author not listed"}{book.isbn ? ` · ISBN ${book.isbn}` : " · No ISBN"}</span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <span className={`inline-flex items-center rounded-sm border px-2 py-1 text-xs font-medium ${statusClass[book.metadataStatus]}`}>{book.metadataStatus === "ready" ? "Other details found" : statusLabel[book.metadataStatus]}</span>
                      <span className={`inline-flex items-center rounded-sm border px-2 py-1 text-xs font-medium ${synopsisClass[book.synopsisStatus]}`}>{synopsisLabel[book.synopsisStatus]}</span>
                      <span className="text-xs text-muted-foreground">{book.embeddingStatus === "ready" ? "Embedding ready" : "Embedding update needed"}</span>
                    </span>
                  </button>
                </li>)}
              </ul>
              <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{total} book{total === 1 ? "" : "s"}</span>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
                  <span className="tabular-nums">Page {page} of {totalPages}</span>
                  <Button type="button" size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border px-5 py-8 text-center">
              <Check className="mx-auto size-5 text-success" />
              <p className="mt-2 text-sm font-medium text-foreground">{searchingAllBooks ? "No books found" : "No books need an AI update"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{searchingAllBooks ? "Try another title, author, or ISBN." : "All active books have a synopsis, useful details, and a ready AI embedding. Search above to review a book."}</p>
            </div>
          )}
        </div>
      </section>

      <Sheet open={Boolean(selectedBook)} onOpenChange={(open) => { if (!open) closeEditor(); }}>
        <SheetContent className="admin-edit-sheet grid h-full w-full grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[560px]" onEscapeKeyDown={(event) => { if (saving) event.preventDefault(); }}>
          <SheetHeader className="shrink-0 border-b border-border bg-primary px-6 py-5 pr-12 text-left text-primary-foreground">
            <SheetTitle className="text-primary-foreground">Add AI details</SheetTitle>
            <SheetDescription className="text-primary-foreground/80">{selectedBook?.title || "Book"}{selectedBook?.author ? ` · ${selectedBook.author}` : ""}</SheetDescription>
          </SheetHeader>
          {loadingDetails ? <div className="space-y-4 p-6" aria-label="Loading book details"><div className="h-5 w-2/3 animate-pulse rounded bg-muted" /><div className="h-28 animate-pulse rounded bg-muted" /><div className="h-24 animate-pulse rounded bg-muted" /></div> : detailsQuery.isError ? <div role="alert" className="m-6 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{getApiErrorMessage(detailsQuery.error, "Book details could not be loaded.")}<Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => void detailsQuery.refetch()}>Try again</Button></div> : (
            <div className="flex min-h-0 flex-col overflow-y-auto">
              <div className="flex-1 space-y-5 px-6 py-5">
                {selectedBook?.isbn ? <p className="text-xs text-muted-foreground">ISBN {selectedBook.isbn}</p> : <p className="text-xs text-muted-foreground">No ISBN is recorded. You can still add details below.</p>}
                {metadataStatus === "failed" ? <Alert variant="destructive"><CircleAlert className="size-4" /><AlertDescription>The online details lookup failed{details?.metadataError ? `: ${details.metadataError}` : "."} This is separate from its AI embedding status. You can still add details below.</AlertDescription></Alert> : null}
                {metadataStatus === "ready" ? <Alert><Sparkles className="size-4" /><AlertDescription>Other book details were found online. Review them and correct anything that looks wrong.</AlertDescription></Alert> : null}
                {metadataStatus === "manual" ? <Alert><Check className="size-4" /><AlertDescription>These details were added by library staff. You can update them here.</AlertDescription></Alert> : null}
                {currentSynopsisStatus === "lookup_failed" ? <Alert variant="destructive"><CircleAlert className="size-4" /><AlertDescription>The synopsis lookup failed{details?.synopsisError ? `: ${details.synopsisError}` : ". You can retry Backfill later or add the synopsis manually."}</AlertDescription></Alert> : null}
                {currentSynopsisStatus === "no_description" ? <Alert><Sparkles className="size-4" /><AlertDescription>The available online sources did not provide a synopsis. Add one manually if available.</AlertDescription></Alert> : null}
                {currentSynopsisStatus === "not_checked" ? <Alert><Sparkles className="size-4" /><AlertDescription>No synopsis has been imported yet. Backfill checks Open Library first, then Google Books, and Hardcover when configured.</AlertDescription></Alert> : null}
                {currentSynopsisStatus === "missing" ? <Alert><CircleAlert className="size-4" /><AlertDescription>No AI synopsis is recorded. You can add one manually below.</AlertDescription></Alert> : null}

                <section aria-labelledby="other-book-details-heading" className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
                  <div>
                    <h3 id="other-book-details-heading" className="text-sm font-semibold text-foreground">Other book details</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{details?.source === "openlibrary_googlebooks" ? "Review and edit the details found during the ISBN lookup." : "Add any other details you know about the book."}</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor="ai-book-publisher">Publisher</Label><Input id="ai-book-publisher" maxLength={200} placeholder="Publisher name" value={publisher} onChange={(event) => setPublisher(event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="ai-book-language">Language</Label><Input id="ai-book-language" maxLength={80} placeholder="For example, English" value={language} onChange={(event) => setLanguage(event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="ai-book-page-count">Page count</Label><Input id="ai-book-page-count" type="number" min={1} max={100000} step={1} placeholder="Number of pages" value={pageCountText} onChange={(event) => setPageCountText(event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="ai-book-published-date">Publication date</Label><Input id="ai-book-published-date" maxLength={64} placeholder="For example, 2021 or May 2021" value={publishedDate} onChange={(event) => setPublishedDate(event.target.value)} /></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="ai-book-categories">Categories</Label><Textarea id="ai-book-categories" className="min-h-24 resize-y" placeholder={"One category per line, for example:\nHistory\nNatural science"} value={categoriesText} onChange={(event) => setCategoriesText(event.target.value)} /><p className="text-xs leading-5 text-muted-foreground">Add one category per line.</p></div>
                </section>

                <div className="space-y-2">
                  <Label htmlFor="ai-book-summary">What is this book about?</Label>
                  <Textarea id="ai-book-summary" className="min-h-36 resize-y" maxLength={8000} placeholder="Write a few sentences about the book’s main ideas or story." value={summary} onChange={(event) => setSummary(event.target.value)} />
                  <p className="text-xs leading-5 text-muted-foreground">A short description is enough. Leave this blank if you only know the topics.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-book-subjects">Subjects or topics</Label>
                  <Textarea id="ai-book-subjects" className="min-h-28 resize-y" placeholder={"One topic per line, for example:\nPhilippine history\nEcology\nStudy skills"} value={subjectsText} onChange={(event) => setSubjectsText(event.target.value)} />
                  <p className="text-xs leading-5 text-muted-foreground">Add one topic per line. Enter at least one detail in this form to save.</p>
                </div>
                {formError ? <Alert variant={formError.startsWith("Your book details were saved") ? "default" : "destructive"}><CircleAlert className="size-4" /><AlertDescription>{formError}</AlertDescription></Alert> : null}
              </div>
              <SheetFooter className="sticky bottom-0 shrink-0 border-t border-border bg-background px-6 py-4">
                <Button type="button" variant="outline" disabled={saving} onClick={closeEditor}>Cancel</Button>
                <Button type="button" disabled={saving || loadingDetails || !details} onClick={() => void save()}>{saving ? <><LoaderCircle className="mr-2 size-4 animate-spin" />Saving and updating…</> : "Save details"}</Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default ManualBookMetadata;

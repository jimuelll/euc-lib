import { useState, useEffect, useRef } from "react";
import {
  Input,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useAdminConfirmDialog } from "../components/useAdminConfirmDialog";
import { FormField, Book, type BookType, type CatalogFormValue, type CatalogFormValues } from "./AdminCatalog.types";
import { archiveCatalogBook, createCatalogBook, fetchBookTypes, fetchCatalogBarcode, fetchCatalogBookCopies, lookupBookIsbn, restoreCatalogBook, searchCatalogBooks, updateCatalogBook, updateCatalogCopyCondition, type CatalogCopy } from "./catalog.api";
import { getApiErrorMessage } from "@/utils/apiError";
import CatalogCreateForm from "./components/CatalogCreateForm";
import CatalogEditForm from "./components/CatalogEditForm";
import BookCopiesModal from "./components/BookCopiesModal";
import { Library, Loader2, Search, ArchiveRestore, Archive, Printer } from "lucide-react";
import { printCodeLabel } from "@/utils/printCodeLabel";
import { SegmentedNavigation } from "../components/SegmentedNavigation";
import { Skeleton } from "@/components/ui/skeleton";

type Props = { fields: FormField[] };
type ApiFieldError = { response?: { data?: { fields?: Record<string, string> } } };
const getServerFieldErrors = (error: unknown): Record<string, string> =>
  (error as ApiFieldError)?.response?.data?.fields ?? {};

// ─── Shared primitives ────────────────────────────────────────────────────────

const PanelLabel = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-muted/30">
    <div className="flex items-center gap-2.5">
      <div className="h-px w-4 bg-warning shrink-0" />
      <p
        className="text-base font-semibold text-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {children}
      </p>
    </div>
    {action}
  </div>
);

// ─── Barcode strip ────────────────────────────────────────────────────────────

const BookBarcodeStrip = ({ bookId }: { bookId: number }) => {
  const [copies,  setCopies]  = useState<CatalogCopy[]>([]);
  const [urls,    setUrls]    = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [updatingCopyId, setUpdatingCopyId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true); setCopies([]); setUrls({});
    fetchCatalogBookCopies(bookId)
      .then(setCopies)
      .catch(() => setCopies([]))
      .finally(() => setLoading(false));
  }, [bookId]);

  useEffect(() => {
    if (!copies.length) return;
    copies.forEach(async (copy) => {
      try {
        const url = await fetchCatalogBarcode(copy.barcode);
        setUrls((prev) => ({ ...prev, [copy.barcode]: url }));
      } catch {
        return;
      }
    });
    return () => {
      setUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
    };
  }, [copies]);

  const updateCondition = async (copy: CatalogCopy, condition: CatalogCopy["condition"]) => {
    setUpdatingCopyId(copy.id);
    try {
      await updateCatalogCopyCondition(copy.id, condition);
      setCopies((current) => current.map((item) => item.id === copy.id ? { ...item, condition } : item));
      toast.success(`Condition updated for ${copy.barcode}`);
    } catch {
      toast.error("Could not update this copy's condition");
    } finally { setUpdatingCopyId(null); }
  };

  if (loading) return (
    <div className="mt-5 flex items-center gap-2 py-4 text-muted-foreground border border-border px-4">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-warning" />
      <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50"
        style={{ fontFamily: "var(--font-heading)" }}>
        Loading copies…
      </span>
    </div>
  );

  if (!copies.length) return null;

  return (
    <div className="mt-5 border border-border">
      <PanelLabel>Physical Copies &amp; Barcodes</PanelLabel>
      <div className="flex flex-wrap divide-x divide-border">
        {copies.map((copy) => (
          <div
            key={copy.id}
            className={`flex flex-col items-center gap-2 p-4 bg-background min-w-[100px] ${!copy.is_active ? "opacity-40" : ""}`}
          >
            {urls[copy.barcode] ? (
              <img
                src={urls[copy.barcode]}
                alt={copy.barcode}
                className="h-10 w-auto bg-white border border-border p-1"
              />
            ) : (
              <div className="h-10 w-24 border border-border bg-muted flex items-center justify-center">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/30" />
              </div>
            )}
            <span className="font-mono text-[10px] text-muted-foreground/50">{copy.barcode}</span>
            <button type="button" aria-label={`Print label for ${copy.barcode}`} onClick={() => { const url = urls[copy.barcode]; if (!url) return toast.error("Barcode not loaded yet"); if (!printCodeLabel({ imageUrl: url, title: "Library book copy", code: copy.barcode, kind: "Library book copy" })) toast.error("Allow pop-ups to print this label."); }} disabled={!copy.is_active || !urls[copy.barcode]} className="flex items-center gap-1 border border-border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30" style={{ fontFamily: "var(--font-heading)" }}><Printer className="h-3 w-3" />Print</button>
            <span
              className={`text-[10px] font-bold uppercase tracking-[0.12em] border px-2 py-0.5 ${
                copy.status === "borrowed"
                  ? "border-destructive/30 text-destructive bg-destructive/5"
                  : copy.status === "reserved"
                    ? "border-warning/30 text-warning bg-warning/5"
                  : "border-success/30 text-success bg-success/5"
              }`}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {copy.status}
            </span>
            <label className="w-full text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>
              Condition
              <select aria-label={`Condition for ${copy.barcode}`} value={copy.condition} disabled={!copy.is_active || copy.status !== "available" || updatingCopyId === copy.id} onChange={(event) => void updateCondition(copy, event.target.value as CatalogCopy["condition"])} className="mt-1 h-8 w-full border border-border bg-background px-1 text-xs font-semibold normal-case tracking-normal text-foreground disabled:opacity-50">
                <option value="good">Good</option><option value="damaged">Damaged</option><option value="lost">Lost</option>
              </select>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const AdminCatalogData = ({ fields }: Props) => {
  const [catalogMode,   setCatalogMode]   = useState<"create" | "edit">("edit");
  const [materialType,  setMaterialType]  = useState<"book" | "thesis">("book");
  const [isbnLookup,    setIsbnLookup]    = useState(false);
  const [formValues,    setFormValues]    = useState<CatalogFormValues>({});
  const [loading,       setLoading]       = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [catalogFilter, setCatalogFilter] = useState<"all" | "book" | "thesis">("all");
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [catalogPagination, setCatalogPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [selectedBook,  setSelectedBook]  = useState<Book | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [copiesBook,    setCopiesBook]    = useState<Book | null>(null);
  const [showArchived,  setShowArchived]  = useState(false);  // ← NEW
  const [bookTypes, setBookTypes] = useState<BookType[]>([]);
  const editFormRef = useRef<HTMLDivElement>(null);
  const { confirm, confirmDialog } = useAdminConfirmDialog();

  const activeFields = fields.filter((f) => !f.archived);
  const sortedFields = [...activeFields].sort((a, b) => a.order - b.order);
  const fieldsForMaterial = (type: "book" | "thesis") => sortedFields.filter((field) => (field.scope ?? "shared") === "shared" || field.scope === type);
  const setField     = (key: string, value: CatalogFormValue) => { setFormValues((p) => ({ ...p, [key]: value })); setFieldErrors((errors) => { const next = { ...errors }; delete next[key]; return next; }); };
  const resetForm    = () => { setFormValues({}); setSelectedBook(null); setFieldErrors({}); };

  useEffect(() => { fetchBookTypes().then(setBookTypes).catch(() => toast.error("Failed to load book types")); }, []);

  const lookupIsbn = async () => {
    const isbn = String(formValues.isbn ?? "").trim();
    if (!isbn) return toast.error("Enter an ISBN first");
    setIsbnLookup(true);
    try {
      const metadata = await lookupBookIsbn(isbn);
      // The lookup may return more than the active form supports. Keep the
      // payload aligned with the current form-builder schema so optional
      // metadata can never become an unknown-field save error.
      const visibleKeys = new Set(activeFields.map((field) => field.key));
      setFormValues((current) => {
        const next = { ...current };
        const metadataFields: Record<string, unknown> = {
          isbn: metadata.isbn,
          title: metadata.title,
          author: metadata.author,
          publisher: metadata.publisher,
          edition: metadata.edition,
          publication_year: metadata.publication_year,
        };
        for (const [key, value] of Object.entries(metadataFields)) {
          if (visibleKeys.has(key) && value) next[key] = value;
        }
        return next;
      });
      toast.success("Available ISBN details added — review before saving");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "ISBN lookup failed");
      setFieldErrors((current) => ({ ...current, isbn: message }));
    }
    finally { setIsbnLookup(false); }
  };

  const validateRequired = (type = materialType) => {
    const errors: Record<string, string> = {};
    if (type === "book" && !String(formValues.book_type_id ?? "").trim()) errors.book_type_id = "Select a loan policy.";
    for (const field of fieldsForMaterial(type)) {
      if (field.required && !String(formValues[field.key] ?? "").trim()) {
        errors[field.key] = `${field.label} is required.`;
      }
    }
    setFieldErrors(errors);
    const first = Object.values(errors)[0];
    if (first) toast.error("Review the highlighted fields.");
    return !first;
  };

  const handleCreateBook = async () => {
    if (!validateRequired()) return;
    setLoading(true);
    try {
      const result = await createCatalogBook({ ...formValues, material_type: materialType });
      toast.success(result.message); resetForm(); setCatalogMode("edit"); await handleSearchBooks(false);
    } catch (error: unknown) {
      setFieldErrors(getServerFieldErrors(error));
      toast.error(getApiErrorMessage(error, "Failed to add book"));
    } finally { setLoading(false); }
  };

  const handleSearchBooks = async (archivedOverride?: boolean, materialOverride?: "all" | "book" | "thesis", pageOverride = 1) => {
    setLoading(true);
    const archived = archivedOverride ?? showArchived;
    try {
      const result = await searchCatalogBooks({ query: searchQuery, materialType: materialOverride ?? catalogFilter, page: pageOverride, archived });
      const rows = result.rows;
      setSearchResults(rows);
      setCatalogPagination(result.pagination);
      if (!rows.length) {
        toast.info(
          searchQuery.trim()
            ? (archived ? "No archived catalog records found" : "No catalog records found")
            : (archived ? "No archived catalog records are available" : "No active catalog records are available")
        );
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Search failed"));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void handleSearchBooks(false);
    // The records table is the primary work surface; creation is an explicit secondary action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Toggle archived view and re-run search if results are showing ──
  const handleToggleArchived = () => {
    const next = !showArchived;
    setShowArchived(next);
    setSelectedBook(null);
    void handleSearchBooks(next);
  };

  const handleUpdateBook = async () => {
    const selectedMaterial = selectedBook?.material_type === "thesis" ? "thesis" : "book";
    if (!selectedBook || !validateRequired(selectedMaterial)) return;
    setLoading(true);
    try {
      const result = await updateCatalogBook(selectedBook.id, { ...formValues, material_type: selectedMaterial });
      toast.success(result.message); resetForm(); await handleSearchBooks();
    } catch (error: unknown) {
      setFieldErrors(getServerFieldErrors(error));
      toast.error(getApiErrorMessage(error, "Update failed"));
    } finally { setLoading(false); }
  };

  const handleDeleteBook = async () => {
    if (!selectedBook) return;
    const shouldDelete = await confirm({
      title: `Archive "${selectedBook.title}"?`,
      description: `The ${selectedBook.material_type === "thesis" ? "thesis" : "book"} will be hidden from active catalog management until it is restored.`,
      actionLabel: `Archive ${selectedBook.material_type === "thesis" ? "Thesis" : "Book"}`,
      tone: "danger",
    });
    if (!shouldDelete) return;
    setLoading(true);
    try {
      const result = await archiveCatalogBook(selectedBook.id);
      toast.success(result.message); resetForm(); await handleSearchBooks();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Delete failed"));
    } finally { setLoading(false); }
  };

  // ── NEW: Restore a soft-deleted book ──────────────────────────────
  const handleRestoreBook = async (book: Book) => {
    const shouldRestore = await confirm({
      title: `Restore "${book.title}"?`,
      description: `This ${book.material_type === "thesis" ? "thesis" : "book"} will return to the active catalog list and can be edited again.`,
      actionLabel: `Restore ${book.material_type === "thesis" ? "Thesis" : "Book"}`,
    });
    if (!shouldRestore) return;
    setLoading(true);
    try {
      const result = await restoreCatalogBook(book.id);
      toast.success(result.message);
      await handleSearchBooks(true);
      if (selectedBook?.id === book.id) resetForm();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Restore failed"));
    } finally { setLoading(false); }
  };

  const selectBookForEdit = (b: Book) => {
    setSelectedBook(b);
    const vals: CatalogFormValues = {};
    fieldsForMaterial(b.material_type === "thesis" ? "thesis" : "book").forEach((f) => { vals[f.key] = b[f.key] ?? ""; });
    vals.book_type_id = b.book_type_id ?? "";
    setFormValues(vals);
    requestAnimationFrame(() => editFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      {confirmDialog}
      {copiesBook && (
        <BookCopiesModal
          bookId={copiesBook.id}
          bookTitle={copiesBook.title}
          onClose={() => setCopiesBook(null)}
        />
      )}

      {/* ── Mode selector ── */}
      <section className="admin-panel-surface admin-etched-border mt-5 flex flex-col gap-4 border border-border bg-card p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>Work with records</h2>
          <p className="mt-1 text-sm text-muted-foreground">Search the active collection, update a selected record, or add a new item.</p>
        </div>
        <div className="w-full lg:max-w-sm">
          <SegmentedNavigation
          ariaLabel="Catalog mode"
          value={catalogMode}
          onChange={(mode) => { setCatalogMode(mode); resetForm(); setShowArchived(false); }}
          segments={[
            { value: "edit", label: "Catalog Records", icon: Search },
            { value: "create", label: "Add Record", icon: Library },
          ]}
          />
        </div>
      </section>

      {/* ── Create ────────────────────────────────────────────────────── */}
      {catalogMode === "create" && (
        <CatalogCreateForm
          fields={fields}
          materialType={materialType}
          values={formValues}
          errors={fieldErrors}
          bookTypes={bookTypes}
          loading={loading}
          isbnLookup={isbnLookup}
          onMaterialChange={(value) => {
            setMaterialType(value);
            setFieldErrors({});
            setFormValues(value === "book" ? { material_type: value, copies: "1" } : { material_type: value });
          }}
          onFieldChange={setField}
          onLookupIsbn={() => void lookupIsbn()}
          onSubmit={() => void handleCreateBook()}
          onClear={resetForm}
        />
      )}

      {/* ── Edit / Search / Delete ─────────────────────────────────── */}
      {catalogMode === "edit" && (
        <>
      {confirmDialog}
          {/* Search bar + archived toggle */}
          <div className="admin-panel-surface admin-etched-border mt-5 flex gap-0 border border-border bg-card">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
              <input
                aria-label="Search catalog records"
                className="min-h-11 w-full border-r border-border bg-background pl-10 pr-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-r-primary sm:text-sm"
                placeholder="Search by title, author, or ISBN…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchBooks()}
              />
            </div>

            {/* ── Archived toggle ── */}
            <button
              onClick={handleToggleArchived}
              title={showArchived ? "Showing archived — click for active" : "Show archived books"}
              className={`flex min-h-11 shrink-0 items-center gap-2 border-r border-border px-4 text-sm font-semibold transition-colors ${
                showArchived
                  ? "bg-warning/10 text-foreground border-warning/30 hover:bg-warning/20"
                  : "bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <Archive className="h-4 w-4" />
              {showArchived ? "Archived" : "Active"}
            </button>

            <Select value={catalogFilter} onValueChange={(value: "all" | "book" | "thesis") => { setCatalogFilter(value); void handleSearchBooks(undefined, value); }}>
              <SelectTrigger className="min-h-11 w-32 rounded-none border-y-0 border-l-0"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="book">Books</SelectItem><SelectItem value="thesis">Theses</SelectItem></SelectContent>
            </Select>

            <button
              onClick={() => handleSearchBooks()}
              disabled={loading}
              className="flex min-h-11 shrink-0 items-center gap-2 bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Search className="h-4 w-4" /> Search</>
              }
            </button>
          </div>

          {/* Archived banner */}
          {showArchived && (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-warning/5 border border-t-0 border-warning/20">
              <Archive className="h-4 w-4 shrink-0 text-foreground" />
              <p className="text-sm font-medium text-foreground">
                Showing archived catalog records — restore to make them active again
              </p>
            </div>
          )}

          {/* Results table */}
          {loading && <div className="mt-4 space-y-2 border border-border p-4" aria-label="Loading catalog records">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-12 w-full rounded-none" />)}</div>}
          {!loading && searchResults.length > 0 && (
            <div className="admin-panel-surface admin-etched-border mt-4 overflow-x-auto border border-border bg-card">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Title", "Author", "Type", "Copies", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3">
                        <span
                          className="text-xs font-semibold text-muted-foreground"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          {h}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {searchResults.map((b, index) => (
                    <tr
                      key={b.id}
                      className={`transition-colors ${index % 2 === 0 ? "bg-card" : "bg-muted/35"} ${
                        showArchived
                          ? "opacity-70"
                          : "hover:bg-muted/20"
                      } ${selectedBook?.id === b.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                    >
                      <td className="max-w-[260px] px-4 py-3 text-sm font-medium text-foreground">{b.title}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{b.author || "—"}</td>
                      <td className="px-4 py-3"><span className={`border px-2 py-1 text-xs font-semibold ${b.material_type === "thesis" ? "border-warning/40 bg-warning/5 text-foreground" : "border-border text-muted-foreground"}`}>{b.material_type === "thesis" ? "Thesis" : "Book"}</span></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{b.copies ?? "—"}</td>
                      <td className="px-4 py-3">
                        {showArchived ? (
                          // ── Restore button ──
                          <button
                            onClick={() => handleRestoreBook(b)}
                            disabled={loading}
                            className="flex min-h-11 items-center gap-2 border border-warning/40 px-3 text-sm font-semibold text-warning transition-colors hover:bg-warning hover:text-warning-foreground disabled:opacity-50"
                          >
                            <ArchiveRestore className="h-4 w-4" /> Restore record
                          </button>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => selectBookForEdit(b)}
                              className="min-h-11 border border-warning bg-warning px-3 text-sm font-semibold text-warning-foreground transition-colors hover:bg-warning/90"
                            >
                              Edit record
                            </button>
                            {b.material_type !== "thesis" && <button
                              onClick={() => setCopiesBook(b)}
                              className="min-h-11 border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-warning hover:text-warning"
                            >
                              Copies
                            </button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && searchResults.length > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <Button type="button" variant="outline" className="rounded-none" disabled={catalogPagination.page <= 1} onClick={() => void handleSearchBooks(undefined, undefined, catalogPagination.page - 1)}>Previous</Button>
              <span>Page {catalogPagination.page} of {catalogPagination.totalPages} · {catalogPagination.total} record(s)</span>
              <Button type="button" variant="outline" className="rounded-none" disabled={catalogPagination.page >= catalogPagination.totalPages} onClick={() => void handleSearchBooks(undefined, undefined, catalogPagination.page + 1)}>Next</Button>
            </div>
          )}
          {!loading && searchResults.length === 0 && <div className="mt-4 border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">No {showArchived ? "archived " : ""}catalog records match the current filters.</div>}

          {/* Edit form — only shown in active mode */}
          {selectedBook && !showArchived && (
            <div ref={editFormRef} className="scroll-mt-6">
              <CatalogEditForm
                book={selectedBook}
                fields={fields}
                values={formValues}
                errors={fieldErrors}
                bookTypes={bookTypes}
                loading={loading}
                barcodeStrip={selectedBook.material_type !== "thesis" ? <BookBarcodeStrip bookId={selectedBook.id} /> : undefined}
                onFieldChange={setField}
                onUpdate={() => void handleUpdateBook()}
                onArchive={() => void handleDeleteBook()}
                onDeselect={resetForm}
              />
            </div>
          )}
        </>
      )}
    </>
  );
};

export default AdminCatalogData;


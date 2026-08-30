import { useState, useEffect, useRef } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import {
  Input,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui";
import { toast } from "@/components/ui/sonner";
import { useAdminConfirmDialog } from "../components/useAdminConfirmDialog";
import { FormField, Book } from "./AdminCatalog.types";
import FieldInput from "./components/FieldInput";
import BookCopiesModal from "./components/BookCopiesModal";
import { Library, Loader2, Search, Trash2, RefreshCw, ArchiveRestore, Archive, FileText } from "lucide-react";
import { SegmentedNavigation } from "../components/SegmentedNavigation";

type Copy = {
  id: number;
  barcode: string;
  condition: string;
  is_active: number;
  status: "available" | "borrowed";
};

type Props = { fields: FormField[] };

const loadBarcodeUrl = async (barcode: string): Promise<string> => {
  const res = await axiosInstance.get(
    `api/admin/copies/${encodeURIComponent(barcode)}/barcode-png`,
    { responseType: "blob" }
  );
  return URL.createObjectURL(res.data);
};

// ─── Shared primitives ────────────────────────────────────────────────────────

const PanelLabel = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-muted/30">
    <div className="flex items-center gap-2.5">
      <div className="h-px w-4 bg-warning shrink-0" />
      <p
        className="text-[10px] font-bold uppercase tracking-[0.25em] text-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {children}
      </p>
    </div>
    {action}
  </div>
);

const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label
    className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 mb-1.5"
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {children}
    {required && <span className="ml-1 text-destructive">*</span>}
  </label>
);

// ─── Barcode strip ────────────────────────────────────────────────────────────

const BookBarcodeStrip = ({ bookId }: { bookId: number }) => {
  const [copies,  setCopies]  = useState<Copy[]>([]);
  const [urls,    setUrls]    = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true); setCopies([]); setUrls({});
    axiosInstance.get(`api/admin/books/${bookId}/copies`)
      .then((res) => setCopies(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookId]);

  useEffect(() => {
    if (!copies.length) return;
    copies.forEach(async (copy) => {
      try {
        const url = await loadBarcodeUrl(copy.barcode);
        setUrls((prev) => ({ ...prev, [copy.barcode]: url }));
      } catch {}
    });
    return () => {
      setUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
    };
  }, [copies]);

  if (loading) return (
    <div className="mt-5 flex items-center gap-2 py-4 text-muted-foreground border border-border px-4">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary/40" />
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
            <span
              className={`text-[10px] font-bold uppercase tracking-[0.12em] border px-2 py-0.5 ${
                copy.status === "borrowed"
                  ? "border-destructive/30 text-destructive bg-destructive/5"
                  : "border-success/30 text-success bg-success/5"
              }`}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {copy.status}
            </span>
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
  const [formValues,    setFormValues]    = useState<Record<string, any>>({});
  const [loading,       setLoading]       = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [selectedBook,  setSelectedBook]  = useState<Book | null>(null);
  const [copiesBook,    setCopiesBook]    = useState<Book | null>(null);
  const [showArchived,  setShowArchived]  = useState(false);  // ← NEW
  const editFormRef = useRef<HTMLDivElement>(null);
  const { confirm, confirmDialog } = useAdminConfirmDialog();

  const activeFields = fields.filter((f) => !f.archived);
  const sortedFields = [...activeFields].sort((a, b) => a.order - b.order);
  const setField     = (key: string, value: any) => setFormValues((p) => ({ ...p, [key]: value }));
  const resetForm    = () => { setFormValues({}); setSelectedBook(null); };

  const lookupIsbn = async () => {
    const isbn = String(formValues.isbn ?? "").trim();
    if (!isbn) return toast.error("Enter an ISBN first");
    setIsbnLookup(true);
    try {
      const response = await axiosInstance.get(`api/admin/books/isbn/${encodeURIComponent(isbn)}`);
      const metadata = response.data;
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
          edition: metadata.edition,
          publication_year: metadata.publication_year,
        };
        for (const [key, value] of Object.entries(metadataFields)) {
          if (visibleKeys.has(key) && value) next[key] = value;
        }
        return next;
      });
      toast.success("Available ISBN details added — review before saving");
    } catch (error: any) { toast.error(error.response?.data?.message ?? "ISBN lookup failed"); }
    finally { setIsbnLookup(false); }
  };

  const validateRequired = () => {
    for (const key of ["title", "author"]) {
      if (!String(formValues[key] ?? "").trim()) {
        toast.error(`${key === "title" ? "Book title" : "Author"} is required`);
        return false;
      }
    }
    return true;
  };

  const handleCreateBook = async () => {
    if (!validateRequired()) return;
    setLoading(true);
    try {
      const res = await axiosInstance.post("api/admin/books", { ...formValues, material_type: materialType });
      toast.success(res.data.message); resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to add book");
    } finally { setLoading(false); }
  };

  const handleSearchBooks = async (archivedOverride?: boolean) => {
    setLoading(true);
    const archived = archivedOverride ?? showArchived;
    try {
      const res = await axiosInstance.get("api/admin/books", {
        params: { query: searchQuery, ...(archived && { archived: "true" }) },
      });
      setSearchResults(res.data);
      if (!res.data.length) {
        toast.info(
          searchQuery.trim()
            ? (archived ? "No archived books found" : "No books found")
            : (archived ? "No archived books are available" : "No active books are available")
        );
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Search failed");
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
    if (searchResults.length || searchQuery.trim()) {
      handleSearchBooks(next);
    }
  };

  const handleUpdateBook = async () => {
    if (!selectedBook || !validateRequired()) return;
    setLoading(true);
    try {
      const res = await axiosInstance.put(`api/admin/books/${selectedBook.id}`, formValues);
      toast.success(res.data.message); resetForm(); setSearchResults([]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Update failed");
    } finally { setLoading(false); }
  };

  const handleDeleteBook = async () => {
    if (!selectedBook) return;
    const shouldDelete = await confirm({
      title: `Archive "${selectedBook.title}"?`,
      description: "The book will be hidden from active catalog management until it is restored.",
      actionLabel: "Archive Book",
      tone: "danger",
    });
    if (!shouldDelete) return;
    setLoading(true);
    try {
      const res = await axiosInstance.delete(`api/admin/books/${selectedBook.id}`);
      toast.success(res.data.message); resetForm();
      setSearchResults((prev) => prev.filter((b) => b.id !== selectedBook.id));
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Delete failed");
    } finally { setLoading(false); }
  };

  // ── NEW: Restore a soft-deleted book ──────────────────────────────
  const handleRestoreBook = async (book: Book) => {
    const shouldRestore = await confirm({
      title: `Restore "${book.title}"?`,
      description: "This book will return to the active catalog list and can be edited again.",
      actionLabel: "Restore Book",
    });
    if (!shouldRestore) return;
    setLoading(true);
    try {
      const res = await axiosInstance.post(`api/admin/books/${book.id}/restore`);
      toast.success(res.data.message);
      setSearchResults((prev) => prev.filter((b) => b.id !== book.id));
      if (selectedBook?.id === book.id) resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Restore failed");
    } finally { setLoading(false); }
  };

  const selectBookForEdit = (b: Book) => {
    setSelectedBook(b);
    const vals: Record<string, any> = {};
    activeFields.forEach((f) => { vals[f.key] = b[f.key] ?? ""; });
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
      <div className="mt-5">
        <SegmentedNavigation
          ariaLabel="Catalog mode"
          value={catalogMode}
          onChange={(mode) => { setCatalogMode(mode); resetForm(); setSearchResults([]); setShowArchived(false); }}
          segments={[
            { value: "edit", label: "Catalog Records", icon: Search },
            { value: "create", label: "Add Book", icon: Library },
          ]}
        />
      </div>

      {/* ── Create ────────────────────────────────────────────────────── */}
      {catalogMode === "create" && (
        <div className="mt-5 border border-border">
          <PanelLabel>{materialType === "book" ? "New Book Entry" : "New Thesis Entry"}</PanelLabel>
          <div className="p-5">
            <div className="mb-5"><SegmentedNavigation ariaLabel="Material type" value={materialType} onChange={(value) => { setMaterialType(value); setFormValues({ material_type: value, copies: "1" }); }} segments={[{ value: "book", label: "Book", icon: Library }, { value: "thesis", label: "Thesis", icon: FileText }]} /></div>
            {materialType === "book" ? <div className="mb-5 border border-warning/30 bg-warning/5 p-4"><FieldLabel>ISBN</FieldLabel><div className="flex gap-2"><input value={formValues.isbn ?? ""} onChange={(event) => setField("isbn", event.target.value)} placeholder="ISBN-10 or ISBN-13" className="h-9 min-w-0 flex-1 border border-border bg-background px-3 text-sm" /><button type="button" onClick={lookupIsbn} disabled={isbnLookup} className="flex h-9 shrink-0 items-center gap-2 bg-primary px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-primary-foreground disabled:opacity-50">{isbnLookup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}Look up</button></div></div> : <div className="mb-5 border-l-4 border-warning bg-warning/5 px-4 py-3 text-sm text-foreground">Theses are reference-only. They will appear in the catalog but cannot be borrowed or reserved.</div>}
            {materialType === "thesis" ? <div className="mb-5 grid gap-5 sm:grid-cols-2">{[{ key: "thesis_program", label: "Program" }, { key: "thesis_adviser", label: "Adviser" }, { key: "academic_year", label: "Academic Year" }, { key: "accession_number", label: "Accession Number" }, { key: "thesis_keywords", label: "Keywords", wide: true }].map((field) => <div key={field.key} className={field.wide ? "sm:col-span-2" : ""}><FieldLabel>{field.label}</FieldLabel><input value={formValues[field.key] ?? ""} onChange={(event) => setField(field.key, event.target.value)} className="h-9 w-full border border-border bg-background px-3 text-sm" /></div>)}<div className="sm:col-span-2"><FieldLabel>Abstract</FieldLabel><textarea value={formValues.thesis_abstract ?? ""} onChange={(event) => setField("thesis_abstract", event.target.value)} className="min-h-28 w-full border border-border bg-background p-3 text-sm" /></div></div> : null}
            <div className="grid gap-5 sm:grid-cols-2">
              {sortedFields.filter((field) => field.key !== "isbn").map((f) => (
                <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                  <FieldLabel required={["title", "author"].includes(f.key)}>{f.label}</FieldLabel>
                  <FieldInput field={f} value={formValues[f.key]} onChange={setField} />
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-2.5 border-t border-border pt-5">
              <button
                onClick={() => void handleCreateBook()}
                disabled={loading}
                className="flex items-center gap-2 bg-primary h-9 px-5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {loading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding…</>
                  : <>{materialType === "book" ? <Library className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" /> }Add {materialType === "book" ? "Book" : "Thesis"}</>
                }
              </button>
              <button
                onClick={resetForm}
                disabled={loading}
                className="flex items-center gap-2 border border-border h-9 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit / Search / Delete ─────────────────────────────────── */}
      {catalogMode === "edit" && (
        <>
      {confirmDialog}
          {/* Search bar + archived toggle */}
          <div className="mt-5 flex gap-0 border border-border">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
              <input
                className="w-full h-10 pl-10 pr-4 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 outline-none border-r border-border focus:border-r-primary transition-colors"
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
              className={`flex items-center gap-2 px-4 h-10 text-[10px] font-bold uppercase tracking-[0.15em] border-r border-border shrink-0 transition-colors ${
                showArchived
                  ? "bg-warning/10 text-warning border-warning/30 hover:bg-warning/20"
                  : "bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <Archive className="h-3.5 w-3.5" />
              {showArchived ? "Archived" : "Active"}
            </button>

            <button
              onClick={() => handleSearchBooks()}
              disabled={loading}
              className="flex items-center gap-2 px-5 h-10 text-[10px] font-bold uppercase tracking-[0.18em] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {loading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <><Search className="h-3.5 w-3.5" /> Search</>
              }
            </button>
          </div>

          {/* Archived banner */}
          {showArchived && (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-warning/5 border border-t-0 border-warning/20">
              <Archive className="h-3 w-3 text-warning/60 shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-warning/70"
                style={{ fontFamily: "var(--font-heading)" }}>
                Showing archived books — restore to make them active again
              </p>
            </div>
          )}

          {/* Results table */}
          {searchResults.length > 0 && (
            <div className="mt-4 border border-border overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Title", "Author", "Type", "Category", "Copies", ""].map((h) => (
                      <th key={h} className="px-4 py-3">
                        <span
                          className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          {h}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {searchResults.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => !showArchived && selectBookForEdit(b)}
                      className={`transition-colors ${
                        showArchived
                          ? "opacity-70"
                          : "cursor-pointer hover:bg-muted/20"
                      } ${selectedBook?.id === b.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium text-sm text-foreground max-w-[200px] truncate">{b.title}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{b.author || "—"}</td>
                      <td className="px-4 py-3"><span className={`border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${b.material_type === "thesis" ? "border-warning/40 bg-warning/5 text-warning" : "border-border text-muted-foreground"}`}>{b.material_type === "thesis" ? "Thesis" : "Book"}</span></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{b.category || "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{b.copies ?? "—"}</td>
                      <td className="px-4 py-3">
                        {showArchived ? (
                          // ── Restore button ──
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRestoreBook(b); }}
                            disabled={loading}
                            className="flex items-center gap-1.5 border border-warning/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-warning hover:bg-warning hover:text-warning-foreground disabled:opacity-50 transition-colors"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            <ArchiveRestore className="h-3 w-3" /> Restore
                          </button>
                        ) : (
                          // ── Copies button ──
                          <button
                            onClick={(e) => { e.stopPropagation(); setCopiesBook(b); }}
                            className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            <Library className="h-3 w-3" /> Copies
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Edit form — only shown in active mode */}
          {selectedBook && !showArchived && (
            <div ref={editFormRef} className="mt-5 scroll-mt-6 border border-border">
              <PanelLabel
                action={
                  <span className="text-[10px] text-muted-foreground/50 truncate max-w-[220px]">
                    {selectedBook.title}
                  </span>
                }
              >
                Editing
              </PanelLabel>

              <div className="p-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  {sortedFields.map((f) => (
                    <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                      <FieldLabel required={f.required}>{f.label}</FieldLabel>
                      <FieldInput field={f} value={formValues[f.key]} onChange={setField} />
                    </div>
                  ))}
                </div>

                <BookBarcodeStrip bookId={selectedBook.id} />

                <div className="mt-6 flex gap-2.5 border-t border-border pt-5">
                  <button
                    onClick={handleUpdateBook}
                    disabled={loading}
                    className="flex items-center gap-2 bg-primary h-9 px-5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {loading
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…</>
                      : "Update Book"
                    }
                  </button>
                  <button
                    onClick={handleDeleteBook}
                    disabled={loading}
                    className="flex items-center gap-2 border border-destructive/40 h-9 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 transition-colors"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {loading ? "Archiving…" : "Archive Book"}
                  </button>
                  <button
                    onClick={resetForm}
                    disabled={loading}
                    className="flex items-center gap-2 border border-border h-9 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50 transition-colors ml-auto"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Deselect
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default AdminCatalogData;


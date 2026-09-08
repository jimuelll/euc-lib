import { useState, useEffect } from "react";
import {
  Input,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useAdminConfirmDialog } from "../components/useAdminConfirmDialog";
import { FormField, Book, type BookType, type CatalogFormValue, type CatalogFormValues } from "./AdminCatalog.types";
import { archiveCatalogBook, createCatalogBook, fetchBookTypes, lookupBookIsbn, restoreCatalogBook, searchCatalogBooks, updateCatalogBook } from "./catalog.api";
import { getApiErrorMessage } from "@/utils/apiError";
import CatalogCreateForm from "./components/CatalogCreateForm";
import CatalogEditForm from "./components/CatalogEditForm";
import BookCopiesModal from "./components/BookCopiesModal";
import { BookOpen, FileText, Loader2, Search, ArchiveRestore, Archive, Plus, MoreHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Props = { fields: FormField[] };
type ApiFieldError = { response?: { data?: { fields?: Record<string, string> } } };
const getServerFieldErrors = (error: unknown): Record<string, string> =>
  (error as ApiFieldError)?.response?.data?.fields ?? {};

// ─── Main component ───────────────────────────────────────────────────────────

const AdminCatalogData = ({ fields }: Props) => {
  const [sheetMode,     setSheetMode]     = useState<"create" | "edit" | null>(null);
  const [sheetSection,  setSheetSection]  = useState<"details" | "copies">("details");
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
  const [catalogStatus, setCatalogStatus] = useState<"active" | "archived" | "all">("active");
  const [bookTypes, setBookTypes] = useState<BookType[]>([]);
  const { confirm, confirmDialog } = useAdminConfirmDialog();

  const activeFields = fields.filter((f) => !f.archived);
  const sortedFields = [...activeFields].sort((a, b) => a.order - b.order);
  const fieldsForMaterial = (type: "book" | "thesis") => sortedFields.filter((field) => (field.scope ?? "shared") === "shared" || field.scope === type);
  const setField     = (key: string, value: CatalogFormValue) => { setFormValues((p) => ({ ...p, [key]: value })); setFieldErrors((errors) => { const next = { ...errors }; delete next[key]; return next; }); };
  const clearForm = () => { setFormValues({}); setFieldErrors({}); };
  const closeSheet = () => { setSheetMode(null); setSelectedBook(null); setSheetSection("details"); clearForm(); };

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
      toast.success(result.message); closeSheet(); await handleSearchBooks();
    } catch (error: unknown) {
      setFieldErrors(getServerFieldErrors(error));
      toast.error(getApiErrorMessage(error, "Failed to add book"));
    } finally { setLoading(false); }
  };

  const handleSearchBooks = async (statusOverride?: "active" | "archived" | "all", materialOverride?: "all" | "book" | "thesis", pageOverride = 1) => {
    setLoading(true);
    const status = statusOverride ?? catalogStatus;
    try {
      const result = await searchCatalogBooks({ query: searchQuery, materialType: materialOverride ?? catalogFilter, page: pageOverride, status });
      const rows = result.rows;
      setSearchResults(rows);
      setCatalogPagination(result.pagination);
      if (!rows.length) {
        toast.info(
          searchQuery.trim()
            ? "No catalogue records match the current filters"
            : `No ${status === "all" ? "" : `${status} `}catalogue records are available`
        );
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Search failed"));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void handleSearchBooks("active");
    // The records table is the primary work surface; creation is an explicit secondary action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateBook = async () => {
    const selectedMaterial = selectedBook?.material_type === "thesis" ? "thesis" : "book";
    if (!selectedBook || !validateRequired(selectedMaterial)) return;
    setLoading(true);
    try {
      const result = await updateCatalogBook(selectedBook.id, { ...formValues, material_type: selectedMaterial });
      toast.success(result.message); closeSheet(); await handleSearchBooks();
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
      toast.success(result.message); closeSheet(); await handleSearchBooks();
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
      await handleSearchBooks();
      if (selectedBook?.id === book.id) closeSheet();
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
    setSheetMode("edit");
    setSheetSection("details");
  };
  const openCopies = (book: Book) => { selectBookForEdit(book); setSheetSection("copies"); };
  const openCreate = () => { setSelectedBook(null); setMaterialType("book"); setFormValues({ material_type: "book", copies: "1" }); setFieldErrors({}); setSheetSection("details"); setSheetMode("create"); };

  return (
    <>
      {confirmDialog}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search catalogue records" className="h-11 rounded-none pl-10" placeholder="Search title, author, or ISBN…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void handleSearchBooks()} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <Select value={catalogFilter} onValueChange={(value: "all" | "book" | "thesis") => { setCatalogFilter(value); void handleSearchBooks(undefined, value); }}><SelectTrigger className="h-11 rounded-none sm:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All materials</SelectItem><SelectItem value="book">Books</SelectItem><SelectItem value="thesis">Theses</SelectItem></SelectContent></Select>
            <Select value={catalogStatus} onValueChange={(value: "active" | "archived" | "all") => { setCatalogStatus(value); setSelectedBook(null); void handleSearchBooks(value); }}><SelectTrigger className="h-11 rounded-none sm:w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="archived">Archived</SelectItem><SelectItem value="all">All statuses</SelectItem></SelectContent></Select>
          </div>
          <div className="flex gap-2">
            <Button className="h-11 rounded-none" variant="outline" disabled={loading} onClick={() => void handleSearchBooks()}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Search</Button>
            <Button className="h-11 rounded-none" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add record</Button>
          </div>
        </div>

        {catalogStatus === "archived" && <div className="flex items-center gap-2 border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-foreground"><Archive className="h-4 w-4 text-warning" />Archived records are hidden from the public catalogue until restored.</div>}

        <div className="admin-panel-surface admin-etched-border overflow-hidden border border-border bg-card">
          {loading ? <div className="space-y-2 p-4" aria-label="Loading catalogue records">{[0, 1, 2, 3, 4].map((row) => <Skeleton key={row} className="h-14 w-full rounded-none" />)}</div> : searchResults.length ? <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead><tr className="border-b border-border bg-muted/30">{["Title and author", "Material", "Identifier", "Availability", ""].map((heading) => <th key={heading} className="px-4 py-3 text-xs font-semibold text-muted-foreground">{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {searchResults.map((book) => {
                  const archived = Boolean(book.deleted_at);
                  const identifier = book.material_type === "thesis" ? String(book.accession_number || book.metadata?.accession_number || "—") : (book.isbn || "—");
                  return <tr key={book.id} tabIndex={archived ? -1 : 0} onClick={() => !archived && selectBookForEdit(book)} onKeyDown={(event) => { if (!archived && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); selectBookForEdit(book); } }} className={`group transition-colors ${archived ? "bg-muted/20 text-muted-foreground" : "cursor-pointer hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"}`}>
                    <td className="max-w-[330px] px-4 py-3"><p className="truncate text-sm font-semibold text-foreground">{book.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{book.author || "Unknown author"}</p></td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-medium ${book.material_type === "thesis" ? "border-warning/30 bg-warning/5" : "border-border bg-background"}`}>{book.material_type === "thesis" ? <FileText className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}{book.material_type === "thesis" ? "Thesis" : "Book"}</span>{archived && <span className="ml-2 text-xs text-muted-foreground">Archived</span>}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{identifier}</td>
                    <td className="px-4 py-3 text-sm">{book.material_type === "thesis" ? <span className="text-muted-foreground">Reference only</span> : <><span className={Number(book.available) > 0 ? "font-semibold text-success" : "font-semibold text-muted-foreground"}>{Number(book.available || 0)} available</span><span className="text-muted-foreground"> / {Number(book.total_copies ?? book.copies ?? 0)}</span></>}</td>
                    <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>{archived ? <Button size="sm" variant="outline" className="rounded-none" onClick={() => void handleRestoreBook(book)}><ArchiveRestore className="mr-2 h-4 w-4" />Restore</Button> : <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for ${book.title}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => selectBookForEdit(book)}>Edit details</DropdownMenuItem>{book.material_type !== "thesis" && <DropdownMenuItem onClick={() => openCopies(book)}>Manage copies</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div> : <div className="px-5 py-14 text-center"><BookOpen className="mx-auto h-8 w-8 text-muted-foreground/30" /><p className="mt-3 text-sm font-medium text-foreground">No catalogue records found</p><p className="mt-1 text-sm text-muted-foreground">Adjust the search or filters, or add a new record.</p></div>}
          <div className="flex flex-col gap-3 border-t border-border bg-muted/15 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{catalogPagination.total} record{catalogPagination.total === 1 ? "" : "s"}</span><div className="flex items-center justify-between gap-3"><Button type="button" size="sm" variant="outline" className="rounded-none" disabled={catalogPagination.page <= 1 || loading} onClick={() => void handleSearchBooks(undefined, undefined, catalogPagination.page - 1)}>Previous</Button><span className="tabular-nums">Page {catalogPagination.page} of {catalogPagination.totalPages}</span><Button type="button" size="sm" variant="outline" className="rounded-none" disabled={catalogPagination.page >= catalogPagination.totalPages || loading} onClick={() => void handleSearchBooks(undefined, undefined, catalogPagination.page + 1)}>Next</Button></div></div>
        </div>
      </div>

      <Sheet open={sheetMode !== null} onOpenChange={(open) => { if (!open && !loading) closeSheet(); }}>
        <SheetContent side="right" className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]">
          <SheetHeader className="shrink-0 border-b border-border bg-primary px-6 py-5 pr-12 text-left text-primary-foreground">
            <SheetTitle className="text-primary-foreground">{sheetMode === "create" ? "Add catalogue record" : selectedBook?.title || "Catalogue record"}</SheetTitle>
            <SheetDescription className="text-primary-foreground/70">{sheetMode === "create" ? "Create a book or reference-only thesis using the configured catalogue fields." : `${selectedBook?.material_type === "thesis" ? "Thesis" : "Book"} record and operational details.`}</SheetDescription>
          </SheetHeader>
          {sheetMode === "edit" && selectedBook?.material_type !== "thesis" ? <Tabs value={sheetSection} onValueChange={(value) => setSheetSection(value as "details" | "copies")} className="flex min-h-0 flex-1 flex-col"><TabsList className="h-auto shrink-0 justify-start rounded-none border-b border-border bg-muted/20 px-5 py-2"><TabsTrigger value="details" className="rounded-sm px-3 py-2 text-xs">Details</TabsTrigger><TabsTrigger value="copies" className="rounded-sm px-3 py-2 text-xs">Copies</TabsTrigger></TabsList><TabsContent value="details" className="mt-0 flex-1 overflow-y-auto px-6"><CatalogEditForm inSheet book={selectedBook} fields={fields} values={formValues} errors={fieldErrors} bookTypes={bookTypes} loading={loading} onFieldChange={setField} onUpdate={() => void handleUpdateBook()} onArchive={() => void handleDeleteBook()} onDeselect={closeSheet} /></TabsContent><TabsContent value="copies" className="mt-0 flex min-h-0 flex-1 overflow-hidden p-5"><BookCopiesModal embedded bookId={selectedBook.id} bookTitle={selectedBook.title} onClose={closeSheet} /></TabsContent></Tabs> : <div className="flex-1 overflow-y-auto px-6">{sheetMode === "create" ? <CatalogCreateForm inSheet fields={fields} materialType={materialType} values={formValues} errors={fieldErrors} bookTypes={bookTypes} loading={loading} isbnLookup={isbnLookup} onMaterialChange={(value) => { setMaterialType(value); setFieldErrors({}); setFormValues(value === "book" ? { material_type: value, copies: "1" } : { material_type: value }); }} onFieldChange={setField} onLookupIsbn={() => void lookupIsbn()} onSubmit={() => void handleCreateBook()} onClear={() => { setFormValues(materialType === "book" ? { material_type: "book", copies: "1" } : { material_type: "thesis" }); setFieldErrors({}); }} /> : selectedBook ? <CatalogEditForm inSheet book={selectedBook} fields={fields} values={formValues} errors={fieldErrors} bookTypes={bookTypes} loading={loading} onFieldChange={setField} onUpdate={() => void handleUpdateBook()} onArchive={() => void handleDeleteBook()} onDeselect={closeSheet} /> : null}</div>}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AdminCatalogData;


import { useUnsavedChanges } from "@/features/admin";
import { useAdminUrlState, queryPage } from "@/features/admin";
import { useState, useEffect, useRef } from "react";
import {
  Input,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useAdminConfirmDialog } from "@/features/admin";
import { FormField, Book, type BookType, type CatalogFormValue, type CatalogFormValues } from "./AdminCatalog.types";
import { archiveCatalogBook, createCatalogBook, fetchBookTypes, lookupBookIsbn, restoreCatalogBook, searchCatalogBooks, updateCatalogBook, uploadCatalogBookImage } from "./catalog.api";
import { getApiErrorMessage } from "@/utils/apiError";
import CatalogCreateForm from "./components/CatalogCreateForm";
import CatalogEditForm from "./components/CatalogEditForm";
import BookCopiesModal from "./components/BookCopiesModal";
import { BookOpen, FileText, Loader2, Search, ArchiveRestore, Archive, Plus, MoreHorizontal, PanelsTopLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import BookHoldingsEditor from "./components/BookHoldingsEditor";
import CatalogImageEditor from "./components/CatalogImageEditor";
import CatalogHoldingsView from "./components/CatalogHoldingsView";
import CatalogLendingStatusCell from "./components/CatalogLendingStatusCell";
import type { CatalogHolding } from "./catalog.api";

type Props = { fields: FormField[]; isSuperAdmin: boolean };
type ApiFieldError = { response?: { data?: { fields?: Record<string, string> } } };
const getServerFieldErrors = (error: unknown): Record<string, string> =>
  (error as ApiFieldError)?.response?.data?.fields ?? {};

function CatalogBookThumbnail({ book }: { book: Book }) {
  const isThesis = book.material_type === "thesis";
  const fallback = isThesis ? "/thesis-cover-fallback.svg" : "/book-cover-fallback.svg";
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [book.image_url, book.material_type]);

  return (
    <span aria-hidden="true" className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted/20 p-0.5">
      <img
        src={isThesis || failed || !book.image_url ? fallback : book.image_url}
        alt=""
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const AdminCatalogData = ({ fields, isSuperAdmin }: Props) => {
  const [params, patchParams] = useAdminUrlState();
  const currentPage = queryPage(params.get("page"));
  const [sheetMode,     setSheetMode]     = useState<"create" | "edit" | null>(null);
  const [sheetSection,  setSheetSection]  = useState<"details" | "image" | "copies" | "holdings">("details");
  const [materialType,  setMaterialType]  = useState<"book" | "thesis">("book");
  const [isbnLookup,    setIsbnLookup]    = useState(false);
  const [formValues,    setFormValues]    = useState<CatalogFormValues>({});
  const [coverFile,     setCoverFile]     = useState<File | null>(null);
  const [loading,       setLoading]       = useState(false);
  const searchQuery = params.get("q") ?? "";
  const setSearchQuery = (q: string) => patchParams({ q, page: null }, true);
  const catalogFilter = params.get("material") === "book" ? "book" : params.get("material") === "thesis" ? "thesis" : "all";
  const setCatalogFilter = (material: string) => patchParams({ material, ...(material === "thesis" ? { policy: null } : {}), page: null });
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [catalogPagination, setCatalogPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [selectedBook,  setSelectedBook]  = useState<Book | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const catalogStatus = params.get("status") === "archived" ? "archived" : params.get("status") === "all" ? "all" : "active";
  const setCatalogStatus = (status: string) => patchParams({ status, page: null });
  const policyStatus = params.get("policy") === "needs" ? "needs_policy" : "all";
  const setPolicyStatus = (status: "all" | "needs_policy") => patchParams({ policy: status === "needs_policy" ? "needs" : null, page: null });
  const [bookTypes, setBookTypes] = useState<BookType[]>([]);
  const [viewMode, setViewMode] = useState<"catalog" | "holdings">("catalog");
  const [initialHoldingCopyId, setInitialHoldingCopyId] = useState<number | null>(null);
  const holdingGuardRef = useRef<(() => Promise<boolean>) | null>(null);
  const { confirm, confirmDialog } = useAdminConfirmDialog();

  const { confirmDiscard, discardDialog } = useUnsavedChanges({ formValues, hasCoverImage: Boolean(coverFile) }, sheetMode !== null, `${sheetMode}-${selectedBook?.id ?? "new"}`);
  const requestClose = async () => {
    if (loading || !await confirmDiscard()) return;
    if (holdingGuardRef.current && !await holdingGuardRef.current()) return;
    closeSheet();
  };

  const activeFields = fields.filter((f) => !f.archived);
  const sortedFields = [...activeFields].sort((a, b) => a.order - b.order);
  const fieldsForMaterial = (type: "book" | "thesis") => sortedFields.filter((field) => (field.scope ?? "shared") === "shared" || field.scope === type);
  const setField     = (key: string, value: CatalogFormValue) => { setFormValues((p) => ({ ...p, [key]: value })); setFieldErrors((errors) => { const next = { ...errors }; delete next[key]; return next; }); };
  const clearForm = () => { setFormValues({}); setFieldErrors({}); setCoverFile(null); };
  const closeSheet = () => { setSheetMode(null); setSelectedBook(null); setSheetSection("details"); setInitialHoldingCopyId(null); clearForm(); };

  useEffect(() => { fetchBookTypes().then((types) => setBookTypes(types.filter((type) => Number(type.is_active ?? 1) === 1))).catch(() => toast.error("Failed to load book types")); }, []);

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
          copyright_year: metadata.copyright_year,
          publication_place: metadata.publication_place,
          physical_description: metadata.physical_description,
        };
        for (const [key, value] of Object.entries(metadataFields)) {
          if (visibleKeys.has(key) && value) next[key] = value as CatalogFormValue;
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

  const validateRequired = (type = materialType, requirePolicy = true) => {
    const errors: Record<string, string> = {};
    if (type === "book" && requirePolicy && !String(formValues.book_type_id ?? "").trim()) errors.book_type_id = "Select a loan policy.";
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
      let coverUploadError: string | null = null;
      if (materialType === "book" && coverFile) {
        try {
          await uploadCatalogBookImage(result.id, coverFile);
        } catch (error: unknown) {
          coverUploadError = getApiErrorMessage(error, "Could not upload the cover image.");
        }
      }
      closeSheet();
      await handleSearchBooks();
      if (coverUploadError) {
        toast.error(`Book created, but its cover image could not be uploaded: ${coverUploadError} Open the book's Image tab to retry.`);
      } else {
        toast.success(materialType === "book" && coverFile ? `${result.message} Cover image uploaded.` : result.message);
      }
    } catch (error: unknown) {
      setFieldErrors(getServerFieldErrors(error));
      toast.error(getApiErrorMessage(error, "Failed to add book"));
    } finally { setLoading(false); }
  };

  const handleSearchBooks = async (statusOverride?: "active" | "archived" | "all", materialOverride?: "all" | "book" | "thesis", pageOverride = currentPage) => {
    if (pageOverride !== currentPage) { patchParams({ page: pageOverride }); return; }
    setLoading(true);
    const status = statusOverride ?? catalogStatus;
    try {
      const result = await searchCatalogBooks({ query: searchQuery, materialType: materialOverride ?? catalogFilter, page: pageOverride, status, policyStatus });
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
    const timer = window.setTimeout(() => { void handleSearchBooks(); }, 180);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, catalogFilter, catalogStatus, policyStatus, currentPage]);

  const handleUpdateBook = async () => {
    const selectedMaterial = selectedBook?.material_type === "thesis" ? "thesis" : "book";
    if (!selectedBook || !validateRequired(selectedMaterial, selectedMaterial !== "book" || !Boolean(selectedBook.needs_policy))) return;
    setLoading(true);
    try {
      const updateValues: CatalogFormValues = { ...formValues, material_type: selectedMaterial };
      if (selectedMaterial === "book" && selectedBook.needs_policy && !String(updateValues.book_type_id ?? "").trim()) delete updateValues.book_type_id;
      const result = await updateCatalogBook(selectedBook.id, updateValues);
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
    fieldsForMaterial(b.material_type === "thesis" ? "thesis" : "book").forEach((f) => { vals[f.key] = (b[f.key] as CatalogFormValue) ?? ""; });
    vals.book_type_id = b.needs_policy ? "" : b.book_type_id ?? "";
    setFormValues(vals);
    setSheetMode("edit");
    setSheetSection("details");
  };
  const updateSelectedBookImage = (imageUrl: string | null, publicId: string | null) => {
    const selectedId = selectedBook?.id;
    setSelectedBook((current) => current ? { ...current, image_url: imageUrl, image_public_id: publicId } : current);
    setSearchResults((current) => current.map((book) => book.id === selectedId ? { ...book, image_url: imageUrl, image_public_id: publicId } : book));
  };
  const openCopies = (book: Book) => { selectBookForEdit(book); setSheetSection("copies"); };
  const openHoldings = (book: Book, copyId: number | null = null) => { selectBookForEdit(book); setInitialHoldingCopyId(copyId); setSheetSection("holdings"); };
  const handleOpenHolding = (holding: CatalogHolding) => openHoldings({ id: holding.book_id, title: holding.title, author: holding.author ?? undefined, isbn: holding.isbn ?? undefined, material_type: "book", needs_policy: holding.needs_policy }, holding.copy_id);
  const openCreate = () => { setSelectedBook(null); setMaterialType("book"); setFormValues({ material_type: "book", copies: "1" }); setCoverFile(null); setFieldErrors({}); setSheetSection("details"); setSheetMode("create"); };
  const changeSheetSection = async (section: "details" | "image" | "copies" | "holdings") => {
    if (sheetSection === "holdings" && section !== "holdings" && holdingGuardRef.current && !await holdingGuardRef.current()) return;
    setSheetSection(section);
  };

  return (
    <>
      {confirmDialog}
      {discardDialog}
      {viewMode === "holdings" ? <CatalogHoldingsView onBack={() => setViewMode("catalog")} onSelect={handleOpenHolding} /> : <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search catalogue records" className="h-11 rounded-md pl-10" placeholder="Search title, author, or ISBN…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void handleSearchBooks()} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <Select value={catalogFilter} onValueChange={(value: "all" | "book" | "thesis") => { setCatalogFilter(value); }}><SelectTrigger className="h-11 rounded-md sm:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All materials</SelectItem><SelectItem value="book">Books</SelectItem><SelectItem value="thesis">Theses</SelectItem></SelectContent></Select>
            <Select value={catalogStatus} onValueChange={(value: "active" | "archived" | "all") => { setCatalogStatus(value); setSelectedBook(null); }}><SelectTrigger className="h-11 rounded-md sm:w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="archived">Archived</SelectItem><SelectItem value="all">All statuses</SelectItem></SelectContent></Select>
            <Select value={policyStatus} onValueChange={(value: "all" | "needs_policy") => { setPolicyStatus(value); setSelectedBook(null); }}><SelectTrigger aria-label="Loan policy filter" className="h-11 rounded-md sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All loan policies</SelectItem><SelectItem value="needs_policy" disabled={catalogFilter === "thesis"}>Needs loan policy</SelectItem></SelectContent></Select>
          </div>
          <div className="flex gap-2">
            <Button className="h-11 rounded-md" variant="outline" disabled={loading} onClick={() => void handleSearchBooks()}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Search</Button>
            <Button className="h-11 rounded-md" variant="outline" onClick={() => setViewMode("holdings")}><PanelsTopLeft className="mr-2 h-4 w-4" />View holdings</Button>
            <Button className="h-11 rounded-md" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add record</Button>
          </div>
        </div>

        {catalogStatus === "archived" && <div className="flex items-center gap-2 border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-foreground"><Archive className="h-4 w-4 text-warning" />Archived records are hidden from the public catalogue until restored.</div>}

        <div className="admin-panel-surface admin-etched-border overflow-hidden border border-border bg-card">
          {loading ? <div className="space-y-2 p-4" aria-label="Loading catalogue records">{[0, 1, 2, 3, 4].map((row) => <Skeleton key={row} className="h-14 w-full rounded-md" />)}</div> : searchResults.length ? <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead><tr className="border-b border-border bg-muted/30">{["Title and author", "Material", "Identifier", "Lending status", ""].map((heading) => <th key={heading} className="px-4 py-3 text-xs font-semibold text-muted-foreground">{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {searchResults.map((book) => {
                  const archived = Boolean(book.deleted_at);
                  const identifier = book.material_type === "thesis" ? String(book.accession_number || book.metadata?.accession_number || "—") : (book.isbn || "—");
                  return <tr key={book.id} tabIndex={archived ? -1 : 0} onClick={() => !archived && selectBookForEdit(book)} onKeyDown={(event) => { if (!archived && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); selectBookForEdit(book); } }} className={`group transition-colors ${archived ? "bg-muted/20 text-muted-foreground" : "cursor-pointer hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"}`}>
                    <td className="max-w-[330px] px-4 py-2"><div className="flex min-w-0 items-center gap-3"><CatalogBookThumbnail book={book} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{book.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{book.author || "Unknown author"}</p></div></div></td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-medium ${book.material_type === "thesis" ? "border-warning/30 bg-warning/5" : "border-border bg-background"}`}>{book.material_type === "thesis" ? <FileText className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}{book.material_type === "thesis" ? "Thesis" : "Book"}</span>{archived && <span className="ml-2 text-xs text-muted-foreground">Archived</span>}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{identifier}</td>
                    <td className="px-4 py-3 text-sm"><CatalogLendingStatusCell book={book} archived={archived} onAddHoldings={(selectedBook) => openHoldings(selectedBook)} onAssignPolicy={selectBookForEdit} /></td>
                    <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>{archived ? <Button size="sm" variant="outline" className="rounded-md" onClick={() => void handleRestoreBook(book)}><ArchiveRestore className="mr-2 h-4 w-4" />Restore</Button> : <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for ${book.title}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => selectBookForEdit(book)}>Edit details</DropdownMenuItem>{book.material_type !== "thesis" && <DropdownMenuItem onClick={() => openCopies(book)}>Manage copies</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div> : <div className="px-5 py-14 text-center"><BookOpen className="mx-auto h-8 w-8 text-muted-foreground/30" /><p className="mt-3 text-sm font-medium text-foreground">No catalogue records found</p><p className="mt-1 text-sm text-muted-foreground">Adjust the search or filters, or add a new record.</p></div>}
          <div className="flex flex-col gap-3 border-t border-border bg-muted/15 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{catalogPagination.total} record{catalogPagination.total === 1 ? "" : "s"}</span><div className="flex items-center justify-between gap-3"><Button type="button" size="sm" variant="outline" className="rounded-md" disabled={catalogPagination.page <= 1 || loading} onClick={() => void handleSearchBooks(undefined, undefined, catalogPagination.page - 1)}>Previous</Button><span className="tabular-nums">Page {catalogPagination.page} of {catalogPagination.totalPages}</span><Button type="button" size="sm" variant="outline" className="rounded-md" disabled={catalogPagination.page >= catalogPagination.totalPages || loading} onClick={() => void handleSearchBooks(undefined, undefined, catalogPagination.page + 1)}>Next</Button></div></div>
        </div>
      </div>
      }

      <Sheet open={sheetMode !== null} onOpenChange={(open) => { if (!open && !loading) void requestClose(); }}>
        <SheetContent side="right" className="grid h-full w-full grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[640px]">
          <SheetHeader className="shrink-0 border-b border-border bg-primary px-6 py-5 pr-12 text-left text-primary-foreground">
            <SheetTitle className="text-primary-foreground">{sheetMode === "create" ? "Add catalogue record" : selectedBook?.title || "Catalogue record"}</SheetTitle>
            <SheetDescription className="text-primary-foreground/70">{sheetMode === "create" ? "Create a book or reference-only thesis using the configured catalogue fields." : `${selectedBook?.material_type === "thesis" ? "Thesis" : "Book"} record and operational details.`}</SheetDescription>
          </SheetHeader>
          {sheetMode === "edit" && selectedBook?.material_type !== "thesis" ? <Tabs value={sheetSection} onValueChange={(value) => void changeSheetSection(value as "details" | "image" | "copies" | "holdings")} className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-4 py-2 sm:px-5"><TabsList className="h-auto flex-wrap justify-start rounded-md bg-transparent p-0"><TabsTrigger value="details" className="rounded-sm px-3 py-2 text-xs">Details</TabsTrigger><TabsTrigger value="image" className="rounded-sm px-3 py-2 text-xs">Image</TabsTrigger><TabsTrigger value="copies" className="rounded-sm px-3 py-2 text-xs">Copies</TabsTrigger><TabsTrigger value="holdings" className="rounded-sm px-3 py-2 text-xs">Holdings</TabsTrigger></TabsList></div>
            <TabsContent value="details" className="mt-0 min-h-0 overflow-y-auto px-6"><CatalogEditForm inSheet book={selectedBook} fields={fields} values={formValues} errors={fieldErrors} bookTypes={bookTypes} loading={loading} onFieldChange={setField} onUpdate={() => void handleUpdateBook()} onArchive={() => void handleDeleteBook()} onDeselect={() => void requestClose()} /></TabsContent>
            <TabsContent value="image" className="mt-0 min-h-0 overflow-y-auto px-6"><CatalogImageEditor book={selectedBook} onImageChange={updateSelectedBookImage} /></TabsContent>
            <TabsContent value="copies" className="mt-0 flex min-h-0 overflow-hidden p-5"><BookCopiesModal embedded bookId={selectedBook.id} bookTitle={selectedBook.title} onClose={() => void requestClose()} /></TabsContent>
            <TabsContent value="holdings" className="mt-0 flex min-h-0 overflow-hidden"><BookHoldingsEditor key={`${selectedBook.id}-${initialHoldingCopyId ?? "first-missing"}`} bookId={selectedBook.id} bookTitle={selectedBook.title} initialCopyId={initialHoldingCopyId} guardRef={holdingGuardRef} onManageCopies={() => setSheetSection("copies")} isSuperAdmin={isSuperAdmin} /></TabsContent>
          </Tabs> : <div className="min-h-0 overflow-y-auto px-6">{sheetMode === "create" ? <CatalogCreateForm inSheet fields={fields} materialType={materialType} values={formValues} errors={fieldErrors} bookTypes={bookTypes} loading={loading} isbnLookup={isbnLookup} coverFile={coverFile} onCoverFileChange={setCoverFile} onMaterialChange={(value) => { setMaterialType(value); if (value !== "book") setCoverFile(null); setFieldErrors({}); setFormValues(value === "book" ? { material_type: value, copies: "1" } : { material_type: value }); }} onFieldChange={setField} onLookupIsbn={() => void lookupIsbn()} onSubmit={() => void handleCreateBook()} onClear={() => { setFormValues(materialType === "book" ? { material_type: "book", copies: "1" } : { material_type: "thesis" }); setCoverFile(null); setFieldErrors({}); }} /> : selectedBook ? <CatalogEditForm inSheet book={selectedBook} fields={fields} values={formValues} errors={fieldErrors} bookTypes={bookTypes} loading={loading} onFieldChange={setField} onUpdate={() => void handleUpdateBook()} onArchive={() => void handleDeleteBook()} onDeselect={() => void requestClose()} /> : null}</div>}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AdminCatalogData;


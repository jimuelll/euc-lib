import { useUnsavedChanges, AdminDetailDrawer, AdminPageTabs } from "@/features/admin";
import CatalogRecords from "./components/CatalogRecords";
import "@/features/admin/compact-admin.css";
import "./catalog.css";
import { useAdminUrlState, queryPage } from "@/features/admin";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { invalidateServerState } from "@/app/server-state";
import { catalogKeys } from "../catalog.keys";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useAdminConfirmDialog } from "@/features/admin";
import { FormField, Book, type BookType, type CatalogFormValue, type CatalogFormValues } from "./AdminCatalog.types";
import { archiveCatalogBook, createCatalogBook, fetchBookTypes, lookupBookIsbn, restoreCatalogBook, searchCatalogBooks, updateCatalogBook, uploadCatalogBookImage } from "./catalog.api";
import { getApiErrorMessage } from "@/utils/apiError";
import CatalogCreateForm from "./components/CatalogCreateForm";
import CatalogEditForm from "./components/CatalogEditForm";
import BookCopiesWorkspace from "./components/BookCopiesWorkspace";


import { TabsContent } from "@/components/ui/tabs";


import CatalogImageEditor from "./components/CatalogImageEditor";

import type { CatalogHolding, CatalogSearchResponse } from "./catalog.api";

type Props = { fields: FormField[]; isSuperAdmin: boolean };
type ApiFieldError = { response?: { data?: { fields?: Record<string, string> } } };
const getServerFieldErrors = (error: unknown): Record<string, string> =>
  (error as ApiFieldError)?.response?.data?.fields ?? {};

// ─── Main component ───────────────────────────────────────────────────────────

const AdminCatalogData = ({ fields, isSuperAdmin }: Props) => {
  const queryClient = useQueryClient();
  const [params,patchParams] = useAdminUrlState();
  const currentPage = queryPage(params.get("page"));
  const [sheetMode,     setSheetMode]     = useState<"create" | "edit" | null>(null);
  const [sheetSection,  setSheetSection]  = useState<"details" | "image" | "copies">("details");
  const [materialType,  setMaterialType]  = useState<"book" | "thesis">("book");
  const [formValues,    setFormValues]    = useState<CatalogFormValues>({});
  const [coverFile,     setCoverFile]     = useState<File | null>(null);
  const [loading,       setLoading]       = useState(false);
  const searchQuery = params.get("q") ?? "";
  const debouncedSearch = useDebounce(searchQuery, 180);
  const catalogFilter = params.get("material") === "book" ? "book" : params.get("material") === "thesis" ? "thesis" : "all";
  const [selectedBook,  setSelectedBook]  = useState<Book | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const statusParam = params.get("filter") ?? params.get("status");
  const catalogStatus = statusParam === "archived" ? "archived" : statusParam === "all" ? "all" : "active";
  const policyStatus = params.get("policy") === "needs" ? "needs_policy" : "all";
  const [initialHoldingCopyId, setInitialHoldingCopyId] = useState<number | null>(null);
  const holdingGuardRef = useRef<(() => Promise<boolean>) | null>(null);
  const { confirm, confirmDialog } = useAdminConfirmDialog();
  const searchFilters: Parameters<typeof searchCatalogBooks>[0] = {bookId:params.get("bookId")?Number(params.get("bookId")):undefined,fieldKey:params.get("fieldKey")||undefined,fieldUsage:params.get("fieldUsage")==="missing"?"missing":params.get("fieldUsage")==="used"?"used":undefined,unheld:params.get("unheld")==="1",bookTypeId:params.get("bookTypeId")?Number(params.get("bookTypeId")):undefined, query: debouncedSearch, materialType: catalogFilter, page: currentPage, status: catalogStatus, policyStatus, uncategorized:params.get("uncategorized")==="1", holdingStatus: ["needs_holdings","needs-holdings"].includes(statusParam??"") ? "needs" : "all" };
  const catalogQuery = useQuery({ queryKey: catalogKeys.adminSearch(searchFilters), queryFn: ({ signal }) => searchCatalogBooks(searchFilters, signal), placeholderData: (previousData) => previousData });
  const bookTypesQuery = useQuery({ queryKey: catalogKeys.bookTypes(), queryFn: ({ signal }) => fetchBookTypes(signal) });
  const bookTypes: BookType[] = bookTypesQuery.data?.filter((type) => Number(type.is_active ?? 1) === 1) ?? [];
  const invalidateCatalog = () => invalidateServerState(queryClient, "catalog");
  const createMutation = useMutation({ mutationFn: createCatalogBook, onSuccess: invalidateCatalog });
  const updateMutation = useMutation({ mutationFn: ({ id, values }: { id: number; values: CatalogFormValues }) => updateCatalogBook(id, values), onSuccess: invalidateCatalog });
  const archiveMutation = useMutation({ mutationFn: archiveCatalogBook, onSuccess: invalidateCatalog });
  const restoreMutation = useMutation({ mutationFn: restoreCatalogBook, onSuccess: invalidateCatalog });
  const isbnLookupMutation = useMutation({ mutationFn: lookupBookIsbn });
  const isbnLookup = isbnLookupMutation.isPending;

  const { dirty, confirmDiscard, discardDialog } = useUnsavedChanges({ formValues, hasCoverImage: Boolean(coverFile) }, sheetMode !== null, `${sheetMode}-${selectedBook?.id ?? "new"}`);
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

  const lookupIsbn = async () => {
    const isbn = String(formValues.isbn ?? "").trim();
    if (!isbn) return toast.error("Enter an ISBN first");
    try {
      const metadata = await isbnLookupMutation.mutateAsync(isbn);
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
  };

  const validateRequired = (type = materialType, requirePolicy = true) => {
    const errors: Record<string, string> = {};
    if (type === "book" && requirePolicy && !String(formValues.book_type_id ?? "").trim()) errors.book_type_id = "Select a loan policy.";
    for (const field of fieldsForMaterial(type)) {
      if (field.key !== "copies" && field.required && !String(formValues[field.key] ?? "").trim()) {
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
      const result = await createMutation.mutateAsync({ ...formValues, material_type: materialType });
      let coverUploadError: string | null = null;
      if (materialType === "book" && coverFile) {
        try {
          await uploadCatalogBookImage(result.id, coverFile);
        } catch (error: unknown) {
          coverUploadError = getApiErrorMessage(error, "Could not upload the cover image.");
        }
      }
      await invalidateCatalog();
      closeSheet();
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

  const handleUpdateBook = async () => {
    const selectedMaterial = selectedBook?.material_type === "thesis" ? "thesis" : "book";
    if (!selectedBook || !validateRequired(selectedMaterial, selectedMaterial !== "book" || !selectedBook.needs_policy)) return;
    setLoading(true);
    try {
      const updateValues: CatalogFormValues = { ...formValues, material_type: selectedMaterial };
      delete updateValues.copies;
      if (selectedMaterial === "book" && selectedBook.needs_policy && !String(updateValues.book_type_id ?? "").trim()) delete updateValues.book_type_id;
      const result = await updateMutation.mutateAsync({ id: selectedBook.id, values: updateValues });
      toast.success(result.message); closeSheet();
    } catch (error: unknown) {
      setFieldErrors(getServerFieldErrors(error));
      toast.error(getApiErrorMessage(error, "Update failed"));
    } finally { setLoading(false); }
  };

  const handleDeleteBook = async () => {
    if (!selectedBook) return;
    const shouldDelete = await confirm({
      title: `Archive "${selectedBook.title}"?`,
      description: `This record and its physical copies will be hidden until restored. Active loans, unreturned copies, active reservations and unpaid fines block archival. The server checks them again before saving.`,
      actionLabel: `Archive ${selectedBook.material_type === "thesis" ? "Thesis" : "Book"}`,
      tone: "danger",
    });
    if (!shouldDelete) return;
    setLoading(true);
    try {
      const result = await archiveMutation.mutateAsync(selectedBook.id);
      toast.success(result.message); closeSheet();
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
      const result = await restoreMutation.mutateAsync(book.id);
      toast.success(result.message);
      if (selectedBook?.id === book.id) closeSheet();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Restore failed"));
    } finally { setLoading(false); }
  };

  const selectBookForEdit = (b: Book) => {
    setInitialHoldingCopyId(null);
    setSelectedBook(b);
    const vals: CatalogFormValues = {};
    fieldsForMaterial(b.material_type === "thesis" ? "thesis" : "book").filter(f=>f.key!=="copies").forEach((f) => { vals[f.key] = (b[f.key] as CatalogFormValue) ?? b.metadata?.[f.key] ?? ""; });
    vals.book_type_id = b.needs_policy ? "" : b.book_type_id ?? "";
    setFormValues(vals);
    setSheetMode("edit");
    setSheetSection("details");
  };
  const updateSelectedBookImage = (imageUrl: string | null, publicId: string | null) => {
    const selectedId = selectedBook?.id;
    setSelectedBook((current) => current ? { ...current, image_url: imageUrl, image_public_id: publicId } : current);
    queryClient.setQueryData<CatalogSearchResponse>(catalogKeys.adminSearch({ ...searchFilters, policyStatus }), (current) => current ? { ...current, rows: current.rows.map((book) => book.id === selectedId ? { ...book, image_url: imageUrl, image_public_id: publicId } : book) } : current);
    void invalidateCatalog();
  };
  useEffect(()=>{const id=Number(params.get('record'));if(!Number.isInteger(id)||id<=0)return;let cancelled=false;void searchCatalogBooks({query:'',status:'all',materialType:'all',bookId:id,page:1}).then(result=>{if(cancelled)return;const book=result.rows.find(row=>row.id===id);if(book)selectBookForEdit(book);else toast.error('Catalog record not found.');patchParams({record:null},true);}).catch(error=>{if(!cancelled){toast.error(getApiErrorMessage(error,'Could not open this record.'));patchParams({record:null},true);}});return()=>{cancelled=true;};},[params.get('record')]);
  const openCopies = (book: Book) => { selectBookForEdit(book); setSheetSection("copies"); };
  const openHoldings = (book: Book, copyId: number | null = null) => { selectBookForEdit(book); setInitialHoldingCopyId(copyId); setSheetSection("copies"); };
  const handleOpenHolding = async (holding: CatalogHolding) => { try { const result = await searchCatalogBooks({query:"",materialType:"all",status:"all",page:1,bookId:holding.book_id}); const record=result.rows.find(row=>row.id===holding.book_id); if(!record)throw new Error("Record not found"); openHoldings(record,holding.copy_id); } catch(error){toast.error(getApiErrorMessage(error,"Could not load this record"));} };
  const openCreate = () => { setSelectedBook(null); setMaterialType("book"); setFormValues({ material_type: "book", copies: "1" }); setCoverFile(null); setFieldErrors({}); setSheetSection("details"); setSheetMode("create"); };
  const changeSheetSection = async (section: "details" | "image" | "copies") => {
    if (sheetSection === "copies" && section !== "copies" && holdingGuardRef.current && !await holdingGuardRef.current()) return;
    setSheetSection(section);
  };

  const selectedFilters = {query:"",materialType:"all" as const,status:"all" as const,page:1,bookId:selectedBook?.id};
  const selectedQuery = useQuery({queryKey:catalogKeys.adminSearch(selectedFilters),queryFn:({signal})=>searchCatalogBooks(selectedFilters,signal),enabled:sheetMode==="edit"&&!!selectedBook});
  const operationalBook = selectedQuery.data?.rows.find(row=>row.id===selectedBook?.id) ?? selectedBook;
  const archiveBlocked=Number(operationalBook?.active_loans)>0 || Number(operationalBook?.active_reservations)>0;
  const archived=Boolean(selectedBook?.deleted_at);
  const editForm = selectedBook && <fieldset disabled={archived || loading} className="catalog-edit-fields"><CatalogEditForm inSheet book={operationalBook??selectedBook} fields={fields} values={formValues} errors={fieldErrors} bookTypes={bookTypes} loading={loading} onFieldChange={setField} onUpdate={()=>void handleUpdateBook()} onArchive={()=>void handleDeleteBook()} onDeselect={()=>void requestClose()} onCopies={()=>void changeSheetSection("copies")} archiveBlocked={archiveBlocked} dirty={dirty}/></fieldset>;
  const viewBookHoldings=async()=>{const id=selectedBook?.id;if(!id)return;if(holdingGuardRef.current&&!await holdingGuardRef.current())return;if(!await confirmDiscard())return;setSheetMode(null);setSelectedBook(null);patchParams({tab:"holdings",bookId:id,hq:null,hstatus:"all",completion:"all",hpage:null});};
  const metric=(label:string,value?:number)=> <div data-tone={value && label==="Needs accession"?"amber":value && label==="Overdue loans"?"red":undefined}><span>{label}</span><strong>{value===undefined?"—":Number(value).toLocaleString("en-PH")}</strong></div>;
  return <div className="catalog-page">{confirmDialog}{discardDialog}{(params.get("fieldKey")||params.get("unheld")==="1")&&<div className="flex justify-between gap-4 rounded-md border border-border bg-muted/30 p-3 text-sm"><span>{params.get("unheld")==="1"?"Books without eligible accessioned copies":`${params.get("fieldUsage")==="missing"?"Records missing a value for":"Records using"} ${params.get("fieldKey")}`}</span><Button variant="outline" onClick={()=>patchParams({fieldKey:null,fieldUsage:null,unheld:null,page:null})}>Clear configuration filter</Button></div>}{params.get("bookTypeId")&&<div className="flex justify-between gap-4 rounded-md border border-border bg-muted/30 p-3 text-sm"><span>Showing books assigned to {bookTypesQuery.data?.find(type=>type.id===Number(params.get("bookTypeId")))?.name||"this policy"}</span><Button variant="outline" onClick={()=>patchParams({bookTypeId:null,page:null})}>Clear policy filter</Button></div>}{params.get("uncategorized")==="1"&&<div className="flex justify-between gap-4 rounded-md border border-border bg-muted/30 p-3 text-sm"><span>Showing uncategorized titles</span><Button variant="outline" onClick={()=>patchParams({uncategorized:null,page:null})}>Clear category filter</Button></div>}
   <CatalogRecords query={catalogQuery} filters={searchFilters} fields={fields} policies={bookTypes} onCreate={openCreate} onEdit={selectBookForEdit} onCopies={openCopies} onHoldings={openHoldings} onHolding={holding=>void handleOpenHolding(holding)} onRestore={book=>void handleRestoreBook(book)} onRefresh={invalidateCatalog}/>
   <AdminDetailDrawer open={sheetMode!==null} onClose={()=>void requestClose()} title={sheetMode==="create"?"Add catalog record":selectedBook?.title||"Catalog record"} description={sheetMode==="create"?"Create a descriptive record and its initial physical copies.":"Edit the record or manage physical copies and accession details."} className="catalog-record-drawer" footer={<><span role="status" className="catalog-secondary">{dirty?"Unsaved changes":archived?"Archived record":sheetSection==="copies"?"Copy actions are saved separately":"No unsaved changes"}</span><div className="admin-record-footer-actions"><Button variant="outline" disabled={loading} onClick={()=>void requestClose()}>Cancel</Button>{archived&&selectedBook?<Button disabled={loading} onClick={()=>void handleRestoreBook(selectedBook)}>Restore record</Button>:sheetMode==="edit"&&sheetSection==="copies"&&!dirty?null:<Button disabled={loading || (sheetMode==="edit"&&!dirty)} onClick={()=>void(sheetMode==="create"?handleCreateBook():handleUpdateBook())}>{loading?"Saving…":sheetMode==="create"?"Add record":"Save changes"}</Button>}</div></>}>
    {sheetMode==="edit"&&selectedBook&&<div className="catalog-book-status" aria-label="Book status">{metric("Available",operationalBook?.available)}{metric("Active loans",operationalBook?.active_loans)}{metric("Reservations",operationalBook?.active_reservations)}{Number(operationalBook?.overdue_loans)>0&&metric("Overdue loans",operationalBook?.overdue_loans)}{metric("Needs accession",operationalBook?.unaccessioned_copies===undefined?undefined:Math.max(0,operationalBook.unaccessioned_copies-Number(operationalBook.voided_copies??0)))}</div>}
    {sheetMode==="edit"&&selectedBook?.material_type!=="thesis"&&!archived?<AdminPageTabs value={sheetSection} onChange={value=>void changeSheetSection(value as "details"|"image"|"copies")} label="Catalog record sections" items={[{value:"details",label:"Details",icon:"transactions"},{value:"image",label:"Image",icon:"image"},{value:"copies",label:"Copies",icon:"copy"}]}><TabsContent value="details" className="catalog-drawer-tab">{editForm}</TabsContent><TabsContent value="image" className="catalog-drawer-tab">{selectedBook&&<CatalogImageEditor book={selectedBook} onImageChange={updateSelectedBookImage}/>}</TabsContent><TabsContent value="copies" className="catalog-drawer-tab"><BookCopiesWorkspace key={`${selectedBook!.id}-${initialHoldingCopyId??"list"}`} bookId={selectedBook!.id} bookTitle={selectedBook!.title} initialCopyId={initialHoldingCopyId} guardRef={holdingGuardRef} isSuperAdmin={isSuperAdmin} onViewHoldings={()=>void viewBookHoldings()}/></TabsContent></AdminPageTabs>:sheetMode==="create"?<CatalogCreateForm inSheet fields={fields} materialType={materialType} values={formValues} errors={fieldErrors} bookTypes={bookTypes} loading={loading} isbnLookup={isbnLookup} coverFile={coverFile} onCoverFileChange={setCoverFile} onMaterialChange={value=>{setMaterialType(value);if(value!=="book")setCoverFile(null);setFieldErrors({});setFormValues(value==="book"?{material_type:value,copies:"1"}:{material_type:value});}} onFieldChange={setField} onLookupIsbn={()=>void lookupIsbn()} onSubmit={()=>void handleCreateBook()} onClear={clearForm}/>:editForm}
   </AdminDetailDrawer>
  </div>;
};
export default AdminCatalogData;

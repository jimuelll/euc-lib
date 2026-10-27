import { useUnsavedChanges, AdminDetailDrawer, AdminPageTabs, AdminRowMenu } from "@/features/admin";
import CatalogRecords from "./components/CatalogRecords";
import "@/features/admin/compact-admin.css";
import "./catalog.css";
import { useAdminUrlState, queryPage } from "@/features/admin";
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { invalidateServerState } from "@/app/server-state";
import { catalogKeys } from "../catalog.keys";

import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "@/components/ui/library-glyphs";
import { printCatalogLabels } from "./catalog.labels";
import { printHolding } from "./catalog.holdings-print";
import { toast } from "@/components/ui/sonner";
import { useAdminConfirmDialog } from "@/features/admin";
import { FormField, Book, type BookType, type CatalogFormValue, type CatalogFormValues } from "./AdminCatalog.types";
import { archiveCatalogBook, createCatalogBook, fetchBookTypes, fetchBookHoldings, lookupBookIsbn, restoreCatalogBook, searchCatalogBooks, updateCatalogBook, uploadCatalogBookImage, importCatalogIsbnImage, checkCatalogIsbn, type IsbnMatch } from "./catalog.api";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatLibraryDate } from "@/utils/libraryTime";
import CatalogCreateForm from "./components/CatalogCreateForm";
import CatalogEditForm from "./components/CatalogEditForm";
import BookCopiesWorkspace from "./components/BookCopiesWorkspace";
import BookHoldingsEditor from "./components/BookHoldingsEditor";


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
  const navigate = useNavigate();
  const [params,patchParams] = useAdminUrlState();
  const currentPage = queryPage(params.get("page"));
  const [sheetMode,     setSheetMode]     = useState<"create" | "edit" | "copy" | null>(null);
  const [sheetSection,  setSheetSection]  = useState<"details" | "image" | "copies">("details");
  const [materialType,  setMaterialType]  = useState<"book" | "thesis">("book");
  const [formValues,    setFormValues]    = useState<CatalogFormValues>({});
  const [coverFile,     setCoverFile]     = useState<File | null>(null);
  const [lookupCover, setLookupCover] = useState<string | null>(null);
  const [lookupFields, setLookupFields] = useState<string[]>([]);
  const [duplicate, setDuplicate] = useState<IsbnMatch | null>(null);
  const [duplicateError, setDuplicateError] = useState("");
  const [copyDirty, setCopyDirty] = useState(false);
  const [needsOnly, setNeedsOnly] = useState(false);
  const [draftVersion, setDraftVersion] = useState(0);
  const [createSection, setCreateSection] = useState("Book info");
  const fieldVersions = useRef<Record<string, number>>({});
  const duplicateRequest = useRef(0);
  const lookupRequest = useRef(0);
  const coverTouched = useRef(false);
  const policyTouched = useRef(false);
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
  const [initialAddOpen, setInitialAddOpen] = useState(false);
  // Snapshot the page at entry: a saved copy may disappear from the active filter.
  const [copyQueue, setCopyQueue] = useState<CatalogHolding[]>([]);
  const [copyPosition, setCopyPosition] = useState(0);
  const [prefillAccession, setPrefillAccession] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [holdingActionsHost,setHoldingActionsHost] = useState<HTMLDivElement|null>(null);
  const focusedCopy = copyQueue[copyPosition];
  const syncFocusedCopy = useCallback((updated: CatalogHolding) => setCopyQueue(queue => {
    const existing = queue.find(copy => copy.copy_id === updated.copy_id);
    if (!existing || JSON.stringify(existing) === JSON.stringify(updated)) return queue;
    return queue.map(copy => copy.copy_id === updated.copy_id ? {...copy, ...updated} : copy);
  }), []);
  const originRef = useRef<{ element: HTMLElement | null; selector: string; scroll: { element: HTMLElement; top: number; left: number }[]; x: number; y: number } | null>(null);
  const openingRef = useRef(false);
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

  const guardValues = { ...formValues };
  if (sheetMode === "create" && !policyTouched.current) delete guardValues.book_type_id;
  const { dirty, confirmDiscard, discardDialog } = useUnsavedChanges({ formValues: guardValues, hasCoverImage: Boolean(coverFile || lookupCover) }, sheetMode === "edit" || sheetMode === "create", `${sheetMode}-${selectedBook?.id ?? "new"}-${draftVersion}`, undefined, {guardLinks:false});
  const confirmDiscardRef = useRef(confirmDiscard);
  confirmDiscardRef.current = confirmDiscard;
  const rememberOrigin = (selector = "") => {
    if (sheetMode !== null || openingRef.current) return;
    const element = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scroll: { element: HTMLElement; top: number; left: number }[] = [];
    const row = selector ? document.querySelector<HTMLElement>(selector) : element;
    for (let parent = row?.parentElement; parent; parent = parent.parentElement) {
      if (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth) scroll.push({element:parent,top:parent.scrollTop,left:parent.scrollLeft});
    }
    originRef.current = {element,selector,scroll,x:window.scrollX,y:window.scrollY};
  };
  const restoreOrigin = () => {
    const origin = originRef.current;
    if (!origin) return;
    requestAnimationFrame(() => {
      origin.scroll.forEach(({element,top,left}) => { element.scrollTop=top; element.scrollLeft=left; });
      if (window.scrollX !== origin.x || window.scrollY !== origin.y) window.scrollTo(origin.x,origin.y);
      const target = origin.element?.isConnected && origin.element !== document.body ? origin.element : origin.selector ? document.querySelector<HTMLElement>(origin.selector) : null;
      const fallback = document.querySelector<HTMLElement>('.catalog-record-title, [role="tab"][aria-selected="true"]');
      (target ?? fallback)?.focus({preventScroll:true});
    });
  };
  const requestClose = async () => {
    if (loading || copyBusy || !await confirmDiscard()) return;
    if (holdingGuardRef.current && !await holdingGuardRef.current()) return;
    closeSheet();
  };
  // One navigation guard checks both drafts; two independent link guards can
  // otherwise navigate after only one of the two discard confirmations.
  useEffect(() => {
    if (sheetMode === null) return;
    const link = (event: MouseEvent) => {
      const anchor=(event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement|null;
      if(!anchor||anchor.target==="_blank"||anchor.hasAttribute("download")||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
      const url=new URL(anchor.href);
      if(url.origin!==location.origin||(url.pathname===location.pathname&&url.search===location.search))return;
      event.preventDefault();event.stopPropagation();
      void (async()=>{
        if(loading||copyBusy||!await confirmDiscard())return;
        if(holdingGuardRef.current&&!await holdingGuardRef.current())return;
        navigate(url.pathname+url.search+url.hash);
      })();
    };
    document.addEventListener("click",link,true);
    return()=>document.removeEventListener("click",link,true);
  },[sheetMode,loading,copyBusy,confirmDiscard,navigate]);

  const activeFields = fields.filter((f) => !f.archived);
  const sortedFields = [...activeFields].sort((a, b) => a.order - b.order);
  const fieldsForMaterial = (type: "book" | "thesis") => sortedFields.filter((field) => ((field.scope ?? "shared") === "shared" || field.scope === type) && (type !== "thesis" || !["isbn","copies"].includes(field.key)));
  const defaultPolicy = (category?: CatalogFormValue) => bookTypes.find(t => t.name.trim().toLowerCase() === String(category || "").trim().toLowerCase()) ?? bookTypes.find(t => t.name.trim().toLowerCase() === "circulation");
  const setField = (key: string, value: CatalogFormValue) => {
    fieldVersions.current[key] = (fieldVersions.current[key] ?? 0) + 1;
    setLookupFields(current => current.filter(item => item !== key));
    if (key === "isbn") { duplicateRequest.current++; lookupRequest.current++; setDuplicate(null); setDuplicateError(""); if (!coverTouched.current) setLookupCover(null); }
    if (key === "book_type_id") policyTouched.current = true;
    setFormValues(p => ({ ...p, [key]: value, ...(key === "category" && sheetMode === "create" && !policyTouched.current ? {book_type_id: String(defaultPolicy(value)?.id ?? "")} : {}) }));
    setFieldErrors(errors => { const next = { ...errors }; delete next[key]; return next; });
  };
  const clearForm = () => { setFormValues({}); setFieldErrors({}); setCoverFile(null); setLookupCover(null); setLookupFields([]); setDuplicate(null); setDuplicateError(""); duplicateRequest.current++; lookupRequest.current++; coverTouched.current=false; policyTouched.current=false; };
  const closeSheet = () => { setSheetMode(null); setSelectedBook(null); setSheetSection("details"); setInitialHoldingCopyId(null); setInitialAddOpen(false); setCopyQueue([]); clearForm(); };

  const lookupIsbn = async () => {
    const isbn = String(formValues.isbn ?? "").trim();
    if (!isbn) return toast.error("Enter an ISBN first");
    const request = ++lookupRequest.current;
    const versions = { ...fieldVersions.current };
    void checkDuplicate(isbn);
    try {
      const metadata = await isbnLookupMutation.mutateAsync(isbn);
      if (request !== lookupRequest.current) return;
      // The lookup may return more than the active form supports. Keep the
      // payload aligned with the current form-builder schema so optional
      // metadata can never become an unknown-field save error.
      const visibleKeys = new Set(fieldsForMaterial("book").map((field) => field.key));
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
          if (key !== "isbn" && visibleKeys.has(key) && value && (fieldVersions.current[key] ?? 0) === (versions[key] ?? 0)) next[key] = value as CatalogFormValue;
        }
        return next;
      });
      // Compute labels outside the state updater so React's deferred updates cannot delay feedback.
      const keys = ["title", "author", "publisher", "edition", "copyright_year", "publication_place", "physical_description"] as const;
      setLookupFields(keys.filter(key => visibleKeys.has(key) && metadata[key] && (fieldVersions.current[key] ?? 0) === (versions[key] ?? 0)));
      if (metadata.cover_url && !coverTouched.current) setLookupCover(metadata.cover_url);
      toast.success("Available ISBN details added — review before saving");
    } catch (error: unknown) {
      if (request !== lookupRequest.current) return;
      const message = getApiErrorMessage(error, "ISBN lookup failed");
      setFieldErrors((current) => ({ ...current, isbn: message }));
    }
  };

  const checkDuplicate = async (isbn = String(formValues.isbn ?? "").trim()) => {
    const request = ++duplicateRequest.current;
    if (!isbn) { setDuplicate(null); return; }
    try { const result = await checkCatalogIsbn(isbn, sheetMode === "edit" ? selectedBook?.id : undefined); if (request === duplicateRequest.current) { setDuplicate(result); setDuplicateError(""); } }
    catch (error) { if (request === duplicateRequest.current) { setDuplicate(null); setDuplicateError(getApiErrorMessage(error,"Could not check this ISBN. Try again.")); } }
  };

  const validateRequired = (type = materialType, requirePolicy = true) => {
    const errors: Record<string, string> = {};
    if (type === "book" && requirePolicy && !String(formValues.book_type_id ?? "").trim()) errors.book_type_id = "Select a loan policy.";
    for (const field of fieldsForMaterial(type)) {
      if ((sheetMode === "create" || field.key !== "copies") && field.required && !(Array.isArray(formValues[field.key]) ? (formValues[field.key] as string[]).some(item=>item.trim()) : String(formValues[field.key] ?? "").trim())) {
        errors[field.key] = `${field.label} is required.`;
      }
    }
    setFieldErrors(errors);
    const first = Object.values(errors)[0];
    if (first) toast.error("Review the highlighted fields.");
    return !first;
  };

  const handleCreateBook = async (addAnother = false) => {
    if (!validateRequired()) return;
    setLoading(true);
    try {
      const result = await createMutation.mutateAsync({ ...formValues, material_type: materialType });
      let coverUploadError: string | null = null;
      if (materialType === "book" && (coverFile || lookupCover)) {
        try {
          if (coverFile) await uploadCatalogBookImage(result.id, coverFile);
          else await importCatalogIsbnImage(result.id, String(formValues.isbn ?? ""));
        } catch (error: unknown) {
          coverUploadError = getApiErrorMessage(error, "Could not upload the cover image.");
        }
      }
      await invalidateCatalog();
      if (addAnother) {
        clearForm();
        setFormValues(materialType === "book" ? { material_type: "book", copies: "1", book_type_id: String(defaultPolicy()?.id ?? "") } : { material_type: "thesis" });
        setDraftVersion(version=>version+1);
        requestAnimationFrame(()=>document.getElementById("create-field-title")?.focus());
      } else closeSheet();
      if (coverUploadError) {
        toast.error(`Record created, but its cover could not be uploaded: ${coverUploadError}`, { action: { label: "Open record", onClick: () => { void (async()=>{if (!await confirmDiscardRef.current() || (holdingGuardRef.current && !await holdingGuardRef.current())) return; navigate(`/admin/catalog?record=${result.id}&section=image`);})(); } }, duration: 12000 });
      } else {
        toast.success(materialType === "book" && (coverFile || lookupCover) ? `${result.message} Cover image uploaded.` : result.message);
      }
    } catch (error: unknown) {
      setFieldErrors(getServerFieldErrors(error));
      toast.error(getApiErrorMessage(error, "Failed to add book"));
    } finally { setLoading(false); }
  };

  const handleUpdateBook = async () => {
    if (loading || copyBusy || (holdingGuardRef.current && !await holdingGuardRef.current())) return;
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
    clearForm();
    rememberOrigin(`[data-record-id="${b.id}"]`);
    setInitialHoldingCopyId(null);
    setInitialAddOpen(false);
    setNeedsOnly(false);
    setCopyDirty(false);
    setDuplicate(null);
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
  useEffect(()=>{const id=Number(params.get('record'));if(!Number.isInteger(id)||id<=0)return;let cancelled=false;void searchCatalogBooks({query:'',status:'all',materialType:'all',bookId:id,page:1}).then(result=>{if(cancelled)return;const book=result.rows.find(row=>row.id===id);if(book){selectBookForEdit(book);const section=params.get('section');if((section==='image'||section==='copies')&&book.material_type!=='thesis'&&!book.deleted_at)setSheetSection(section);}else toast.error('Catalog record not found.');patchParams({record:null,section:null},true);}).catch(error=>{if(!cancelled){toast.error(getApiErrorMessage(error,'Could not open this record.'));patchParams({record:null,section:null},true);}});return()=>{cancelled=true;};},[params.get('record')]);
  const openCopies = (book: Book) => { selectBookForEdit(book); setSheetSection("copies"); };
  const openHoldings = async (book: Book) => {
    if (openingRef.current) return;
    rememberOrigin(`[data-record-id="${book.id}"]`);
    openingRef.current = true;
    try {
      const copies = await queryClient.fetchQuery({queryKey:catalogKeys.bookHoldings(book.id),queryFn:({signal})=>fetchBookHoldings(book.id,signal)});
      openCopies(book);
      setInitialHoldingCopyId(copies.find(copy=>Boolean(copy.is_active)&&!copy.accession_voided&&!copy.accession_number?.trim())?.copy_id??null);
      setInitialAddOpen(copies.length===0);
    } catch (error) { toast.error(getApiErrorMessage(error,"Could not load copies. Please retry.")); }
    finally { openingRef.current=false; }
  };
  const handleOpenHolding = (holding: CatalogHolding, queue: CatalogHolding[]) => {
    rememberOrigin(`[data-copy-id="${holding.copy_id}"]`);
    setCopyQueue([...queue]); setCopyPosition(Math.max(0,queue.findIndex(copy=>copy.copy_id===holding.copy_id))); setSheetMode("copy");
  };
  const moveCopy = async (position: number) => {
    if (copyBusy || position<0 || position>=copyQueue.length || position===copyPosition) return;
    if (holdingGuardRef.current && !await holdingGuardRef.current()) return;
    setCopyPosition(position);
  };
  const editFocusedRecord = async () => {
    if (!focusedCopy || openingRef.current || copyBusy) return;
    if (holdingGuardRef.current && !await holdingGuardRef.current()) return;
    openingRef.current=true; setCopyBusy(true);
    try {
      const result=await searchCatalogBooks({query:"",materialType:"all",status:"all",page:1,bookId:focusedCopy.book_id});
      const record=result.rows.find(row=>row.id===focusedCopy.book_id);
      if(!record)throw new Error("Record not found");
      selectBookForEdit(record);
    } catch(error) {toast.error(getApiErrorMessage(error,"Could not load this record. Please retry."));}
    finally {openingRef.current=false;setCopyBusy(false);}
  };
  const openCreate = () => { rememberOrigin(); clearForm(); setSelectedBook(null); setMaterialType("book"); setFormValues({ material_type: "book", copies: "1", book_type_id: String(defaultPolicy()?.id ?? "") }); setSheetSection("details"); setSheetMode("create"); setCreateSection("Book info"); };
  useEffect(() => { if (sheetMode === "create" && materialType === "book" && !policyTouched.current && !formValues.book_type_id && bookTypes.length) setFormValues(current=>({...current,book_type_id:String(defaultPolicy(current.category)?.id??"")})); }, [sheetMode, materialType, bookTypesQuery.data]);
  useEffect(() => {
    if (sheetMode !== "create") return;
    let body: HTMLElement | null = null;
    const update = () => {
      if (!body) return;
      const top = body.getBoundingClientRect().top + 80;
      const sections = [["Book info","book-info"],["Contributors","contributors"],["Circulation","circulation"]] as const;
      let current = "Book info";
      for (const [label, id] of sections) { const element = document.getElementById(`create-field-${id}`); if (element && element.getBoundingClientRect().top <= top) current = label; }
      setCreateSection(current);
    };
    const frame = requestAnimationFrame(() => { body = document.querySelector<HTMLElement>(".catalog-record-drawer .admin-record-body"); body?.addEventListener("scroll", update, {passive:true}); });
    return () => { cancelAnimationFrame(frame); body?.removeEventListener("scroll", update); };
  }, [sheetMode, materialType]);
  const changeSheetSection = async (section: "details" | "image" | "copies") => {
    if (loading || copyBusy) return;
    if (sheetSection === "copies" && section !== "copies" && holdingGuardRef.current && !await holdingGuardRef.current()) return;
    if (section !== "copies") setInitialAddOpen(false);
    setSheetSection(section);
  };

  const selectedFilters = {query:"",materialType:"all" as const,status:"all" as const,page:1,bookId:selectedBook?.id};
  const selectedQuery = useQuery({queryKey:catalogKeys.adminSearch(selectedFilters),queryFn:({signal})=>searchCatalogBooks(selectedFilters,signal),enabled:sheetMode==="edit"&&!!selectedBook});
  const focusedHoldings = useQuery({queryKey:catalogKeys.bookHoldings(focusedCopy?.book_id??0),queryFn:({signal})=>fetchBookHoldings(focusedCopy!.book_id,signal),enabled:sheetMode==="copy" && !!focusedCopy});
  const selectedHoldings = useQuery({queryKey:catalogKeys.bookHoldings(selectedBook?.id??0),queryFn:({signal})=>fetchBookHoldings(selectedBook!.id,signal),enabled:sheetMode==="edit"&&!!selectedBook&&!selectedBook.deleted_at&&selectedBook.material_type!=="thesis"});
  const operationalBook = selectedQuery.data?.rows.find(row=>row.id===selectedBook?.id) ?? selectedBook;
  const archiveBlocked=Number(operationalBook?.active_loans)>0 || Number(operationalBook?.active_reservations)>0;
  const archived=Boolean(selectedBook?.deleted_at);
  const duplicateWarning = duplicate ? <p className="catalog-warning" role="status">This ISBN is already in the catalogue: {duplicate.title}. {duplicate.deleted_at ? "This record is archived. " : "Add a copy instead? "}<a className="catalog-link-action" href={`/admin/catalog?record=${duplicate.id}${duplicate.deleted_at?"":"&section=copies"}`}>{duplicate.deleted_at?"View and restore record":"Open Copies"}</a></p> : duplicateError ? <p className="catalog-warning" role="status">{duplicateError}</p> : null;
  const missingFields = fieldsForMaterial(materialType).filter(field=>field.required && !(Array.isArray(formValues[field.key]) ? (formValues[field.key] as string[]).some(item=>item.trim()) : String(formValues[field.key]??"").trim()));
  const missingPolicy = materialType==="book" && !String(formValues.book_type_id??"").trim();
  const missingCount = missingFields.length + Number(missingPolicy);
  const hasContributors = fieldsForMaterial(materialType).some(field=>["added_authors","editors","coordinators","consultants","contributors","illustrators"].includes(field.key));
  const jumpToMissing = () => { const key=missingFields[0]?.key; const id=key==="isbn"?"create-isbn":key?`create-field-${key}`:"create-field-policy"; const target=document.getElementById(id) ?? document.getElementById(`${id}-0`); target?.scrollIntoView?.({block:"center"}); target?.focus(); };
  const jumpToSection = (name:string) => {setCreateSection(name);const id=name==="Book info"?"book-info":name.toLowerCase();const heading=document.querySelector<HTMLElement>(`#create-field-${id} h3`);heading?.scrollIntoView?.({block:"start"});heading?.focus({preventScroll:true});};
  const editForm = selectedBook && <fieldset disabled={archived || loading} className="catalog-edit-fields"><CatalogEditForm inSheet book={operationalBook??selectedBook} fields={fields} values={formValues} errors={fieldErrors} bookTypes={bookTypes} loading={loading} onFieldChange={setField} onIsbnBlur={()=>void checkDuplicate()} isbnWarning={duplicateWarning} onUpdate={()=>void handleUpdateBook()} onArchive={()=>void handleDeleteBook()} onDeselect={()=>void requestClose()} onCopies={()=>void changeSheetSection("copies")} archiveBlocked={archiveBlocked} dirty={dirty}/></fieldset>;
  const showNeedsCopies = async () => {
    if (loading || copyBusy) return;
    if (sheetSection === "copies" && holdingGuardRef.current && !await holdingGuardRef.current()) return;
    setInitialHoldingCopyId(null);
    setNeedsOnly(true);
    setSheetSection("copies");
  };
  const metric=(label:string,value?:number)=> <div data-tone={value && label==="Needs accession"?"amber":value && label==="Overdue loans"?"red":undefined}><span>{label}</span>{label==="Needs accession" && value ? <button type="button" className="catalog-stat-link" onClick={()=>void showNeedsCopies()}><strong>{Number(value).toLocaleString("en-PH")}</strong><span className="sr-only"> Show copies needing accession</span></button> : <strong>{value===undefined?"—":Number(value).toLocaleString("en-PH")}</strong>}</div>;
  return <div className="catalog-page">{confirmDialog}{discardDialog}{(params.get("fieldKey")||params.get("unheld")==="1")&&<div className="flex justify-between gap-4 rounded-md border border-border bg-muted/30 p-3 text-sm"><span>{params.get("unheld")==="1"?"Books without eligible accessioned copies":`${params.get("fieldUsage")==="missing"?"Records missing a value for":"Records using"} ${params.get("fieldKey")}`}</span><Button variant="outline" onClick={()=>patchParams({fieldKey:null,fieldUsage:null,unheld:null,page:null})}>Clear configuration filter</Button></div>}{params.get("bookTypeId")&&<div className="flex justify-between gap-4 rounded-md border border-border bg-muted/30 p-3 text-sm"><span>Showing books assigned to {bookTypesQuery.data?.find(type=>type.id===Number(params.get("bookTypeId")))?.name||"this policy"}</span><Button variant="outline" onClick={()=>patchParams({bookTypeId:null,page:null})}>Clear policy filter</Button></div>}{params.get("uncategorized")==="1"&&<div className="flex justify-between gap-4 rounded-md border border-border bg-muted/30 p-3 text-sm"><span>Showing uncategorized titles</span><Button variant="outline" onClick={()=>patchParams({uncategorized:null,page:null})}>Clear category filter</Button></div>}
   <CatalogRecords query={catalogQuery} filters={searchFilters} fields={fields} policies={bookTypes} onCreate={openCreate} onEdit={selectBookForEdit} onCopies={openCopies} onHoldings={book=>void openHoldings(book)} onHolding={handleOpenHolding} onRestore={book=>void handleRestoreBook(book)} onRefresh={invalidateCatalog}/>
   <AdminDetailDrawer open={sheetMode!==null} onClose={()=>void requestClose()} onAfterClose={restoreOrigin} title={sheetMode==="create"?"Add catalog record":sheetMode==="copy"?focusedCopy?.title||"Copy holdings":selectedBook?.title||"Catalog record"} description={sheetMode==="create"?"Create a descriptive record and its initial physical copies.":sheetMode==="copy" && focusedCopy?<><span>{`Copy ${Number(focusedCopy.barcode.match(/-(\d+)$/)?.[1] || 0) || focusedCopy.copy_id} · ${focusedCopy.barcode} · ${focusedCopy.accession_number ? `Acc. ${focusedCopy.accession_number}` : "Needs accession"}`}</span><span className="catalog-header-status">{focusedCopy.accession_voided ? "Accession voided" : !focusedCopy.is_active ? "Inactive" : ["lost","weeded","discarded"].includes(focusedCopy.condition) ? focusedCopy.condition.charAt(0).toUpperCase()+focusedCopy.condition.slice(1) : !focusedCopy.accession_number ? "Needs accession" : focusedCopy.circulation_status === "borrowed" ? "Borrowed" : focusedCopy.circulation_status === "reserved" ? "Reserved" : focusedCopy.borrow_eligible ? "Available" : "Unavailable"}</span>{focusedCopy.borrower_name && <span> · Borrowed by {focusedCopy.borrower_name}{focusedCopy.due_date ? ` · due ${formatLibraryDate(focusedCopy.due_date)}` : ""} · <button type="button" className="catalog-link-action" onClick={async()=>{if(await holdingGuardRef.current?.()) navigate(`/admin/borrowing?mode=return&copy=${encodeURIComponent(focusedCopy.barcode)}`);}}>View loan</button></span>}</>:"Edit the record or manage physical copies and accession details."} headerActions={sheetMode==="copy"&&focusedCopy?<div className="catalog-copy-header-actions"><span>Copy {copyPosition+1} of {copyQueue.length} · {copyQueue.filter(copy=>copy.is_active && !copy.accession_voided && !copy.accession_number?.trim()).length} need accession</span><Button variant="ghost" size="icon" aria-label="Previous copy" disabled={copyBusy || copyPosition<=0} onClick={()=>{setPrefillAccession(false);void moveCopy(copyPosition-1);}}><ArrowLeft/></Button><Button variant="ghost" size="icon" aria-label="Next copy" disabled={copyBusy || copyPosition>=copyQueue.length-1} onClick={()=>{setPrefillAccession(false);void moveCopy(copyPosition+1);}}><ArrowRight/></Button><AdminRowMenu label="Copy actions" disabled={copyBusy} items={[{label:"Edit record details",onSelect:()=>void editFocusedRecord()},{label:"Print holdings record",disabled:copyDirty || !focusedHoldings.data?.some(copy=>copy.copy_id===focusedCopy.copy_id),onSelect:()=>{const holding=queryClient.getQueryData<CatalogHolding[]>(catalogKeys.bookHoldings(focusedCopy.book_id))?.find(copy=>copy.copy_id===focusedCopy.copy_id);if(holding)void printHolding(holding);} },{label:"Print QR barcode label",onSelect:()=>void printCatalogLabels([focusedCopy.barcode])}]}/></div>:sheetMode==="create"?<nav className="catalog-section-index" aria-label="Create record sections">{["Book info",...(hasContributors?["Contributors"]:[]),...(materialType==="book"?["Circulation"]:[])].map(name=><button key={name} type="button" aria-current={createSection===name?"location":undefined} onClick={()=>jumpToSection(name)}>{name}</button>)}</nav>:undefined} className="catalog-record-drawer" footer={sheetMode==="copy"?<><div className="catalog-focused-save-host" ref={setHoldingActionsHost}/><Button variant="ghost" disabled={copyBusy} onClick={()=>void requestClose()}>Close</Button></>:<><span role="status" className="catalog-secondary">{sheetMode==="create"?(missingCount?<button type="button" className="catalog-link-action" onClick={jumpToMissing}>{missingCount} required {missingCount===1?"field":"fields"} left</button>:"Required fields complete"):(dirty||copyDirty)?"Unsaved changes":archived?"Archived record":sheetSection==="copies"?"Copy actions are saved separately":sheetSection==="image"?"Image changes save immediately":"No unsaved changes"}</span><div className="admin-record-footer-actions"><Button variant="outline" disabled={loading||copyBusy} onClick={()=>void requestClose()}>{dirty||copyDirty?"Cancel":"Close"}</Button>{sheetMode==="create"&&<Button variant="outline" disabled={loading||copyBusy} onClick={()=>void handleCreateBook(true)}>Add record and add another</Button>}{archived&&selectedBook?<Button disabled={loading} onClick={()=>void handleRestoreBook(selectedBook)}>Restore record</Button>:sheetMode==="edit"&&sheetSection==="copies"&&!dirty?null:<Button disabled={loading || copyBusy || (sheetMode==="edit"&&!dirty)} onClick={()=>void(sheetMode==="create"?handleCreateBook():handleUpdateBook())}>{loading?"Saving…":sheetMode==="create"?"Add record":"Save changes"}</Button>}</div></>}>
    {sheetMode==="edit"&&selectedBook&&<div className="catalog-book-status" aria-label="Book status">{metric("Available",operationalBook?.available)}{metric("Active loans",operationalBook?.active_loans)}{metric("Reservations",operationalBook?.active_reservations)}{Number(operationalBook?.overdue_loans)>0&&metric("Overdue loans",operationalBook?.overdue_loans)}{metric("Needs accession",selectedHoldings.data?.filter(copy=>Boolean(copy.is_active)&&!copy.accession_voided&&!copy.accession_number?.trim()).length)}</div>}
    {sheetMode==="copy"&&focusedCopy?<BookHoldingsEditor key={focusedCopy.copy_id} actionsHost={holdingActionsHost} bookId={focusedCopy.book_id} bookTitle={focusedCopy.title} copyId={focusedCopy.copy_id} guardRef={holdingGuardRef} isSuperAdmin={isSuperAdmin} onBusyChange={setCopyBusy} onDirtyChange={setCopyDirty} onManageCopies={()=>void editFocusedRecord()} navigation={{position:copyPosition,total:copyQueue.length,label:"Copies in this results page",onPrevious:()=>void moveCopy(copyPosition-1),onNext:()=>void moveCopy(copyPosition+1)}} prefillAccession={prefillAccession} onCurrentChange={syncFocusedCopy} onSavedNext={(accession)=>{setCopyQueue(queue=>queue.map((copy,index)=>index===copyPosition?{...copy,accession_number:accession}:copy));setPrefillAccession(true);setCopyPosition(position=>Math.min(position+1,copyQueue.length-1));}}/>:sheetMode==="edit"&&selectedBook?.material_type!=="thesis"&&!archived?<AdminPageTabs value={sheetSection} onChange={value=>void changeSheetSection(value as "details"|"image"|"copies")} label="Catalog record sections" items={[{value:"details",label:"Details",icon:"transactions",unsaved:dirty,descriptionId:"catalog-details-dirty"},{value:"image",label:"Image",icon:"image"},{value:"copies",label:"Copies",icon:"copy",unsaved:copyDirty,descriptionId:"catalog-copies-dirty"}]}><TabsContent value="details" className="catalog-drawer-tab">{editForm}</TabsContent><TabsContent value="image" className="catalog-drawer-tab">{selectedBook&&<CatalogImageEditor book={selectedBook} onImageChange={updateSelectedBookImage}/>}</TabsContent><TabsContent value="copies" className="catalog-drawer-tab"><BookCopiesWorkspace key={selectedBook!.id} bookId={selectedBook!.id} bookTitle={selectedBook!.title} initialCopyId={initialHoldingCopyId} guardRef={holdingGuardRef} isSuperAdmin={isSuperAdmin} initialAddOpen={initialAddOpen} needsOnly={needsOnly} onNeedsOnlyChange={setNeedsOnly} onDirtyChange={setCopyDirty} onBusyChange={setCopyBusy} onSelectionChange={setInitialHoldingCopyId}/></TabsContent></AdminPageTabs>:sheetMode==="create"?<CatalogCreateForm inSheet fields={fields} materialType={materialType} values={formValues} errors={fieldErrors} bookTypes={bookTypes} loading={loading} isbnLookup={isbnLookup} coverFile={coverFile} lookupCover={lookupCover} lookupFields={lookupFields} onIsbnBlur={()=>void checkDuplicate()} isbnWarning={duplicateWarning} onCoverFileChange={file=>{coverTouched.current=true;setCoverFile(file);setLookupCover(null);}} onMaterialChange={value=>{duplicateRequest.current++;lookupRequest.current++;setDuplicateError("");coverTouched.current=false;setMaterialType(value);if(value!=="book"){setCoverFile(null);setLookupCover(null);}setFieldErrors({});setDuplicate(null);setLookupFields([]);policyTouched.current=false;setFormValues(value==="book"?{material_type:value,copies:"1",book_type_id:String(defaultPolicy()?.id??"")}:{material_type:value});}} onFieldChange={setField} onLookupIsbn={()=>void lookupIsbn()} onSubmit={()=>void handleCreateBook()} onClear={clearForm}/>:editForm}
   </AdminDetailDrawer>
  </div>;
};
export default AdminCatalogData;

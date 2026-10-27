import { Link, useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/use-debounce";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Barcode, Loader2, Lock, ShieldAlert } from "@/components/ui/library-glyphs";
import { Button } from "@/components/ui/button";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchAcademicPrograms } from "@/features/library-settings";
import { useUnsavedChanges, AdminDateTime } from "@/features/admin";
import { toast } from "@/components/ui/sonner";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatLibraryDate } from "@/utils/libraryTime";
import { fetchBookHoldings, fetchHoldingOptions, saveCopyHolding, voidCopyAccession, updateCatalogCopyCondition, type CatalogHolding } from "../catalog.api";
import { catalogKeys } from "../../catalog.keys";
import { librarySettingsKeys } from "@/features/library-settings/library-settings.keys";

type Draft = { accession_number: string; price: string; program_id: string; course_code: string; location: string; date_acquired: string; distributor: string; invoice_reference: string };
const emptyDraft = (): Draft => ({ accession_number: "", price: "", program_id: "", course_code: "", location: "", date_acquired: "", distributor: "", invoice_reference: "" });
const asDraft = (holding: CatalogHolding): Draft => ({
  accession_number: holding.accession_number ?? "", price: holding.price === null ? "" : String(holding.price),
  program_id: holding.program_id === null ? "" : String(holding.program_id), course_code: holding.course_code ?? "",
  location: holding.location ?? "", date_acquired: holding.date_acquired ? String(holding.date_acquired).slice(0, 10) : "",
  distributor: holding.distributor ?? "", invoice_reference: holding.invoice_reference ?? "",
});
const copyLabel = (copy: Pick<CatalogHolding, "copy_id" | "barcode">): string => {
  const sequence = copy.barcode.match(/-(\d+)$/)?.[1];
  if (sequence && Number(sequence) > 0) return `Copy ${Number(sequence)}`;
  return copy.barcode ? `Barcode ${copy.barcode}` : `Copy ID ${copy.copy_id}`;
};
const labelClass = "mb-1.5 block text-xs font-medium text-muted-foreground";
const EMPTY_HOLDINGS: CatalogHolding[] = [];
const lendingStatus = (copy: CatalogHolding) => {
  if (!copy.is_active) return "Inactive";
  if (copy.accession_voided) return "Accession voided";
  if (["lost", "weeded", "discarded"].includes(copy.condition)) return copy.condition.charAt(0).toUpperCase() + copy.condition.slice(1);
  if (copy.needs_policy) return "Needs loan policy";
  if (!copy.accession_number?.trim()) return "Needs accession";
  if (copy.circulation_status === "borrowed") return "Borrowed";
  if (copy.circulation_status === "reserved") return "Reserved";
  return copy.borrow_eligible ? "Available to borrow" : "Unavailable";
};

type Props = {
  bookId: number;
  bookTitle: string;
  initialCopyId?: number | null;
  guardRef: React.MutableRefObject<(() => Promise<boolean>) | null>;
  onManageCopies: () => void;
  isSuperAdmin?: boolean;
  inline?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Controlled selection; a missing ID must never silently open a different copy. */
  copyId?: number;
  navigation?: { position: number; total: number; label: string; onPrevious: () => void; onNext: () => void };
  onSavedNext?: (accession: string) => void;
  actionsHost?: HTMLElement | null;
  prefillAccession?: boolean;
  onCurrentChange?: (copy: CatalogHolding) => void;
};

export default function BookHoldingsEditor({ bookId, bookTitle, initialCopyId = null, guardRef, onManageCopies, isSuperAdmin = false, inline = false, onBusyChange, onDirtyChange, copyId, navigation, onSavedNext, actionsHost, prefillAccession = false, onCurrentChange }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const holdingsQuery = useQuery({ queryKey: catalogKeys.bookHoldings(bookId), queryFn: ({ signal }) => fetchBookHoldings(bookId, signal) });
  const programsQuery = useQuery({ queryKey: librarySettingsKeys.programs("active"), queryFn: ({ signal }) => fetchAcademicPrograms("active", signal) });
  const copies = holdingsQuery.data ?? EMPTY_HOLDINGS;
  const [copyIndex, setCopyIndex] = useState(0);
  const prefilled = useRef(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const programs = programsQuery.data ?? [];
  const checkedAccession = useDebounce(draft.accession_number.trim(), 250);
  const optionsQuery = useQuery({ queryKey: ["holding-options", checkedAccession], queryFn: ({signal}) => fetchHoldingOptions(checkedAccession, signal), staleTime: 0 });
  const checkingAccession = checkedAccession !== draft.accession_number.trim() || optionsQuery.isFetching;
  const [conditionDraft, setConditionDraft] = useState<CatalogHolding["condition"]>("good");
  const [conditionDialog, setConditionDialog] = useState(false);
  const [conditionReason, setConditionReason] = useState("");
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [markSavedAfterUpdate, setMarkSavedAfterUpdate] = useState(false);
  const [initializedSelection, setInitializedSelection] = useState<string | null>(null);
  const requestedCopyId = copyId ?? initialCopyId;
  const current = copies[copyId === undefined ? copyIndex : copies.findIndex(copy => copy.copy_id === copyId)] ?? null;
  const selectionIdentity = `${bookId}:${requestedCopyId ?? "first"}`;
  const selectionInitialized = initializedSelection === selectionIdentity;
  const loading = holdingsQuery.isPending || (holdingsQuery.data !== undefined && !selectionInitialized);
  const canEditHolding = Boolean(current && (current.is_active || current.accession_number));
  const guardIdentity = current?.copy_id ?? `${bookId}-none`;
  const savedDraft = current ? asDraft(current) : null;
  const isDraftDirty = Boolean(current && selectionInitialized && savedDraft && JSON.stringify(draft) !== JSON.stringify(savedDraft));
  const statusDirty = Boolean(current && selectionInitialized && conditionDraft !== current.condition);
  const { dirty, confirmDiscard, discardDialog, markSaved } = useUnsavedChanges({draft, conditionDraft}, Boolean(current && selectionInitialized), guardIdentity, isDraftDirty || statusDirty, {guardLinks:false});
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  const completeCount = useMemo(() => copies.filter((copy) => Boolean(copy.accession_number) && !copy.accession_voided).length, [copies]);

  const saveMutation = useMutation({
    mutationFn: ({ copyId, payload }: { copyId: number; payload: Draft }) => saveCopyHolding(copyId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
  });
  const voidMutation = useMutation({
    mutationFn: ({ copyId, reason }: { copyId: number; reason: string }) => voidCopyAccession(copyId, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
  });
  const conditionMutation = useMutation({
    mutationFn: ({copyId,condition,reason}:{copyId:number;condition:CatalogHolding["condition"];reason?:string}) => updateCatalogCopyCondition(copyId,condition,reason),
    onSuccess: () => queryClient.invalidateQueries({queryKey:catalogKeys.all}),
  });
  const saving = saveMutation.isPending || conditionMutation.isPending;
  const voiding = voidMutation.isPending;

  useEffect(() => {
    onBusyChange?.(saving || voiding);
    return () => onBusyChange?.(false);
  }, [onBusyChange, saving, voiding]);

  useEffect(() => {
    if (!holdingsQuery.data || initializedSelection === selectionIdentity) return;
    const data = holdingsQuery.data;
    const preferred = requestedCopyId === null ? data.findIndex((copy) => Boolean(copy.is_active) && !copy.accession_voided && !copy.accession_number?.trim()) : data.findIndex((copy) => copy.copy_id === requestedCopyId);
    const selectedIndex = preferred >= 0 ? preferred : requestedCopyId === null ? 0 : -1;
    setCopyIndex(selectedIndex);
    setDraft(data[selectedIndex] ? asDraft(data[selectedIndex]) : emptyDraft());
    setConditionDraft(data[selectedIndex]?.condition ?? "good");
    setInitializedSelection(selectionIdentity);
  }, [holdingsQuery.data, requestedCopyId, initializedSelection, selectionIdentity]);

  useEffect(() => {
    guardRef.current = async () => !saving && !voiding && await confirmDiscard();
    return () => { guardRef.current = null; };
  }, [confirmDiscard, guardRef, saving, voiding]);

  useEffect(() => {
    if (!markSavedAfterUpdate) return;
    markSaved();
    setMarkSavedAfterUpdate(false);
  }, [draft, markSavedAfterUpdate, markSaved]);

  useEffect(() => {
    if (copyId !== undefined && selectionInitialized && !inline) document.getElementById("holding-accession")?.focus({preventScroll:true});
  }, [copyId, selectionInitialized, inline]);

  useEffect(() => { if (current) onCurrentChange?.(current); }, [current, onCurrentChange]);
  useEffect(() => {
    if (!prefilled.current && prefillAccession && selectionInitialized && current && current.is_active && !current.accession_number && !draft.accession_number && !optionsQuery.isFetching && optionsQuery.data?.nextAccession) { prefilled.current = true; setDraft(previous=>({...previous, accession_number: optionsQuery.data!.nextAccession})); }
  }, [prefillAccession, selectionInitialized, current, draft.accession_number, optionsQuery.isFetching, optionsQuery.data?.nextAccession]);

  const switchCopy = useCallback(async (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= copies.length || nextIndex === copyIndex) return;
    if (!await confirmDiscard()) return;
    setDraft(asDraft(copies[nextIndex]));
    setConditionDraft(copies[nextIndex].condition);
    setCopyIndex(nextIndex);
  }, [copies, copyIndex, confirmDiscard]);

  const setField = (key: keyof Draft, value: string) => setDraft((previous) => ({ ...previous, [key]: value }));

  const save = async (advance = false) => {
    if (!current || !canEditHolding || saving || voiding || (advance && statusDirty)) return;
    if (!draft.accession_number.trim()) return toast.error("Accession number is required");
    if (!current.accession_number && (checkingAccession || optionsQuery.isError || optionsQuery.data?.claimed)) return toast.error("That accession number has already been claimed");
    try {
      await saveMutation.mutateAsync({ copyId: current.copy_id, payload: { ...draft, accession_number: draft.accession_number.trim() } });
      const refreshed = queryClient.getQueryData<CatalogHolding[]>(catalogKeys.bookHoldings(bookId)) ?? [];
      const nextIndex = refreshed.findIndex((copy) => copy.copy_id === current.copy_id);
      if (nextIndex >= 0) setCopyIndex(nextIndex);
      if (refreshed[nextIndex]) setDraft(asDraft(refreshed[nextIndex]));
      setMarkSavedAfterUpdate(true);
      void queryClient.invalidateQueries({queryKey:["holding-options"]});
      toast.success("Holding saved");
      if (advance) {
        if (onSavedNext) onSavedNext(draft.accession_number.trim());
        else if (copyIndex < copies.length - 1) {
          setCopyIndex(copyIndex + 1);
          setDraft(asDraft(copies[copyIndex + 1]));
        }
      }
    } catch (error: unknown) { toast.error(getApiErrorMessage(error, "Failed to save holding")); }
  };

  const applyCondition = async (reason?: string) => {
    if (!current) return;
    try { await conditionMutation.mutateAsync({copyId: current.copy_id, condition: conditionDraft, reason}); setConditionDialog(false); toast.success("Copy condition updated"); } catch (error) { toast.error(getApiErrorMessage(error, "Failed to update copy condition")); }
  };

  const saveActions = current ? (
      <div className="catalog-holding-save-actions">
        <span role="status" className="catalog-secondary">{isDraftDirty ? "Unsaved changes" : statusDirty ? "Unapplied status" : "No changes"}</span>
        {!navigation && !inline && <div className="flex gap-2"><Button variant="ghost" disabled={copyIndex===0 || saving || voiding} onClick={()=>void switchCopy(copyIndex-1)}>Previous</Button><Button variant="ghost" disabled={copyIndex>=copies.length-1 || saving || voiding} onClick={()=>void switchCopy(copyIndex+1)}>Next</Button></div>}
        {canEditHolding && <div className="catalog-holding-save-buttons"><Button variant="outline" onClick={() => void save()} disabled={saving || voiding || !isDraftDirty || !draft.accession_number.trim() || (!current.accession_number && (checkingAccession || optionsQuery.isError || optionsQuery.data?.claimed))}>{saving ? "Saving…" : "Save"}</Button>{(navigation || !inline) && <Button onClick={() => void save(true)} disabled={saving || voiding || statusDirty || !isDraftDirty || !draft.accession_number.trim() || (!current.accession_number && (checkingAccession || optionsQuery.isError || optionsQuery.data?.claimed)) || (navigation ? navigation.position >= navigation.total - 1 : copyIndex >= copies.length - 1)}>Save and next<ArrowRight className="ml-2 h-4 w-4" /></Button>}</div>}
      </div>
  ) : null;

  return <>
    {discardDialog}
    <div className={inline ? "catalog-copy-editor" : copyId !== undefined ? "catalog-focused-editor" : "flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5 sm:px-6"}>
    {!inline && copyId === undefined && <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">Copy holdings</h2>
        <p className="mt-1 truncate text-sm text-muted-foreground">{bookTitle}</p>
      </div>
      {!loading && copies.length > 0 && <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{completeCount} of {copies.length} accessioned</span>}
    </div>}


    {loading ? <div className="flex flex-1 items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading copy holdings…</div> : holdingsQuery.isError ? <div role="alert" className="flex flex-1 flex-col items-center justify-center py-12 text-center"><p className="text-sm text-destructive">{getApiErrorMessage(holdingsQuery.error, "Failed to load holdings")}</p><Button className="mt-3" variant="outline" onClick={() => void holdingsQuery.refetch()}>Try again</Button></div> : copies.length === 0 ? <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
      <p className="text-sm font-medium text-foreground">This book has no copies yet</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Add a copy in Copies before recording its accession details.</p>
      <Button className="mt-4" variant="outline" onClick={onManageCopies}>Manage copies</Button>
    </div> : current ? <div className={inline ? "catalog-copy-fields" : "flex-1 py-5"}>
      {!inline && copyId === undefined && <>{copyId === undefined && <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="holding-copy" className={labelClass}>Physical copy</label>
        <select id="holding-copy" value={String(current.copy_id)} disabled={saving || voiding} onChange={(event) => { const next = copies.findIndex((copy) => copy.copy_id === Number(event.target.value)); void switchCopy(next); }} className="h-10 min-w-0 flex-1 border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {copies.map((copy) => <option key={copy.copy_id} value={copy.copy_id}>{copyLabel(copy)} · {copy.barcode} · {copy.accession_number || "Needs accession"}{!copy.is_active ? " · Inactive" : ""}</option>)}
        </select>
      </div>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-border bg-muted/20 px-3 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2"><Barcode className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="shrink-0 text-xs font-medium text-foreground">{copyLabel(current)}</span><span className="break-all font-mono text-xs text-muted-foreground">{current.barcode}</span><span className="text-xs text-muted-foreground">{current.accession_number ? `Accession ${current.accession_number}` : "No accession number"}</span></div>
        <span className={`text-xs font-medium ${current.borrow_eligible ? "text-success" : "text-muted-foreground"}`}>{lendingStatus(current)} · {current.condition}</span>
      </div>
      <div className="mt-3 border border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">Loan policy: <span className="font-medium text-foreground">{current.book_type || "Not assigned"}</span>{current.borrower_name ? ` · Borrowed by ${current.borrower_name}` : ""}{current.due_date ? ` · Due ${formatLibraryDate(current.due_date)}` : ""}</div></>}

      {!current.is_active && !current.accession_number && <p role="status" className="mt-4 border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm text-foreground">This copy is retired and has no accession yet. Restore it from Copies before assigning one.</p>}
      {!current.is_active && current.accession_number && <p role="status" className="mt-4 border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm text-foreground">This copy is retired. Its accession is permanent; you can update its other holding details here.</p>}
      {Boolean(current.accession_voided) && <p role="status" className="mt-4 border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm text-foreground">This accession is permanently voided. The number stays attached to this copy and cannot be reused. This copy cannot be borrowed; add a new physical copy to register the correct accession.</p>}
      <section className="catalog-holding-status mt-5" aria-label="Status">
        <h3 className="font-semibold">Status</h3><p className="text-sm">Circulation: {lendingStatus(current)}</p>
        <label className={labelClass} htmlFor="holding-condition">Copy condition</label>
        <select id="holding-condition" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={conditionDraft} disabled={saving || voiding} onChange={event=>setConditionDraft(event.target.value as CatalogHolding["condition"])}>{["good","damaged","lost","weeded","discarded"].map(condition=><option key={condition} value={condition}>{condition.charAt(0).toUpperCase()+condition.slice(1)}</option>)}</select>
        <p className="mt-1 text-xs text-muted-foreground">Lost, weeded, and discarded copies cannot be borrowed.</p>
        {conditionMutation.isError && <p role="alert" className="text-sm text-destructive">{getApiErrorMessage(conditionMutation.error,"Failed to update copy condition")}</p>}<Button type="button" variant="outline" className="mt-3" disabled={!statusDirty || saving || voiding} onClick={()=>{if (["lost","weeded","discarded"].includes(conditionDraft)) {setConditionReason(""); setConditionDialog(true);} else void applyCondition();}}>Apply status</Button>
      </section>
      <div className="mt-5 grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <div><label className={labelClass} htmlFor="holding-accession">Accession number <span className="text-destructive">*</span></label><Input id="holding-accession" autoComplete="off" value={draft.accession_number} readOnly={Boolean(current.accession_number)} disabled={!current.is_active && !current.accession_number || saving || voiding} onChange={(event) => setField("accession_number", event.target.value)} placeholder="Enter the accession number" /><p className="catalog-accession-help mt-1 text-xs text-muted-foreground">{current.accession_number && <Lock aria-hidden="true" className="h-3.5 w-3.5" />}{current.accession_number ? "Permanent accession number" : draft.accession_number.trim() ? `Accession ${draft.accession_number.trim()} will be permanent once saved` : "Assigned numbers cannot be changed or reused"}</p>{!current.accession_number && optionsQuery.isError && <p role="alert" className="text-destructive">Could not check accession availability. <button type="button" className="catalog-link-action" onClick={()=>void optionsQuery.refetch()}>Retry</button></p>}{!current.accession_number && !checkingAccession && optionsQuery.data?.claimed && <p role="alert" className="text-destructive">This accession number has already been claimed.</p>}{!current.accession_number && optionsQuery.data?.nextAccession && <button type="button" className="catalog-link-action" onClick={()=>setField("accession_number", optionsQuery.data!.nextAccession)}>Use suggested number {optionsQuery.data.nextAccession}</button>}{isSuperAdmin && current.accession_number && !current.accession_voided && <Button type="button" size="sm" variant="destructive" className="catalog-void-accession mt-2" onClick={() => { if (dirty) return; setVoidReason(""); setVoidDialogOpen(true); }} disabled={dirty || saving || voiding}><ShieldAlert className="mr-2 h-3.5 w-3.5" />Void mistaken accession</Button>}{isSuperAdmin && current.accession_number && dirty && <p className="mt-1 text-xs text-muted-foreground">Save or discard other holding edits before voiding the accession.</p>}</div>
        <div><label className={labelClass} htmlFor="holding-location">Location (optional)</label><Input id="holding-location" list="holding-locations" value={draft.location} disabled={!canEditHolding || saving || voiding} onChange={event=>setField("location",event.target.value)} placeholder="e.g. Main library, shelf 3" /><datalist id="holding-locations">{optionsQuery.data?.locations.map(location=><option key={location} value={location}/>)}</datalist></div>
        <div><span className={labelClass}>Loan policy</span><span className="text-sm">{current.book_type || "Not assigned"}</span></div>
      </div><details className="catalog-acquisition mt-5"><summary>Acquisition details</summary><div className="mt-4 grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <div><label className={labelClass} htmlFor="holding-price">Price (optional)</label><Input id="holding-price" type="number" min="0" step="0.01" value={draft.price} disabled={!canEditHolding || saving || voiding} onChange={(event) => setField("price", event.target.value)} placeholder="0.00" /></div>
        <div><label className={labelClass} htmlFor="holding-course">Course / program (optional)</label><Select value={draft.program_id || "none"} disabled={!canEditHolding || saving || voiding} onValueChange={(value) => setField("program_id", value === "none" ? "" : value)}><SelectTrigger id="holding-course"><SelectValue placeholder="Select a program / course" /></SelectTrigger><SelectContent><SelectItem value="none">No course</SelectItem>{current.program_id && !programs.some((program) => String(program.id) === String(current.program_id)) && <SelectItem value={String(current.program_id)} disabled>{current.course || "Inactive program / course"} (inactive)</SelectItem>}{programs.map((program) => <SelectItem key={program.id} value={String(program.id)}>{program.name}</SelectItem>)}</SelectContent></Select><Link to="/admin/holidays?tab=programs" className="catalog-link-action" onClick={event=>{event.preventDefault();void (async()=>{if(await confirmDiscard()) navigate("/admin/holidays?tab=programs");})();}}>Manage programs / courses</Link></div>
        <div><label className={labelClass} htmlFor="holding-course-code">Course code (optional)</label><Input id="holding-course-code" value={draft.course_code} disabled={!canEditHolding || saving || voiding} onChange={(event) => setField("course_code", event.target.value)} placeholder="e.g. CS101" /></div>
        <AdminDateTime disabled={!canEditHolding || saving || voiding} label="Date acquired (optional)" value={draft.date_acquired} onChange={value=>setField("date_acquired",value)} dateOnly optional />
        <div><label className={labelClass} htmlFor="holding-distributor">Distributor (optional)</label><Input id="holding-distributor" value={draft.distributor} disabled={!canEditHolding || saving || voiding} onChange={(event) => setField("distributor", event.target.value)} placeholder="e.g. Book supplier" /></div>
        <div><label className={labelClass} htmlFor="holding-invoice">Invoice / O.R. (optional)</label><Input id="holding-invoice" value={draft.invoice_reference} disabled={!canEditHolding || saving || voiding} onChange={(event) => setField("invoice_reference", event.target.value)} placeholder="e.g. INV-123" /></div>
      </div></details>
      {actionsHost ? createPortal(saveActions,actionsHost) : saveActions}
    </div> : <div role="alert" className="catalog-error">This copy is no longer available. Close the drawer or choose another copy.</div>}
    </div>
    <Dialog open={conditionDialog} onOpenChange={setConditionDialog}><DialogContent><DialogHeader><DialogTitle>Mark copy {conditionDraft}?</DialogTitle><DialogDescription>This blocks borrowing and records the reason in the audit log.</DialogDescription></DialogHeader><label htmlFor="condition-reason">Reason</label><Textarea id="condition-reason" value={conditionReason} maxLength={500} onChange={event=>setConditionReason(event.target.value)} />{conditionMutation.isError && <p role="alert" className="text-destructive">{getApiErrorMessage(conditionMutation.error,"Failed to update copy condition")}</p>}<DialogFooter><Button variant="outline" onClick={()=>setConditionDialog(false)}>Cancel</Button><Button disabled={!conditionReason.trim() || saving} onClick={()=>void applyCondition(conditionReason.trim())}>Confirm and apply</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={voidDialogOpen} onOpenChange={(open) => { if (!voiding) setVoidDialogOpen(open); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Void accession number</DialogTitle>
          <DialogDescription>This permanently makes the copy unavailable for borrowing. Its accession remains attached to this copy and cannot be reused. Add a new physical copy before recording a corrected accession.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div><label className={labelClass} htmlFor="void-accession">Accession to void</label><Input id="void-accession" value={current?.accession_number ?? ""} readOnly /></div>
          <div><label className={labelClass} htmlFor="accession-void-reason">Reason</label><Textarea id="accession-void-reason" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} maxLength={500} placeholder="Briefly explain why this accession is invalid" /></div>
          {current?.has_active_loan || current?.has_ready_reservation ? <p role="status" className="border border-warning/30 bg-warning/5 px-3 py-2 text-sm">Return this copy or resolve its prepared reservation before voiding its accession.</p> : null}
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" disabled={voiding} onClick={() => setVoidDialogOpen(false)}>Cancel</Button>
          <Button type="button" disabled={voiding || Boolean(current?.has_active_loan || current?.has_ready_reservation) || !voidReason.trim()} onClick={async () => {
            if (!current) return;
            try {
              await voidMutation.mutateAsync({ copyId: current.copy_id, reason: voidReason.trim() });
              const refreshed = queryClient.getQueryData<CatalogHolding[]>(catalogKeys.bookHoldings(bookId)) ?? [];
              const selectedIndex = refreshed.findIndex((copy) => copy.copy_id === current.copy_id);
              const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
              setCopyIndex(nextIndex);
              setDraft(refreshed[nextIndex] ? asDraft(refreshed[nextIndex]) : emptyDraft());
              setMarkSavedAfterUpdate(true);
              setVoidDialogOpen(false);
              toast.success("Accession voided permanently");
            } catch (error: unknown) { toast.error(getApiErrorMessage(error, "Failed to void accession")); }
          }}>{voiding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Void accession permanently</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

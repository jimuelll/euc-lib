import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Barcode, Check, Loader2, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchAcademicPrograms, type AcademicProgram } from "@/features/library-settings";
import { useUnsavedChanges } from "@/features/admin";
import { toast } from "@/components/ui/sonner";
import { getApiErrorMessage } from "@/utils/apiError";
import { fetchBookHoldings, saveCopyHolding, voidCopyAccession, type CatalogHolding } from "../catalog.api";

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
const lendingStatus = (copy: CatalogHolding) => {
  if (!copy.is_active) return "Inactive";
  if (copy.accession_voided) return "Accession voided";
  if (copy.condition === "lost") return "Lost";
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
};

export default function BookHoldingsEditor({ bookId, bookTitle, initialCopyId = null, guardRef, onManageCopies, isSuperAdmin = false }: Props) {
  const [copies, setCopies] = useState<CatalogHolding[]>([]);
  const [copyIndex, setCopyIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [markSavedAfterUpdate, setMarkSavedAfterUpdate] = useState(false);
  const current = copies[copyIndex] ?? null;
  const canEditHolding = Boolean(current && (current.is_active || current.accession_number));
  const guardIdentity = current?.copy_id ?? `${bookId}-none`;
  const { dirty, confirmDiscard, discardDialog, markSaved } = useUnsavedChanges(draft, Boolean(current), guardIdentity);
  const completeCount = useMemo(() => copies.filter((copy) => Boolean(copy.accession_number) && !copy.accession_voided).length, [copies]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchBookHoldings(bookId), fetchAcademicPrograms()])
      .then(([data, courses]) => {
        if (!alive) return;
        setCopies(data);
        setPrograms(courses);
        const preferred = initialCopyId === null ? data.findIndex((copy) => !copy.accession_number) : data.findIndex((copy) => copy.copy_id === initialCopyId);
        const selectedIndex = preferred >= 0 ? preferred : 0;
        setCopyIndex(selectedIndex);
        setDraft(data[selectedIndex] ? asDraft(data[selectedIndex]) : emptyDraft());
      })
      .catch(() => toast.error("Failed to load holdings"))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [bookId, initialCopyId]);

  useEffect(() => {
    guardRef.current = confirmDiscard;
    return () => { guardRef.current = null; };
  }, [confirmDiscard, guardRef]);

  useEffect(() => {
    if (!markSavedAfterUpdate) return;
    markSaved();
    setMarkSavedAfterUpdate(false);
  }, [draft, markSavedAfterUpdate, markSaved]);

  const switchCopy = useCallback(async (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= copies.length || nextIndex === copyIndex) return;
    if (!await confirmDiscard()) return;
    setDraft(asDraft(copies[nextIndex]));
    setCopyIndex(nextIndex);
  }, [copies.length, copyIndex, confirmDiscard]);

  const setField = (key: keyof Draft, value: string) => setDraft((previous) => ({ ...previous, [key]: value }));

  const save = async () => {
    if (!current || !canEditHolding) return;
    if (!draft.accession_number.trim()) return toast.error("Accession number is required");
    setSaving(true);
    try {
      await saveCopyHolding(current.copy_id, { ...draft, accession_number: draft.accession_number.trim() });
      const refreshed = await fetchBookHoldings(bookId);
      setCopies(refreshed);
      const nextIndex = refreshed.findIndex((copy) => copy.copy_id === current.copy_id);
      if (nextIndex >= 0) setCopyIndex(nextIndex);
      setDraft(asDraft(refreshed[nextIndex]));
      setMarkSavedAfterUpdate(true);
      toast.success("Holding saved");
    } catch (error: unknown) { toast.error(getApiErrorMessage(error, "Failed to save holding")); }
    finally { setSaving(false); }
  };

  return <>
    {discardDialog}
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5 sm:px-6">
    <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">Copy holdings</h2>
        <p className="mt-1 truncate text-sm text-muted-foreground">{bookTitle}</p>
      </div>
      {!loading && copies.length > 0 && <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{completeCount} of {copies.length} accessioned</span>}
    </div>

    {loading ? <div className="flex flex-1 items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading copy holdings…</div> : copies.length === 0 ? <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
      <p className="text-sm font-medium text-foreground">This book has no copies yet</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Add a copy in Copies before recording its accession details.</p>
      <Button className="mt-4" variant="outline" onClick={onManageCopies}>Manage copies</Button>
    </div> : current ? <div className="flex-1 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="holding-copy" className={labelClass}>Physical copy</label>
        <select id="holding-copy" value={String(current.copy_id)} disabled={saving || voiding} onChange={(event) => { const next = copies.findIndex((copy) => copy.copy_id === Number(event.target.value)); void switchCopy(next); }} className="h-10 min-w-0 flex-1 border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {copies.map((copy) => <option key={copy.copy_id} value={copy.copy_id}>{copyLabel(copy)} · {copy.barcode} · {copy.accession_number || "Needs accession"}{!copy.is_active ? " · Inactive" : ""}</option>)}
        </select>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-border bg-muted/20 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2"><Barcode className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="shrink-0 text-xs font-medium text-foreground">{copyLabel(current)}</span><span className="truncate font-mono text-xs text-muted-foreground">{current.barcode}</span><span className="text-xs text-muted-foreground">{current.accession_number ? `Accession ${current.accession_number}` : "No accession number"}</span></div>
        <span className={`text-xs font-medium ${current.borrow_eligible ? "text-success" : "text-muted-foreground"}`}>{lendingStatus(current)} · {current.condition}</span>
      </div>
      <div className="mt-3 border border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">Loan policy: <span className="font-medium text-foreground">{current.book_type || "Not assigned"}</span>{current.borrower_name ? ` · Borrowed by ${current.borrower_name}` : ""}{current.due_date ? ` · Due ${new Date(current.due_date).toLocaleDateString()}` : ""}</div>

      {!current.is_active && !current.accession_number && <p role="status" className="mt-4 border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm text-foreground">This copy is retired and has no accession yet. Restore it from Copies before assigning one.</p>}
      {!current.is_active && current.accession_number && <p role="status" className="mt-4 border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm text-foreground">This copy is retired. Its accession is permanent; you can update its other holding details here.</p>}
      {current.accession_voided && <p role="status" className="mt-4 border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm text-foreground">This accession is permanently voided. The number stays attached to this copy and cannot be reused. This copy cannot be borrowed; add a new physical copy to register the correct accession.</p>}
      <div className="mt-5 grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <div><label className={labelClass} htmlFor="holding-accession">Accession number <span className="text-destructive">*</span></label><Input id="holding-accession" autoComplete="off" value={draft.accession_number} readOnly={Boolean(current.accession_number)} disabled={!current.is_active && !current.accession_number || saving || voiding} onChange={(event) => setField("accession_number", event.target.value)} placeholder="Enter the accession number" /><p className="mt-1 text-xs text-muted-foreground">{current.accession_number ? "Permanent after first save" : "Assigned numbers cannot be changed or reused"}</p>{isSuperAdmin && current.accession_number && !current.accession_voided && <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => { if (dirty) return; setVoidReason(""); setVoidDialogOpen(true); }} disabled={dirty || saving || voiding}><ShieldAlert className="mr-2 h-3.5 w-3.5" />Void mistaken accession</Button>}{isSuperAdmin && current.accession_number && dirty && <p className="mt-1 text-xs text-muted-foreground">Save or discard other holding edits before voiding the accession.</p>}</div>
        <div><label className={labelClass} htmlFor="holding-price">Price</label><Input id="holding-price" type="number" min="0" step="0.01" value={draft.price} disabled={!canEditHolding || saving || voiding} onChange={(event) => setField("price", event.target.value)} placeholder="0.00" /></div>
        <div><label className={labelClass} htmlFor="holding-course">Course / program</label><Select value={draft.program_id || "none"} disabled={!canEditHolding || saving || voiding} onValueChange={(value) => setField("program_id", value === "none" ? "" : value)}><SelectTrigger id="holding-course"><SelectValue placeholder="Select a program / course" /></SelectTrigger><SelectContent><SelectItem value="none">No course</SelectItem>{current.program_id && !programs.some((program) => String(program.id) === String(current.program_id)) && <SelectItem value={String(current.program_id)} disabled>{current.course || "Inactive program / course"} (inactive)</SelectItem>}{programs.map((program) => <SelectItem key={program.id} value={String(program.id)}>{program.name}</SelectItem>)}</SelectContent></Select></div>
        <div><label className={labelClass} htmlFor="holding-course-code">Course code</label><Input id="holding-course-code" value={draft.course_code} disabled={!canEditHolding || saving || voiding} onChange={(event) => setField("course_code", event.target.value)} placeholder="Optional code" /></div>
        <div><label className={labelClass} htmlFor="holding-location">Location</label><Input id="holding-location" value={draft.location} disabled={!canEditHolding || saving || voiding} onChange={(event) => setField("location", event.target.value)} placeholder="Shelf or collection location" /></div>
        <div><label className={labelClass} htmlFor="holding-date">Date acquired</label><Input id="holding-date" type="date" value={draft.date_acquired} disabled={!canEditHolding || saving || voiding} onChange={(event) => setField("date_acquired", event.target.value)} /></div>
        <div><label className={labelClass} htmlFor="holding-distributor">Distributor</label><Input id="holding-distributor" value={draft.distributor} disabled={!canEditHolding || saving || voiding} onChange={(event) => setField("distributor", event.target.value)} placeholder="Optional" /></div>
        <div><label className={labelClass} htmlFor="holding-invoice">Invoice / O.R.</label><Input id="holding-invoice" value={draft.invoice_reference} disabled={!canEditHolding || saving || voiding} onChange={(event) => setField("invoice_reference", event.target.value)} placeholder="Optional reference" /></div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
        <div className="flex gap-2"><Button variant="outline" disabled={copyIndex === 0 || saving || voiding} onClick={() => void switchCopy(copyIndex - 1)}><ArrowLeft className="mr-2 h-4 w-4" />Previous</Button><Button variant="outline" disabled={copyIndex >= copies.length - 1 || saving || voiding} onClick={() => void switchCopy(copyIndex + 1)}>Next<ArrowRight className="ml-2 h-4 w-4" /></Button></div>
        {canEditHolding && <Button onClick={() => void save()} disabled={saving || voiding || !draft.accession_number.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : current.accession_number ? <Check className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}{saving ? "Saving…" : "Save holding"}</Button>}
      </div>
    </div> : null}
    </div>
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
            setVoiding(true);
            try {
              await voidCopyAccession(current.copy_id, { reason: voidReason.trim() });
              const refreshed = await fetchBookHoldings(bookId);
              const selectedIndex = refreshed.findIndex((copy) => copy.copy_id === current.copy_id);
              const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
              setCopies(refreshed);
              setCopyIndex(nextIndex);
              setDraft(refreshed[nextIndex] ? asDraft(refreshed[nextIndex]) : emptyDraft());
              setMarkSavedAfterUpdate(true);
              setVoidDialogOpen(false);
              toast.success("Accession voided permanently");
            } catch (error: unknown) { toast.error(getApiErrorMessage(error, "Failed to void accession")); }
            finally { setVoiding(false); }
          }}>{voiding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Void accession permanently</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

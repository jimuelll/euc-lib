import { useAdminUrlState } from "@/features/admin";
import { useState, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/context/AuthContext";
import type { FormField } from "./AdminCatalog.types";
import AdminCatalogData from "./AdminCatalogData";
import AdminCatalogBuilder from "./AdminCatalogBuilder";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AdminPage, AdminPanel, AdminStatCard } from "@/features/admin";
import { BookOpen, CircleAlert, CircleCheck, LoaderCircle, Sparkles } from "lucide-react";
import { backfillEmbeddings, fetchBackfillProgress, fetchCatalogSchema, fetchEmbeddingStatus, type EmbeddingBackfillProgress, type EmbeddingStatus } from "./catalog.api";
import ManualBookMetadata from "./ManualBookMetadata";

const AdminCatalog = () => {
  const { user } = useAuth();
  const [params] = useAdminUrlState();
  const requestedMode = params.get("tab");
  const mode = user?.role === "super_admin" && (requestedMode === "builder" || requestedMode === "ai") ? requestedMode : "catalog";
  const [fields, setFields]           = useState<FormField[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(true);
  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingStatus | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillDialogOpen, setBackfillDialogOpen] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<EmbeddingBackfillProgress | null>(null);
  const [backfillRevision, setBackfillRevision] = useState(0);
  const [progressUnavailable, setProgressUnavailable] = useState(false);

  useEffect(() => {
    fetchCatalogSchema()
      .then(setFields)
      .catch(() => toast.error("Failed to load form schema"))
      .finally(() => setLoadingSchema(false));
  }, []);

  const canAccessBuilder = user?.role === "super_admin";
  useEffect(() => {
    if (canAccessBuilder) void fetchEmbeddingStatus().then(setEmbeddingStatus).catch(() => setEmbeddingStatus(null));
  }, [canAccessBuilder]);
  const reportBackfillFinished = useCallback((result: EmbeddingBackfillProgress) => {
    setBackfilling(false);
    setProgressUnavailable(false);
    setBackfillRevision((revision) => revision + 1);
    void fetchEmbeddingStatus().then(setEmbeddingStatus).catch(() => setEmbeddingStatus(null));
    if (result.status === "completed") {
      toast.success(result.total === 0
        ? "No books needed an AI update."
        : `Backfill complete. ${result.embedded} AI embedding${result.embedded === 1 ? "" : "s"} ready.`);
    } else if (result.status === "completed_with_errors") {
      toast.error(`Backfill finished with ${result.failed} embedding error${result.failed === 1 ? "" : "s"}. See details in the dialog.`);
    }
  }, []);
  useEffect(() => {
    if (backfillProgress?.status !== "running") return;
    let active = true;
    let polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const next = await fetchBackfillProgress();
        if (!active) return;
        setBackfillProgress(next);
        setProgressUnavailable(false);
        if (next.status === "running") return;
        if (next.status === "completed" || next.status === "completed_with_errors") reportBackfillFinished(next);
        else {
          setBackfilling(false);
          toast.error("Backfill progress was reset. Start the operation again.");
        }
      } catch {
        if (active) setProgressUnavailable(true);
      } finally {
        polling = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [backfillProgress?.status, reportBackfillFinished]);
  const runBackfill = async () => {
    setBackfilling(true);
    setProgressUnavailable(false);
    try {
      const result = await backfillEmbeddings();
      setBackfillProgress(result);
      if (result.status === "completed" || result.status === "completed_with_errors") reportBackfillFinished(result);
      else if (result.status !== "running") {
        setBackfilling(false);
        toast.error("Backfill did not start. Check the backend and try again.");
      }
    }
    catch (error: any) { setBackfilling(false); toast.error(error.response?.data?.message || "Embedding backfill failed"); }
  };
  const completed = backfillProgress?.completed || 0;
  const total = backfillProgress?.total || 0;
  const progressPercent = total ? Math.round((completed / total) * 100) : 0;
  const isRunning = backfilling || backfillProgress?.status === "running";
  const isComplete = backfillProgress?.status === "completed";
  const hasBackfillErrors = backfillProgress?.status === "completed_with_errors";
  const noEligibleBooks = isComplete && total === 0;
  const showBackfillProgress = Boolean(isRunning || isComplete || hasBackfillErrors);
  const descriptions = {
    catalog: "Search, add, edit, archive, and restore catalogue records and their copies.",
    builder: "Configure the fields used to describe catalogue records and control which ones are public.",
    ai: "Maintain the private catalogue knowledge used for Gemini-based book recommendations.",
  } as const;
  const description = descriptions[mode];

  if (loadingSchema) {
    return <p className="mt-6 text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <AdminPage title={mode === "builder" ? "Catalog Configuration" : mode === "ai" ? "AI Recommendations" : "Catalog"} description={description} contentWidth="wide">
      {mode === "catalog" && <div className="mt-5"><AdminCatalogData fields={fields} isSuperAdmin={user?.role === "super_admin"} /></div>}
      {mode === "builder" && canAccessBuilder && <div className="mt-5"><AdminCatalogBuilder fields={fields} onFieldsChange={setFields} /></div>}
      {mode === "ai" && canAccessBuilder && <div className="mt-5 space-y-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <AdminStatCard label="Embeddings ready" value={embeddingStatus ? String(embeddingStatus.ready) : "—"} icon={<CircleCheck className="h-5 w-5" />} helperText="Books with a ready Gemini vector." />
              <AdminStatCard label="Needs attention" value={embeddingStatus ? String((embeddingStatus.missing || 0) + embeddingStatus.stale + embeddingStatus.failed) : "—"} icon={<BookOpen className="h-5 w-5" />} helperText="Books missing or needing an embedding repair." />
              <AdminStatCard label="Embedding records" value={embeddingStatus ? String(embeddingStatus.total) : "—"} icon={<Sparkles className="h-5 w-5" />} helperText="Active operational records in the recommendation store." />
            </div>
            <AdminPanel title="AI recommendation backfill" actions={<Button size="sm" disabled={backfilling} onClick={() => setBackfillDialogOpen(true)}>{backfilling ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Updating…</> : <><Sparkles className="mr-2 h-4 w-4" />Backfill AI recommendations</>}</Button>}>
              <div className="max-w-3xl space-y-3 text-sm leading-6 text-muted-foreground"><p>This processes active books that are missing useful details or a ready AI embedding. It looks up missing ISBN details, then builds or refreshes embeddings for recommendations.</p><p>Saved useful details, including details entered by staff, are reused.</p>{embeddingStatus?.errors?.length ? <p className="text-destructive">Recent embedding issue: {embeddingStatus.errors[0].message}</p> : null}</div>
            </AdminPanel>
            <ManualBookMetadata backfillRevision={backfillRevision} />
      </div>}

      <AlertDialog open={backfillDialogOpen} onOpenChange={(open) => { if (!isRunning) setBackfillDialogOpen(open); }}>
        <AlertDialogContent className="max-w-md">
          {showBackfillProgress ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  {isRunning ? <LoaderCircle className="size-5 animate-spin text-warning" /> : isComplete ? <CircleCheck className="size-5 text-success" /> : <CircleAlert className="size-5 text-destructive" />}
                  {noEligibleBooks ? "AI recommendations are up to date" : isRunning ? "Building AI recommendations" : isComplete ? "Backfill complete" : "Backfill finished with errors"}
                </AlertDialogTitle>
                <AlertDialogDescription className="leading-6">
                  {noEligibleBooks
                    ? "No active books were missing useful details or a ready AI embedding."
                    : isRunning
                      ? "Missing book details are being checked, and AI embeddings are being built for books that need them."
                      : isComplete
                        ? `Created ready AI embeddings for ${backfillProgress?.embedded || 0} book${backfillProgress?.embedded === 1 ? "" : "s"}.`
                        : `Processed ${completed} of ${total} eligible books; ${backfillProgress?.embedded || 0} embeddings are ready and ${backfillProgress?.failed || 0} could not be created.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {noEligibleBooks ? <p className="py-2 text-sm leading-6 text-muted-foreground">Saved book details and embeddings were left unchanged.</p> : isRunning && total === 0 ? <p role="status" aria-live="polite" className="py-2 text-sm text-muted-foreground">Preparing the backfill…</p> : <div className="space-y-3 py-2">
                <div className="flex items-baseline justify-between text-sm" role="status" aria-live="polite"><span className="font-medium text-foreground">{completed} / {total} books processed</span><span className="tabular-nums text-muted-foreground">{progressPercent}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="AI recommendation backfill progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed}><div className={`h-full transition-[width] duration-300 ease-out ${isComplete ? "bg-success" : hasBackfillErrors ? "bg-destructive" : "bg-warning"}`} style={{ width: `${progressPercent}%` }} /></div>
                <p className="text-xs leading-5 text-muted-foreground">{isRunning ? (backfillProgress?.currentTitle ? `Working on: ${backfillProgress.currentTitle}` : "Preparing the first book…") : isComplete ? "All eligible books were processed." : "Review the errors below, fix the reported issue, then run the backfill again."}</p>
              </div>}
              {progressUnavailable && isRunning ? <p role="status" className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm leading-5 text-warning-foreground">Progress is temporarily unavailable. The backfill may still be running; checking again automatically.</p> : null}
              {backfillProgress?.lookupFailed ? <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm leading-5 text-warning-foreground">The online details lookup failed for {backfillProgress.lookupFailed} book{backfillProgress.lookupFailed === 1 ? "" : "s"}. This is separate from the embedding results. You can add details manually to improve recommendations.</p> : null}
              {hasBackfillErrors && backfillProgress?.errors.length ? <div role="alert" className="max-h-32 space-y-2 overflow-y-auto rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm leading-5 text-destructive">
                <p className="font-medium">Embedding errors</p>
                <ul className="list-disc space-y-1 pl-5">{backfillProgress.errors.slice(0, 4).map((message, index) => <li key={`${message}-${index}`} className="break-words">{message}</li>)}</ul>
                {backfillProgress.errors.length > 4 ? <p>{backfillProgress.errors.length - 4} more error message{backfillProgress.errors.length - 4 === 1 ? "" : "s"} not shown.</p> : null}
              </div> : null}
              <AlertDialogFooter><Button disabled={Boolean(isRunning)} onClick={() => { setBackfillDialogOpen(false); setBackfillProgress(null); setProgressUnavailable(false); }}>{isRunning ? "Backfill in progress…" : "Close"}</Button></AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-warning" /> Backfill AI recommendations?</AlertDialogTitle>
                <AlertDialogDescription className="leading-6">This checks active books missing useful details or a ready AI embedding. It looks up missing ISBN details and builds embeddings for recommendations.</AlertDialogDescription>
              </AlertDialogHeader>
              <p className="rounded-md bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">Useful saved details are reused. Staff-entered details are preserved.</p>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={(event) => { event.preventDefault(); void runBackfill(); }}>Start backfill</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
};

export default AdminCatalog;

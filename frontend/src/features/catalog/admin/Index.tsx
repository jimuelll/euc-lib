import { useAdminUrlState } from "@/features/admin";
import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/context/AuthContext";
import type { FormField } from "./AdminCatalog.types";
import AdminCatalogData from "./AdminCatalogData";
import AdminCatalogBuilder from "./AdminCatalogBuilder";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AdminPage, AdminPanel, AdminStatCard } from "@/features/admin";
import { BookOpen, CircleAlert, CircleCheck, LoaderCircle, Sparkles } from "lucide-react";
import { backfillEmbeddings, fetchBackfillProgress, fetchCatalogSchema, fetchEmbeddingStatus, type EmbeddingBackfillProgress } from "./catalog.api";
import ManualBookMetadata from "./ManualBookMetadata";
import { catalogKeys } from "../catalog.keys";
import { getApiErrorMessage } from "@/utils/apiError";

const AdminCatalog = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [params] = useAdminUrlState();
  const requestedMode = params.get("tab");
  const mode = user?.role === "super_admin" && (requestedMode === "builder" || requestedMode === "ai") ? requestedMode : "catalog";
  const [fields, setFields]           = useState<FormField[]>([]);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillDialogOpen, setBackfillDialogOpen] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<EmbeddingBackfillProgress | null>(null);
  const [backfillRevision, setBackfillRevision] = useState(0);
  const schemaQuery = useQuery({ queryKey: catalogKeys.adminSchema(), queryFn: ({ signal }) => fetchCatalogSchema(signal) });
  const embeddingStatusQuery = useQuery({ queryKey: catalogKeys.embeddingStatus(), queryFn: ({ signal }) => fetchEmbeddingStatus(signal), enabled: user?.role === "super_admin" });
  const progressHandled = useRef(false);
  const progressQuery = useQuery({
    queryKey: catalogKeys.embeddingProgress(),
    queryFn: ({ signal }) => fetchBackfillProgress(signal),
    enabled: backfillProgress?.status === "running",
    refetchInterval: (query) => query.state.data?.status === "running" ? 2000 : false,
  });
  const embeddingStatus = embeddingStatusQuery.data ?? null;
  const loadingSchema = schemaQuery.isPending;
  const progressUnavailable = progressQuery.isError && (backfilling || backfillProgress?.status === "running");

  useEffect(() => {
    if (schemaQuery.data && fields.length === 0) setFields(schemaQuery.data);
  }, [fields.length, schemaQuery.data]);

  const canAccessBuilder = user?.role === "super_admin";
  const reportBackfillFinished = useCallback((result: EmbeddingBackfillProgress) => {
    setBackfilling(false);
    setBackfillRevision((revision) => revision + 1);
    void queryClient.invalidateQueries({ queryKey: catalogKeys.embeddings() });
    if (result.status === "paused_rate_limited") {
      const retry = result.rateLimitRetryAt ? ` Try again after ${new Date(result.rateLimitRetryAt).toLocaleTimeString()}.` : " Try again in a few minutes.";
      toast.warning(`Google Books rate limited the backfill after ${result.completed} of ${result.total} books; ${result.deferred} deferred, ${result.lookupFailed} lookup failure${result.lookupFailed === 1 ? "" : "s"}, and ${result.failed} embedding failure${result.failed === 1 ? "" : "s"}.${retry}`);
    } else if (result.status === "completed_with_errors") {
      toast.error(`Backfill finished with ${result.lookupFailed} lookup failure${result.lookupFailed === 1 ? "" : "s"} and ${result.failed} embedding failure${result.failed === 1 ? "" : "s"}. See details in the dialog.`);
    } else if (result.status === "completed") {
      if (result.total === 0 && result.missingSynopses > 0) {
        toast.warning(`No automatic backfill work available. ${result.missingSynopses} book${result.missingSynopses === 1 ? " still needs" : "s still need"} a synopsis from staff.`);
      } else if (result.total === 0) {
        toast.success("No books needed an AI update.");
      } else {
        toast.success(`Backfill complete: ${result.synopsesAdded} synopsis${result.synopsesAdded === 1 ? "" : "es"} added, ${result.synopsesNotFound} checked with no description, and embeddings ready for ${result.embedded} books.`);
      }
    }
  }, [queryClient]);
  useEffect(() => {
    const next = progressQuery.data;
    if (!next) return;
    if (next.status !== "running" && progressHandled.current) return;
    setBackfillProgress(next);
    if (next.status === "running") return;
    if (next.status === "completed" || next.status === "completed_with_errors" || next.status === "paused_rate_limited") {
      if (progressHandled.current) return;
      progressHandled.current = true;
      reportBackfillFinished(next);
    } else {
      setBackfilling(false);
      toast.error("Backfill progress was reset. Start the operation again.");
    }
  }, [progressQuery.data, reportBackfillFinished]);
  const backfillMutation = useMutation({
    mutationFn: backfillEmbeddings,
    onMutate: async () => {
      progressHandled.current = false;
      await queryClient.removeQueries({ queryKey: catalogKeys.embeddingProgress(), exact: true });
    },
  });
  const runBackfill = async () => {
    setBackfilling(true);
    setBackfillProgress(null);
    try {
      const result = await backfillMutation.mutateAsync();
      setBackfillProgress(result);
      if (result.status !== "idle") queryClient.setQueryData(catalogKeys.embeddingProgress(), result);
      if (result.status === "completed" || result.status === "completed_with_errors" || result.status === "paused_rate_limited") {
        if (!progressHandled.current) { progressHandled.current = true; reportBackfillFinished(result); }
      }
      else if (result.status !== "running") {
        setBackfilling(false);
        toast.error("Backfill did not start. Check the backend and try again.");
      }
    }
    catch (error: unknown) { setBackfilling(false); toast.error(getApiErrorMessage(error, "Embedding backfill failed")); }
  };
  const completed = backfillProgress?.completed || 0;
  const total = backfillProgress?.total || 0;
  const progressPercent = total ? Math.round((completed / total) * 100) : 0;
  const isRunning = backfilling || backfillProgress?.status === "running";
  const isComplete = backfillProgress?.status === "completed";
  const hasBackfillErrors = backfillProgress?.status === "completed_with_errors";
  const isRateLimited = backfillProgress?.status === "paused_rate_limited";
  const noEligibleBooks = isComplete && total === 0;
  const noAutomaticWorkNeedsStaff = noEligibleBooks && (backfillProgress?.missingSynopses || 0) > 0;
  const showBackfillProgress = Boolean(isRunning || isComplete || hasBackfillErrors || isRateLimited);
  const descriptions = {
    catalog: "Search, add, edit, archive, and restore catalogue records and their copies.",
    builder: "Configure the fields used to describe catalogue records and control which ones are public.",
    ai: "Maintain the private catalogue knowledge used for Gemini-based book recommendations.",
  } as const;
  const description = descriptions[mode];

  if (loadingSchema) {
    return <p className="mt-6 text-sm text-muted-foreground">Loading...</p>;
  }
  if (schemaQuery.isError) {
    return <div role="alert" className="mt-6 flex items-center gap-3 text-sm text-destructive">{getApiErrorMessage(schemaQuery.error, "Failed to load form schema")}<Button type="button" variant="outline" size="sm" onClick={() => void schemaQuery.refetch()}>Try again</Button></div>;
  }

  return (
    <AdminPage title={mode === "builder" ? "Catalog Configuration" : mode === "ai" ? "AI Recommendations" : "Catalog"} description={description} contentWidth="wide">
      {mode === "catalog" && <div className="mt-5"><AdminCatalogData fields={fields} isSuperAdmin={user?.role === "super_admin"} /></div>}
      {mode === "builder" && canAccessBuilder && <div className="mt-5"><AdminCatalogBuilder fields={fields} onFieldsChange={setFields} /></div>}
      {mode === "ai" && canAccessBuilder && <div className="mt-5 space-y-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <AdminStatCard label="Embedding ready" value={embeddingStatus ? String(embeddingStatus.ready) : "—"} icon={<CircleCheck className="h-5 w-5" />} helperText="Books with a current Gemini vector." />
              <AdminStatCard label="Needs attention" value={embeddingStatus ? String(embeddingStatus.needsAttention) : "—"} icon={<BookOpen className="h-5 w-5" />} helperText="Distinct books missing a synopsis, useful details, or a ready embedding." />
              <AdminStatCard label="Missing synopses" value={embeddingStatus ? String(embeddingStatus.missingSynopses) : "—"} icon={<CircleAlert className="h-5 w-5" />} helperText="Blank AI summaries, including books that need staff input." />
            </div>
            <AdminPanel title="AI recommendation backfill" actions={<Button size="sm" disabled={backfilling} onClick={() => setBackfillDialogOpen(true)}>{backfilling ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Updating…</> : <><Sparkles className="mr-2 h-4 w-4" />Backfill AI recommendations</>}</Button>}>
              <div className="max-w-3xl space-y-3 text-sm leading-6 text-muted-foreground"><p>This processes active books that are missing useful details, a ready AI embedding, or an online synopsis check. A ready embedding does not mean a synopsis is present. Synopses are checked from Open Library first, then Google Books, then Hardcover when configured; other metadata lookups may run concurrently. Embeddings are reused when their source text and model are current.</p><p>Saved useful details, including details entered by staff, are reused. Blank synopses remain in Needs attention for staff review even when no automatic lookup is available.</p>{embeddingStatus?.errors?.length ? <p className="text-destructive">Recent embedding issue: {embeddingStatus.errors[0].message}</p> : null}</div>
            </AdminPanel>
            <ManualBookMetadata backfillRevision={backfillRevision} />
      </div>}

      <AlertDialog open={backfillDialogOpen} onOpenChange={(open) => { if (!isRunning) setBackfillDialogOpen(open); }}>
        <AlertDialogContent className="max-w-md">
          {showBackfillProgress ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  {isRunning ? <LoaderCircle className="size-5 animate-spin text-warning" /> : isComplete ? <CircleCheck className="size-5 text-success" /> : <CircleAlert className="size-5 text-warning" />}
                  {noAutomaticWorkNeedsStaff ? "No automatic backfill work available" : noEligibleBooks ? "AI recommendations are up to date" : isRunning ? "Building AI recommendations" : isRateLimited ? "Paused because Google Books is rate limiting" : isComplete ? "Backfill complete" : "Backfill finished with errors"}
                </AlertDialogTitle>
                <AlertDialogDescription className="leading-6">
                  {noEligibleBooks
                    ? noAutomaticWorkNeedsStaff
                      ? `${backfillProgress?.missingSynopses} active book${backfillProgress?.missingSynopses === 1 ? " has" : "s have"} a blank synopsis and ${backfillProgress?.missingSynopses === 1 ? "needs" : "need"} staff input in AI Recommendations.`
                      : "No active books needed updated details, a synopsis check, or an embedding update."
                    : isRunning
                      ? "Eligible ISBN synopses are being checked; embeddings are refreshed only when needed."
                      : isRateLimited
                        ? `Processed ${completed} of ${total} books; ${backfillProgress?.deferred || 0} deferred, ${backfillProgress?.lookupFailed || 0} lookup failures, and ${backfillProgress?.failed || 0} embedding failures. Wait before retrying Google Books${backfillProgress?.rateLimitRetryAt ? ` (after ${new Date(backfillProgress.rateLimitRetryAt).toLocaleTimeString()})` : ""}.`
                      : isComplete
                        ? `Added synopses to ${backfillProgress?.synopsesAdded || 0} book${backfillProgress?.synopsesAdded === 1 ? "" : "s"}; online sources returned no description for ${backfillProgress?.synopsesNotFound || 0} book${backfillProgress?.synopsesNotFound === 1 ? "" : "s"}; embeddings are ready for ${backfillProgress?.embedded || 0}.`
                        : `Processed ${completed} of ${total} eligible books; added ${backfillProgress?.synopsesAdded || 0} synopses, found no description for ${backfillProgress?.synopsesNotFound || 0}, and had ${backfillProgress?.lookupFailed || 0} lookup and ${backfillProgress?.failed || 0} embedding failures.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {noEligibleBooks ? <p className="py-2 text-sm leading-6 text-muted-foreground">{noAutomaticWorkNeedsStaff ? "Add or review synopses in the AI Recommendations book details list. Other saved book details and embeddings were left unchanged." : "Saved book details and embeddings were left unchanged."}</p> : isRunning && total === 0 ? <p role="status" aria-live="polite" className="py-2 text-sm text-muted-foreground">Preparing the backfill…</p> : <div className="space-y-3 py-2">
                <div className="flex items-baseline justify-between text-sm" role="status" aria-live="polite"><span className="font-medium text-foreground">{completed} / {total} books processed</span><span className="tabular-nums text-muted-foreground">{progressPercent}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="AI recommendation backfill progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed}><div className={`h-full transition-[width] duration-300 ease-out ${isComplete ? "bg-success" : hasBackfillErrors ? "bg-destructive" : "bg-warning"}`} style={{ width: `${progressPercent}%` }} /></div>
                <p className="text-xs leading-5 text-muted-foreground">{isRunning ? (backfillProgress?.currentTitle ? `Working on: ${backfillProgress.currentTitle}` : "Preparing the first book…") : isRateLimited ? "The remaining books were not changed and are eligible for a later run." : isComplete ? "All eligible books were processed." : "Review the errors below, fix the reported issue, then run the backfill again."}</p>
              </div>}
              {progressUnavailable && isRunning ? <p role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm leading-5 text-foreground">Progress is temporarily unavailable. The backfill may still be running; checking again automatically.</p> : null}
              {backfillProgress?.lookupFailed ? <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm leading-5 text-foreground">
                <p>Provider lookups failed for {backfillProgress.lookupFailed} book{backfillProgress.lookupFailed === 1 ? "" : "s"}. This is separate from embedding failures. You can retry Backfill or add details manually.</p>
                {!isRunning && backfillProgress.lookupErrors?.length ? <div className="mt-2 border-t border-warning/30 pt-2"><p className="font-medium">Lookup details and synopsis source path</p><ul className="mt-1 list-disc space-y-1 pl-5">{backfillProgress.lookupErrors.map((message) => <li key={message} className="break-words">{message}</li>)}</ul></div> : null}
              </div> : null}
              {backfillProgress?.failed && backfillProgress.errors.length ? <div role="alert" className="max-h-32 space-y-2 overflow-y-auto rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm leading-5 text-destructive">
                <p className="font-medium">Embedding errors</p>
                <ul className="list-disc space-y-1 pl-5">{backfillProgress.errors.slice(0, 4).map((message, index) => <li key={`${message}-${index}`} className="break-words">{message}</li>)}</ul>
                {backfillProgress.errors.length > 4 ? <p>{backfillProgress.errors.length - 4} more error message{backfillProgress.errors.length - 4 === 1 ? "" : "s"} not shown.</p> : null}
              </div> : null}
              <AlertDialogFooter><Button disabled={Boolean(isRunning)} onClick={() => { setBackfillDialogOpen(false); setBackfillProgress(null); }}>{isRunning ? "Backfill in progress…" : "Close"}</Button></AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-warning" /> Backfill AI recommendations?</AlertDialogTitle>
                <AlertDialogDescription className="leading-6">This checks active books missing useful details, a ready AI embedding, or an online synopsis check. Synopsis sources run Open Library first, then Google Books, then Hardcover when configured. It updates embeddings only when needed.</AlertDialogDescription>
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

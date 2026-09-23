import { useAdminUrlState } from "@/features/admin";
import { useState, useEffect } from "react";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/context/AuthContext";
import type { FormField } from "./AdminCatalog.types";
import AdminCatalogData from "./AdminCatalogData";
import AdminCatalogBuilder from "./AdminCatalogBuilder";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AdminPage, AdminPanel, AdminStatCard } from "@/features/admin";
import { BookOpen, CircleCheck, LoaderCircle, Sparkles } from "lucide-react";
import { backfillEmbeddings, fetchBackfillProgress, fetchCatalogSchema, fetchEmbeddingStatus, type EmbeddingBackfillProgress, type EmbeddingStatus } from "./catalog.api";

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
  useEffect(() => {
    if (backfillProgress?.status !== "running") return;
    const poll = async () => {
      try {
        const next = await fetchBackfillProgress();
        setBackfillProgress(next);
        if (next.status === "running") return;
        setBackfilling(false);
        void fetchEmbeddingStatus().then(setEmbeddingStatus).catch(() => setEmbeddingStatus(null));
        if (next.status === "completed") toast.success(`Enriched and embedded ${next.embedded} book${next.embedded === 1 ? "" : "s"}.`);
        else if (next.status === "completed_with_errors") toast.error(`Finished ${next.completed} books with ${next.failed} error${next.failed === 1 ? "" : "s"}.`);
        else toast.error("Backfill stopped. Restart the operation after checking the backend.");
      } catch (error: any) {
        setBackfilling(false);
        toast.error(error.response?.data?.message || "Could not read embedding progress");
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 900);
    return () => window.clearInterval(timer);
  }, [backfillProgress?.status]);
  const runBackfill = async () => {
    setBackfilling(true);
    try {
      const result = await backfillEmbeddings();
      setBackfillProgress(result);
      if (result.status !== "running") setBackfilling(false);
    }
    catch (error: any) { setBackfilling(false); toast.error(error.response?.data?.message || "Embedding backfill failed"); }
  };
  const completed = backfillProgress?.completed || 0;
  const total = backfillProgress?.total || 0;
  const progressPercent = total ? Math.round((completed / total) * 100) : 0;
  const noEligibleBooks = backfillProgress?.status === "completed" && total === 0;
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
      {mode === "catalog" && <div className="mt-5"><AdminCatalogData fields={fields} /></div>}
      {mode === "builder" && canAccessBuilder && <div className="mt-5"><AdminCatalogBuilder fields={fields} onFieldsChange={setFields} /></div>}
      {mode === "ai" && canAccessBuilder && <div className="mt-5 space-y-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <AdminStatCard label="Embeddings ready" value={embeddingStatus ? String(embeddingStatus.ready) : "—"} icon={<CircleCheck className="h-5 w-5" />} helperText="Books with a ready Gemini vector." />
              <AdminStatCard label="Needs attention" value={embeddingStatus ? String(embeddingStatus.stale + embeddingStatus.failed) : "—"} icon={<BookOpen className="h-5 w-5" />} helperText="Stale or failed embedding records." />
              <AdminStatCard label="Embedding records" value={embeddingStatus ? String(embeddingStatus.total) : "—"} icon={<Sparkles className="h-5 w-5" />} helperText="Active operational records in the recommendation store." />
            </div>
            <AdminPanel title="Private metadata backfill" actions={<Button size="sm" disabled={backfilling} onClick={() => setBackfillDialogOpen(true)}>{backfilling ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Embedding…</> : <><Sparkles className="mr-2 h-4 w-4" />Backfill missing metadata</>}</Button>}>
              <div className="max-w-3xl space-y-3 text-sm leading-6 text-muted-foreground"><p>Use this only when books are missing private ISBN enrichment, or when a previous lookup failed. It retrieves server-only catalogue detail from Open Library and Google Books, then recreates the corresponding Gemini embedding.</p><p>Books with ready enrichment are skipped, so a repeat run does not overwrite existing private metadata or call Gemini unnecessarily.</p>{embeddingStatus?.errors?.length ? <p className="text-destructive">Recent embedding issue: {embeddingStatus.errors[0].message}</p> : null}</div>
            </AdminPanel>
      </div>}

      <AlertDialog open={backfillDialogOpen} onOpenChange={(open) => { if (!backfilling) setBackfillDialogOpen(open); }}>
        <AlertDialogContent className="max-w-md">
          {backfilling || backfillProgress?.status === "running" || backfillProgress?.status === "completed" || backfillProgress?.status === "completed_with_errors" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">{noEligibleBooks ? <CircleCheck className="size-5 text-success" /> : <LoaderCircle className={backfilling ? "size-5 animate-spin text-warning" : "size-5 text-warning"} />} {noEligibleBooks ? "AI book knowledge is up to date" : "Refreshing AI book knowledge"}</AlertDialogTitle>
                <AlertDialogDescription className="leading-6">
                  {backfilling ? "Private catalogue metadata is being retrieved before Gemini rebuilds each affected embedding." : noEligibleBooks ? "Every active book already has ready private enrichment metadata." : backfillProgress?.status === "completed" ? "The eligible books have been enriched and embedded." : "The batch finished, but some books could not be embedded."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {noEligibleBooks ? <p className="py-2 text-sm leading-6 text-muted-foreground">No ISBN lookups or Gemini calls were made. Existing private metadata and embeddings were left untouched.</p> : <div className="space-y-3 py-2">
                  <div className="flex items-baseline justify-between text-sm"><span className="font-medium text-foreground">{completed} / {total} books processed</span><span className="tabular-nums text-muted-foreground">{progressPercent}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Embedding backfill progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed}><div className="h-full bg-warning transition-[width] duration-300 ease-out" style={{ width: `${progressPercent}%` }} /></div>
                  <p className="min-h-5 truncate text-xs text-muted-foreground">{backfilling && backfillProgress?.currentTitle ? `Working on: ${backfillProgress.currentTitle}` : backfillProgress?.failed ? `${backfillProgress.failed} book${backfillProgress.failed === 1 ? "" : "s"} need attention.` : "Ready metadata was left unchanged."}</p>
                </div>}
              <AlertDialogFooter><Button onClick={() => { setBackfillDialogOpen(false); setBackfillProgress(null); }}>Done</Button></AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-warning" /> Backfill missing AI metadata?</AlertDialogTitle>
                <AlertDialogDescription className="leading-6">This checks active books that do not yet have usable private enrichment metadata. It fetches ISBN details from Open Library and Google Books, keeps them server-only, then rebuilds that book’s Gemini embedding.</AlertDialogDescription>
              </AlertDialogHeader>
              <p className="rounded-md bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">Books that already have ready private metadata are skipped; their enrichment and embeddings are not overwritten.</p>
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

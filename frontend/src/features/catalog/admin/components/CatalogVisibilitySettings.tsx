import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Eye, EyeOff } from "lucide-react";
import { AdminPanel } from "@/features/admin";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { fetchCatalogSettings, saveCatalogSettings } from "../catalog.api";
import { catalogKeys } from "../../catalog.keys";
import { getApiErrorMessage } from "@/utils/apiError";
import { invalidateServerState } from "@/app/server-state";

export default function CatalogVisibilitySettings() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: catalogKeys.settings(), queryFn: ({ signal }) => fetchCatalogSettings(signal) });
  const updateMutation = useMutation({
    mutationFn: saveCatalogSettings,
    onMutate: async (showUnheld) => {
      await queryClient.cancelQueries({ queryKey: catalogKeys.settings() });
      const previous = queryClient.getQueryData(catalogKeys.settings());
      queryClient.setQueryData(catalogKeys.settings(), { ...settingsQuery.data, show_unheld_in_opac: showUnheld });
      return { previous };
    },
    onError: (error, _showUnheld, context) => {
      if (context?.previous) queryClient.setQueryData(catalogKeys.settings(), context.previous);
      toast.error(getApiErrorMessage(error, "Failed to update catalog visibility"));
    },
    onSuccess: async (settings) => { queryClient.setQueryData(catalogKeys.settings(), settings); toast.success("Catalog visibility updated"); await invalidateServerState(queryClient, "catalog"); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: catalogKeys.settings() }),
  });
  const showUnheld = settingsQuery.data?.show_unheld_in_opac ?? true;
  const loading = settingsQuery.isPending;
  const saving = updateMutation.isPending;

  return <AdminPanel title="OPAC availability">
    {settingsQuery.isError ? <div role="alert" className="mb-3 flex items-center justify-between gap-3 text-sm text-destructive">{getApiErrorMessage(settingsQuery.error, "Failed to load catalog visibility settings")}<button type="button" className="underline" onClick={() => void settingsQuery.refetch()}>Try again</button></div> : null}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-foreground">Show books without accessioned copies in the public catalog</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">When shown, these books are labeled Unavailable and cannot be borrowed or reserved. Existing physical copies become eligible after a holding with an accession number is saved.</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {loading || saving ? <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" aria-label={saving ? "Saving setting" : "Loading setting"} /> : showUnheld ? <Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        <Switch aria-label="Show books without accessioned copies in the public catalog" checked={showUnheld} disabled={loading || saving || settingsQuery.isError} onCheckedChange={(checked) => updateMutation.mutate(checked)} />
      </div>
    </div>
  </AdminPanel>;
}

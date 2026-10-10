import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import {Link} from 'react-router-dom';
import {useAdminConfirmDialog} from '@/features/admin';
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { fetchCatalogSettings, saveCatalogSettings } from "../catalog.api";
import { catalogKeys } from "../../catalog.keys";
import { getApiErrorMessage } from "@/utils/apiError";
import { invalidateServerState } from "@/app/server-state";

export default function CatalogVisibilitySettings({unheldBooks}:{unheldBooks?:number}) {
  const queryClient = useQueryClient();
  const {confirm,confirmDialog}=useAdminConfirmDialog();
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
    onSuccess: async (settings,_value,context) => { queryClient.setQueryData(catalogKeys.settings(), settings); const previous=context?.previous as typeof settings|undefined;toast.success("Public catalog availability saved",previous?{action:{label:'Undo',onClick:()=>updateMutation.mutate(previous.show_unheld_in_opac)}}:undefined); await invalidateServerState(queryClient, "catalog"); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: catalogKeys.settings() }),
  });
  const showUnheld = settingsQuery.data?.show_unheld_in_opac ?? true;
  const loading = settingsQuery.isPending;
  const saving = updateMutation.isPending;

  return <section className="config-availability" aria-labelledby="availability-title">
    {settingsQuery.isError ? <div role="alert" className="mb-3 flex items-center justify-between gap-3 text-sm text-destructive">{getApiErrorMessage(settingsQuery.error, "Failed to load catalog visibility settings")}<button type="button" className="underline" onClick={() => void settingsQuery.refetch()}>Try again</button></div> : null}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-2xl">
        <h2 id="availability-title" className="text-sm font-semibold text-foreground">Public catalog availability</h2>
        <p className="mt-1 text-sm text-foreground">Include books without accessioned copies.</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{unheldBooks===undefined||loading?'Checking the number of affected books…':<><Link className="config-link config-availability-link" to="/admin/catalog?tab=records&unheld=1&material=book&status=active">{unheldBooks} {unheldBooks===1?'book':'books'}</Link> {showUnheld?'are listed as Unavailable.':'are hidden from Public catalog.'}</>} They need eligible accessioned copies before borrowing or reservation.</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {loading || saving ? <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" aria-label={saving ? "Saving setting" : "Loading setting"} /> : null}
        <Switch className="config-availability-switch" aria-label="Include books without accessioned copies in Public catalog" checked={showUnheld} disabled={loading || saving || settingsQuery.isError || unheldBooks===undefined} onCheckedChange={async checked => {if(!await confirm({title:checked?'Include books without accessioned copies?':'Hide books without accessioned copies?',description:`${unheldBooks} ${unheldBooks===1?'book':'books'} will ${checked?'be listed as Unavailable':'be hidden'} in Public catalog. Existing records and loans stay unchanged. You can undo this change.`,actionLabel:checked?'Include books':'Hide books'}))return;updateMutation.mutate(checked);}} /><span className="text-sm font-medium">{loading?'Loading':showUnheld?'On':'Off'}</span>
      </div>
    </div>
  {confirmDialog}</section>;
}

import { useEffect, useState } from "react";
import { LoaderCircle, Eye, EyeOff } from "lucide-react";
import { AdminPanel } from "@/features/admin";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { fetchCatalogSettings, saveCatalogSettings } from "../catalog.api";

export default function CatalogVisibilitySettings() {
  const [showUnheld, setShowUnheld] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCatalogSettings()
      .then((settings) => setShowUnheld(settings.show_unheld_in_opac))
      .catch(() => toast.error("Failed to load catalog visibility settings"))
      .finally(() => setLoading(false));
  }, []);

  const update = async (checked: boolean) => {
    setSaving(true);
    try {
      const settings = await saveCatalogSettings(checked);
      setShowUnheld(settings.show_unheld_in_opac);
      toast.success("Catalog visibility updated");
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? "Failed to update catalog visibility");
    } finally { setSaving(false); }
  };

  return <AdminPanel title="OPAC availability">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-foreground">Show books without accessioned copies in the public catalog</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">When shown, these books are labeled Unavailable and cannot be borrowed or reserved. Existing physical copies become eligible after a holding with an accession number is saved.</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {loading || saving ? <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" aria-label={saving ? "Saving setting" : "Loading setting"} /> : showUnheld ? <Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        <Switch aria-label="Show books without accessioned copies in the public catalog" checked={showUnheld} disabled={loading || saving} onCheckedChange={(checked) => void update(checked)} />
      </div>
    </div>
  </AdminPanel>;
}

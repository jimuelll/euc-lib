import { useEffect, useRef, useState } from "react";
import { ArchiveRestore, DatabaseBackup, Download, FileDown, Loader2, ShieldAlert, Upload } from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminPage, AdminPanel } from "./components/AdminPage";

const MAX_BACKUP_SIZE = 25 * 1024 * 1024;

type Snapshot = {
  id: number;
  filename: string;
  sizeBytes: number;
  kind: "manual" | "pre_restore";
  createdAt: string;
  createdBy: string | null;
};

function filenameFromHeader(header?: string) {
  return header?.match(/filename=\"?([^\";]+)\"?/)?.[1] ?? `euc-library-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

const AdminBackup = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);
  const [snapshotToRestore, setSnapshotToRestore] = useState<Snapshot | null>(null);
  const [lastBackup, setLastBackup] = useState<{ name: string; size: number; createdAt: string } | null>(null);

  const loadSnapshots = async () => {
    setLoadingSnapshots(true);
    try {
      const { data } = await axiosInstance.get("/api/admin/backup/snapshots");
      setSnapshots(data.snapshots ?? []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not load saved snapshots.");
    } finally {
      setLoadingSnapshots(false);
    }
  };

  useEffect(() => { void loadSnapshots(); }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await axiosInstance.get("/api/admin/backup/export", { responseType: "blob" });
      const name = filenameFromHeader(response.headers["content-disposition"]);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setLastBackup({ name, size: response.data.size, createdAt: new Date().toLocaleString() });
      toast.success("Database backup downloaded.");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not create the backup.");
    } finally {
      setExporting(false);
    }
  };

  const handleCreateSnapshot = async () => {
    setSavingSnapshot(true);
    try {
      await axiosInstance.post("/api/admin/backup/snapshots");
      toast.success("Snapshot saved securely.");
      await loadSnapshots();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not save the snapshot.");
    } finally {
      setSavingSnapshot(false);
    }
  };

  const handleDownloadSnapshot = async (snapshot: Snapshot) => {
    try {
      const response = await axiosInstance.get(`/api/admin/backup/snapshots/${snapshot.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromHeader(response.headers["content-disposition"]);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not download the snapshot.");
    }
  };

  const handleRestoreSnapshot = async () => {
    if (!snapshotToRestore) return;
    setRestoring(true);
    try {
      await axiosInstance.post(`/api/admin/backup/snapshots/${snapshotToRestore.id}/restore`);
      toast.success("Snapshot restored. A pre-restore recovery point was saved.");
      setSnapshotToRestore(null);
      await loadSnapshots();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not restore the snapshot.");
    } finally {
      setRestoring(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_BACKUP_SIZE) {
      toast.error("The backup file must be 25 MB or smaller.");
      return;
    }
    if (!window.confirm("Restore this backup? It will replace all current library data and cannot be undone.")) return;

    setRestoring(true);
    try {
      const contents = await file.text();
      const backup = JSON.parse(contents);
      await axiosInstance.post("/api/admin/backup/restore", backup);
      toast.success("Database restored successfully. Please refresh the page to load restored data.");
    } catch (error: any) {
      const message = error instanceof SyntaxError
        ? "The selected file is not valid JSON."
        : error.response?.data?.message || "Could not restore the backup.";
      toast.error(message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <AdminPage
      eyebrow="System"
      title="Backup"
      description="Save secure recovery points, download a portable copy, or restore the complete library database to a previous point in time."
      contentWidth="wide"
    >
      <AdminPanel
        title="Create a recovery point"
        description="Saved snapshots are retained in secure cloud storage. The latest 30 are kept automatically."
        actions={
          <>
            <Button type="button" onClick={handleCreateSnapshot} disabled={exporting || savingSnapshot || restoring}>
              {savingSnapshot ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseBackup className="mr-2 h-4 w-4" />}
              {savingSnapshot ? "Saving snapshot..." : "Save Snapshot"}
            </Button>
            <Button type="button" variant="outline" onClick={handleExport} disabled={exporting || savingSnapshot || restoring}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseBackup className="mr-2 h-4 w-4" />}
              {exporting ? "Creating download..." : "Download Backup"}
            </Button>
            <Button type="button" variant="outline" disabled={exporting || savingSnapshot || restoring} asChild>
              <label htmlFor="restore-input" className="cursor-pointer">
                {restoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {restoring ? "Restoring..." : "Restore"}
                <input ref={inputRef} id="restore-input" type="file" className="hidden" accept="application/json,.json" onChange={handleRestore} />
              </label>
            </Button>
          </>
        }
      >
        <Label htmlFor="restore-input" className="sr-only">Restore from backup file</Label>
        <p className="text-sm leading-6 text-muted-foreground">
          Every snapshot includes all database records and the catalog's custom-field layout. Only restore a downloaded file made by this system.
        </p>
      </AdminPanel>

      <AdminPanel
        title="Saved snapshots"
        description="Choose a point in time to download or restore. Restoring first saves the current state as a recovery point."
        className="max-w-4xl"
      >
        {loadingSnapshots ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading saved snapshots...</div>
        ) : snapshots.length ? (
          <div className="divide-y divide-border/70 border-y border-border/70">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{new Date(snapshot.createdAt).toLocaleString()}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {(snapshot.sizeBytes / 1024).toFixed(1)} KB · {snapshot.kind === "pre_restore" ? "Automatic pre-restore point" : "Manual snapshot"}
                    {snapshot.createdBy ? ` · Saved by ${snapshot.createdBy}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void handleDownloadSnapshot(snapshot)} disabled={restoring}>
                    <FileDown className="mr-2 h-3.5 w-3.5" /> Download
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setSnapshotToRestore(snapshot)} disabled={restoring}>
                    <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> Restore
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">No saved snapshots yet. Save one before any major catalog or account changes.</p>
        )}
      </AdminPanel>

      <AdminPanel
        title="Latest export"
        description="The browser saves each backup directly to your downloads folder."
        className="max-w-4xl"
      >
        {lastBackup ? (
          <div className="flex flex-col gap-3 rounded-md border border-border/70 bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{lastBackup.name}</p>
              <p className="text-xs leading-5 text-muted-foreground">
                {(lastBackup.size / 1024).toFixed(1)} KB • {lastBackup.createdAt}
              </p>
            </div>
            <Download className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No backup has been exported in this session.</p>
        )}
      </AdminPanel>

      <AlertDialog open={Boolean(snapshotToRestore)} onOpenChange={(open) => !open && !restoring && setSnapshotToRestore(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive"><ShieldAlert className="h-5 w-5" /></div>
            <AlertDialogTitle>Restore this snapshot?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              This will replace all current library records with the state from {snapshotToRestore ? new Date(snapshotToRestore.createdAt).toLocaleString() : "this snapshot"}. The current state will be saved automatically first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={restoring} onClick={(event) => { event.preventDefault(); void handleRestoreSnapshot(); }}>
              {restoring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Restore snapshot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
};

export default AdminBackup;

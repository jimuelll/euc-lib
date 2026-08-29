import { useRef, useState } from "react";
import { DatabaseBackup, Download, Loader2, Upload } from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AdminPage, AdminPanel } from "./components/AdminPage";

const MAX_BACKUP_SIZE = 25 * 1024 * 1024;

function filenameFromHeader(header?: string) {
  return header?.match(/filename=\"?([^\";]+)\"?/)?.[1] ?? `euc-library-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

const AdminBackup = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState<{ name: string; size: number; createdAt: string } | null>(null);

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
      description="Export a complete portable copy of the database or restore a previously downloaded library backup."
      contentWidth="wide"
    >
      <AdminPanel
        title="Backup actions"
        description="Backups include all current database records. Restoring replaces the entire current database."
        actions={
          <>
            <Button type="button" onClick={handleExport} disabled={exporting || restoring}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseBackup className="mr-2 h-4 w-4" />}
              {exporting ? "Creating backup..." : "Create Backup"}
            </Button>
            <Button type="button" variant="outline" disabled={exporting || restoring} asChild>
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
          Only restore backup files created by this system with the same database structure. Restore is protected by a confirmation prompt.
        </p>
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
    </AdminPage>
  );
};

export default AdminBackup;

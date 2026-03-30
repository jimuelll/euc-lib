import { DatabaseBackup, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AdminPage, AdminPanel } from "./components/AdminPage";

const backups = [
  { name: "backup_2026-03-10.sql", size: "12.4 MB", date: "Mar 10, 2026" },
  { name: "backup_2026-03-03.sql", size: "12.1 MB", date: "Mar 3, 2026" },
  { name: "backup_2026-02-24.sql", size: "11.8 MB", date: "Feb 24, 2026" },
];

const AdminBackup = () => (
  <AdminPage
    eyebrow="System"
    title="Backup"
    description="Keep backup actions and restore history in one readable workspace so staff can confirm what was saved and when."
    contentWidth="wide"
  >
    <AdminPanel
      title="Backup actions"
      description="Create a fresh backup or restore a database file from a previously exported copy."
      actions={
        <>
          <Button>
            <DatabaseBackup className="mr-2 h-4 w-4" />
            Create Backup
          </Button>
          <Button variant="outline" asChild>
            <label htmlFor="restore-input" className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              Restore
              <input id="restore-input" type="file" className="hidden" accept=".sql,.bak" />
            </label>
          </Button>
        </>
      }
    >
      <Label htmlFor="restore-input" className="sr-only">
        Restore from file
      </Label>
      <p className="text-sm leading-6 text-muted-foreground">
        Use restore only when a confirmed backup needs to replace the current data state.
      </p>
    </AdminPanel>

    <AdminPanel
      title="Recent backups"
      description="Most recent exports are listed first for quick download and verification."
      className="max-w-4xl"
    >
      <div className="space-y-3">
        {backups.map((backup) => (
          <div
            key={backup.name}
            className="flex flex-col gap-3 rounded-md border border-border/70 bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{backup.name}</p>
              <p className="text-xs leading-5 text-muted-foreground">
                {backup.size} • {backup.date}
              </p>
            </div>

            <Button size="sm" variant="outline" className="self-start sm:self-center">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        ))}
      </div>
    </AdminPanel>
  </AdminPage>
);

export default AdminBackup;

import { Button } from "@/components/ui/button";
import { DatabaseBackup, Download, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const backups = [
  { name: "backup_2026-03-10.sql", size: "12.4 MB", date: "Mar 10, 2026" },
  { name: "backup_2026-03-03.sql", size: "12.1 MB", date: "Mar 3, 2026" },
  { name: "backup_2026-02-24.sql", size: "11.8 MB", date: "Feb 24, 2026" },
];

const AdminBackup = () => (
  <div className="max-w-2xl">
    <h2 className="font-heading text-lg font-bold text-foreground">Backup</h2>
    <p className="mt-1 text-sm text-muted-foreground">Manage database backups.</p>

    <div className="mt-6 flex gap-3">
      <Button>
        <DatabaseBackup className="mr-2 h-4 w-4" />
        Create Backup
      </Button>
      <div>
        <Label htmlFor="restore" className="sr-only">Restore from file</Label>
        <Button variant="outline" asChild>
          <label htmlFor="restore-input" className="cursor-pointer">
            <Upload className="mr-2 h-4 w-4" />
            Restore
            <input id="restore-input" type="file" className="hidden" accept=".sql,.bak" />
          </label>
        </Button>
      </div>
    </div>

    <div className="mt-6 space-y-3">
      {backups.map((b) => (
        <div key={b.name} className="flex items-center justify-between rounded-lg border bg-card p-4">
          <div>
            <p className="text-sm font-medium text-foreground">{b.name}</p>
            <p className="text-xs text-muted-foreground">{b.size} — {b.date}</p>
          </div>
          <Button size="sm" variant="ghost">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  </div>
);

export default AdminBackup;

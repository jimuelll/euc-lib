import { useEffect, useState, type FormEvent } from "react";
import { Coins, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminPage, AdminPanel, AdminStatCard, AdminStatGrid } from "./components/AdminPage";
import { getCirculationLog, type CirculationLogEntry } from "./adminCirculation/circulation.api";
import { fetchLibrarySettings, updateLibrarySettings } from "./adminLibrarySettings/api";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const AdminPayment = () => {
  const [hourlyFine, setHourlyFine] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overdueRows, setOverdueRows] = useState<CirculationLogEntry[]>([]);

  const loadPage = async () => {
    setLoading(true);
    try {
      const [settingsPayload, overdueResult] = await Promise.all([
        fetchLibrarySettings(),
        getCirculationLog({ status: "overdue", page: 1, limit: 20 }),
      ]);

      setHourlyFine(String(settingsPayload.settings.overdue_fine_per_hour ?? 0));
      setOverdueRows(overdueResult.rows);
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? "Failed to load fine settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, []);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    try {
      const numericRate = Number(hourlyFine);
      await updateLibrarySettings(numericRate);
      toast.success("Hourly overdue fine updated");
      await loadPage();
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? "Failed to save fine settings");
    } finally {
      setSaving(false);
    }
  };

  const totalOutstanding = overdueRows.reduce((sum, row) => sum + Number(row.fine_amount || 0), 0);

  return (
    <AdminPage
      eyebrow="System"
      title="Fine Settings"
      description="Set the hourly overdue fine and monitor the current borrowings that are already accruing charges."
      contentWidth="wide"
    >
      <AdminStatGrid>
        <AdminStatCard
          label="Hourly overdue rate"
          value={currencyFormatter.format(Number(hourlyFine || 0))}
          icon={<Coins className="h-4 w-4" />}
          helperText="Applied automatically to overdue borrowings every hour."
        />
        <AdminStatCard
          label="Overdue borrowings"
          value={String(overdueRows.length)}
          helperText="These records are currently flagged as overdue."
        />
        <AdminStatCard
          label="Outstanding fines"
          value={currencyFormatter.format(totalOutstanding)}
          helperText="Live amount based on the current hourly fine setting."
        />
      </AdminStatGrid>

      <AdminPanel
        title="Overdue fine configuration"
        description="Update the hourly fine that gets applied automatically once a borrowing passes its due date and time."
        className="max-w-3xl"
      >
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="space-y-2">
            <Label htmlFor="overdue-fine-hourly">Overdue fine per hour (PHP)</Label>
            <Input
              id="overdue-fine-hourly"
              type="number"
              min={0}
              step={0.01}
              value={hourlyFine}
              onChange={(event) => setHourlyFine(event.target.value)}
              disabled={loading || saving}
            />
          </div>

          <div className="flex justify-end border-t border-border/70 pt-4">
            <Button type="submit" disabled={loading || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save fine settings
            </Button>
          </div>
        </form>
      </AdminPanel>

      <AdminPanel
        title="Current overdue borrowings"
        description="These rows refresh against the live circulation log and show the currently accrued fine."
      >
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading overdue borrowings...
          </div>
        ) : overdueRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {["Student", "Book", "Due at", "Hours overdue", "Current fine"].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overdueRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/70 last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{row.user_name}</div>
                      <div className="text-xs text-muted-foreground">{row.student_employee_id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{row.book_title}</div>
                      <div className="text-xs text-muted-foreground">{row.copy_barcode ?? row.isbn ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.due_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.hours_overdue}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{currencyFormatter.format(Number(row.fine_amount || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No overdue borrowings are accruing fines right now.
          </div>
        )}
      </AdminPanel>
    </AdminPage>
  );
};

export default AdminPayment;

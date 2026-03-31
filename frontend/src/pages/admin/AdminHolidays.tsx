import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarOff, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdminPage, AdminPanel, AdminStatCard, AdminStatGrid } from "./components/AdminPage";
import {
  createLibraryHoliday,
  deleteLibraryHoliday,
  fetchLibrarySettings,
  type LibraryHoliday,
  updateLibraryHoliday,
} from "./adminLibrarySettings/api";

const emptyForm = {
  name: "",
  holiday_date: "",
  description: "",
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const AdminHolidays = () => {
  const [holidays, setHolidays] = useState<LibraryHoliday[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingHolidayId, setEditingHolidayId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const payload = await fetchLibrarySettings();
      setHolidays(payload.holidays);
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? "Failed to load holidays");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHolidays();
  }, []);

  const upcomingCount = useMemo(
    () => holidays.filter((holiday) => new Date(holiday.holiday_date) >= new Date()).length,
    [holidays]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (editingHolidayId) {
        await updateLibraryHoliday(editingHolidayId, form);
        toast.success("Holiday updated");
      } else {
        await createLibraryHoliday(form);
        toast.success("Holiday added");
      }

      setForm(emptyForm);
      setEditingHolidayId(null);
      await loadHolidays();
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? "Failed to save holiday");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (holiday: LibraryHoliday) => {
    setEditingHolidayId(holiday.id);
    setForm({
      name: holiday.name,
      holiday_date: holiday.holiday_date.slice(0, 10),
      description: holiday.description ?? "",
    });
  };

  const handleDelete = async (holidayId: number) => {
    try {
      await deleteLibraryHoliday(holidayId);
      toast.success("Holiday removed");
      if (editingHolidayId === holidayId) {
        setEditingHolidayId(null);
        setForm(emptyForm);
      }
      await loadHolidays();
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? "Failed to remove holiday");
    }
  };

  return (
    <AdminPage
      eyebrow="Administration"
      title="Holiday Calendar"
      description="Add custom holidays that should be skipped when calculating borrowing due dates."
      contentWidth="wide"
    >
      <AdminStatGrid>
        <AdminStatCard
          label="Configured holidays"
          value={String(holidays.length)}
          icon={<CalendarOff className="h-4 w-4" />}
          helperText="Every active holiday extends the due date by one day if it lands within the loan period."
        />
        <AdminStatCard
          label="Upcoming holidays"
          value={String(upcomingCount)}
          helperText="Future holidays that can still affect new borrowings."
        />
      </AdminStatGrid>

      <AdminPanel
        title={editingHolidayId ? "Edit holiday" : "Add holiday"}
        description="Holiday dates are excluded from the due-date countdown for active loans."
        className="max-w-3xl"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="holiday-name">Holiday name</Label>
              <Input
                id="holiday-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Foundation Day"
                disabled={saving}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="holiday-date">Holiday date</Label>
              <Input
                id="holiday-date"
                type="date"
                value={form.holiday_date}
                onChange={(event) => setForm((current) => ({ ...current, holiday_date: event.target.value }))}
                disabled={saving}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="holiday-description">Description</Label>
            <Textarea
              id="holiday-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Optional note for staff"
              disabled={saving}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
            {editingHolidayId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingHolidayId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
            ) : null}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingHolidayId ? "Save holiday" : "Add holiday"}
            </Button>
          </div>
        </form>
      </AdminPanel>

      <AdminPanel
        title="Configured holidays"
        description="These dates are skipped during loan countdown calculations."
      >
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading holidays...
          </div>
        ) : holidays.length ? (
          <div className="space-y-3">
            {holidays.map((holiday) => (
              <div
                key={holiday.id}
                className="flex flex-col gap-3 border border-border/70 p-4 md:flex-row md:items-start md:justify-between"
              >
                <div>
                  <div className="font-medium text-foreground">{holiday.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{formatDate(holiday.holiday_date)}</div>
                  {holiday.description ? (
                    <div className="mt-2 text-sm text-muted-foreground">{holiday.description}</div>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => startEditing(holiday)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void handleDelete(holiday.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No holidays configured yet.
          </div>
        )}
      </AdminPanel>
    </AdminPage>
  );
};

export default AdminHolidays;

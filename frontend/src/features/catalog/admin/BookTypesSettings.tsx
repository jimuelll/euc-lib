import { useEffect, useState, type FormEvent } from "react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminConfirmDialog } from "@/features/admin";
import { createBookType, deleteBookType, fetchBookTypes, updateBookType, type BookType } from "./catalog.api";
import { Trash2 } from "lucide-react";

const errorMessage = (error: unknown, fallback: string) => {
  const response = (error as { response?: { data?: { message?: string } } })?.response;
  return response?.data?.message ?? fallback;
};

export default function BookTypesSettings() {
  const [types, setTypes] = useState<BookType[]>([]);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("7");
  const [durationUnit, setDurationUnit] = useState<"hour" | "day">("day");
  const [fine, setFine] = useState("1");
  const [interval, setInterval] = useState<"hour" | "day">("hour");
  const [initialFine, setInitialFine] = useState("0");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { confirm, confirmDialog } = useAdminConfirmDialog();
  const load = () => fetchBookTypes().then(setTypes).catch(() => toast.error("Failed to load book types"));

  useEffect(() => { void load(); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createBookType({ name, loan_duration_minutes: durationUnit === "day" ? Number(duration) * 1440 : Math.round(Number(duration) * 60), loan_duration_unit: durationUnit, fine_per_hour: Number(fine), fine_interval: interval, initial_fine: Number(initialFine) });
      toast.success("Book type added");
      setName("");
      await load();
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to save book type"));
    } finally { setSaving(false); }
  };

  const update = async (type: BookType) => {
    setSaving(true);
    try {
      await updateBookType(type.id, type);
      toast.success("Book type updated");
      await load();
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to update book type"));
    } finally { setSaving(false); }
  };

  const remove = async (type: BookType) => {
    const active = Number(type.assigned_active_books ?? 0);
    const archived = Number(type.assigned_archived_books ?? 0);
    const total = active + archived;
    const impact = total
      ? `${active} active and ${archived} archived ${total === 1 ? "book is" : "books are"} assigned to this policy. Deleting it permanently removes those assignments. Active books will show “Needs loan policy” and cannot be borrowed or reserved until staff assigns another active policy. Archived books will also need a policy if restored. Existing loans can still be returned with their recorded terms.`
      : "No books are assigned to this policy. This policy will be permanently deleted.";
    const approved = await confirm({
      title: `Delete “${type.name}”?`,
      description: impact,
      actionLabel: "Delete policy",
      tone: "danger",
    });
    if (!approved) return;
    setDeletingId(type.id);
    try {
      const result = await deleteBookType(type.id);
      toast.success(result.message);
      await load();
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to delete policy"));
    } finally { setDeletingId(null); }
  };

  return <section className="admin-panel-surface admin-etched-border border border-border bg-card">
    {confirmDialog}
    <div className="border-b border-border bg-muted/30 px-5 py-4">
      <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>Book types and loan policies</h2>
      <p className="mt-1 text-sm text-muted-foreground">Set a day- or hour-based loan duration. Hour-based limits support fractional hours such as 1.5 hours.</p>
    </div>
    <div className="p-5">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-7">
        <div className="space-y-2 md:col-span-2"><Label htmlFor="book-type-name">Type name</Label><Input id="book-type-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Reserve collection" required /></div>
        <div className="space-y-2"><Label htmlFor="book-type-duration">Loan duration</Label><Input id="book-type-duration" type="number" min="0.01" step="0.01" value={duration} onChange={(event) => setDuration(event.target.value)} required /></div>
        <div className="space-y-2"><Label>Unit</Label><select value={durationUnit} onChange={(event) => setDurationUnit(event.target.value as "hour" | "day")} className="h-10 w-full border border-input bg-background px-3 text-sm"><option value="day">Days</option><option value="hour">Hours</option></select></div>
        <div className="space-y-2"><Label>Fine increment</Label><select value={interval} onChange={(event) => setInterval(event.target.value as "hour" | "day")} className="h-10 w-full border border-input bg-background px-3 text-sm"><option value="hour">Per hour</option><option value="day">Per day</option></select></div>
        <div className="space-y-2"><Label htmlFor="book-type-initial-fine">Initial fine (PHP)</Label><Input id="book-type-initial-fine" type="number" min="0" step="0.01" value={initialFine} onChange={(event) => setInitialFine(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="book-type-recurring-fine">Recurring fine (PHP)</Label><Input id="book-type-recurring-fine" type="number" min="0" step="0.01" value={fine} onChange={(event) => setFine(event.target.value)} required /></div>
        <div className="flex items-end"><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add book type"}</Button></div>
      </form>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead><tr className="border-b border-border bg-muted/20"><th className="px-3 py-2">Book type</th><th className="px-3 py-2">Loan duration</th><th className="px-3 py-2">Initial fine</th><th className="px-3 py-2">Recurring fine</th><th className="px-3 py-2">Interval</th><th className="px-3 py-2">Assigned books</th><th className="px-3 py-2">Action</th></tr></thead>
          <tbody>{types.map((type, index) => {
            const activePolicy = Number(type.is_active ?? 1) === 1;
            const fieldsDisabled = saving || deletingId !== null || !activePolicy;
            return <tr key={type.id} className="border-b border-border/70 align-top">
              <td className="px-3 py-2"><Input aria-label={`${type.name} policy name`} value={type.name} disabled={fieldsDisabled} onChange={(event) => setTypes((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /><span className={`mt-1 block text-xs ${activePolicy ? "text-success" : "text-muted-foreground"}`}>{activePolicy ? "Active" : "Inactive · delete only"}</span></td>
              <td className="px-3 py-2"><Input aria-label={`${type.name} loan duration`} type="number" min="1" value={type.loan_duration_unit === "hour" ? Number(type.loan_duration_minutes / 60).toFixed(2) : Math.round(type.loan_duration_minutes / 1440)} disabled={fieldsDisabled} onChange={(event) => setTypes((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, loan_duration_minutes: type.loan_duration_unit === "hour" ? Math.round(Number(event.target.value) * 60) : Math.round(Number(event.target.value) * 1440) } : item))} /></td>
              <td className="px-3 py-2"><Input aria-label={`${type.name} initial fine`} type="number" min="0" step="0.01" value={type.initial_fine} disabled={fieldsDisabled} onChange={(event) => setTypes((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, initial_fine: Number(event.target.value) } : item))} /></td>
              <td className="px-3 py-2"><Input aria-label={`${type.name} recurring fine`} type="number" min="0" step="0.01" value={type.fine_per_hour} disabled={fieldsDisabled} onChange={(event) => setTypes((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, fine_per_hour: Number(event.target.value) } : item))} /></td>
              <td className="px-3 py-2"><select aria-label={`${type.name} fine interval`} value={type.fine_interval} disabled={fieldsDisabled} onChange={(event) => setTypes((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, fine_interval: event.target.value as "hour" | "day" } : item))} className="h-10 border border-input bg-background px-2 text-sm"><option value="hour">Hour</option><option value="day">Day</option></select></td>
              <td className="px-3 py-3 text-xs text-muted-foreground">{Number(type.assigned_active_books ?? 0)} active · {Number(type.assigned_archived_books ?? 0)} archived</td>
              <td className="px-3 py-2"><div className="flex flex-wrap gap-2"><Button type="button" disabled={fieldsDisabled} onClick={() => void update(type)}>Save changes</Button><Button type="button" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground" disabled={saving || deletingId !== null} onClick={() => void remove(type)}><Trash2 className="mr-1.5 h-4 w-4" />{deletingId === type.id ? "Deleting…" : "Delete policy"}</Button></div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  </section>;
}

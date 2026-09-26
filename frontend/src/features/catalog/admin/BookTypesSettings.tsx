import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminConfirmDialog } from "@/features/admin";
import { createBookType, deleteBookType, fetchBookTypes, updateBookType, type BookType } from "./catalog.api";
import { Trash2 } from "lucide-react";
import { catalogKeys } from "../catalog.keys";
import { getApiErrorMessage } from "@/utils/apiError";
import { invalidateServerState } from "@/app/server-state";

export default function BookTypesSettings() {
  const queryClient = useQueryClient();
  const typesQuery = useQuery({ queryKey: catalogKeys.bookTypes(), queryFn: ({ signal }) => fetchBookTypes(signal) });
  const [typeDrafts, setTypeDrafts] = useState<Record<number, Partial<BookType>>>({});
  const types = (typesQuery.data ?? []).map((type) => ({ ...type, ...typeDrafts[type.id] }));
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("7");
  const [durationUnit, setDurationUnit] = useState<"hour" | "day">("day");
  const [fine, setFine] = useState("1");
  const [interval, setInterval] = useState<"hour" | "day">("hour");
  const [initialFine, setInitialFine] = useState("0");
  const { confirm, confirmDialog } = useAdminConfirmDialog();
  const invalidateBookTypes = () => invalidateServerState(queryClient, "settings");
  const createMutation = useMutation({
    mutationFn: createBookType,
    onSuccess: async () => { toast.success("Book type added"); setName(""); await invalidateBookTypes(); },
    onError: (error) => toast.error(getApiErrorMessage(error, "Failed to save book type")),
  });
  const updateMutation = useMutation({
    mutationFn: (type: BookType) => updateBookType(type.id, type),
    onSuccess: async (_result, type) => { toast.success("Book type updated"); setTypeDrafts((current) => { const next = { ...current }; delete next[type.id]; return next; }); await invalidateBookTypes(); },
    onError: (error) => toast.error(getApiErrorMessage(error, "Failed to update book type")),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteBookType,
    onSuccess: async (result) => { toast.success(result.message); await invalidateBookTypes(); },
    onError: (error) => toast.error(getApiErrorMessage(error, "Failed to delete policy")),
  });
  const saving = createMutation.isPending || updateMutation.isPending;
  const deletingId = deleteMutation.isPending ? deleteMutation.variables ?? null : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate({ name, loan_duration_minutes: durationUnit === "day" ? Number(duration) * 1440 : Math.round(Number(duration) * 60), loan_duration_unit: durationUnit, fine_per_hour: Number(fine), fine_interval: interval, initial_fine: Number(initialFine) });
  };

  const update = async (type: BookType) => {
    updateMutation.mutate(type);
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
    deleteMutation.mutate(type.id);
  };

  return <section className="admin-panel-surface admin-etched-border border border-border bg-card">
    {confirmDialog}
    {typesQuery.isError ? <div role="alert" className="flex items-center justify-between gap-3 border-b border-destructive/30 px-5 py-3 text-sm text-destructive">{getApiErrorMessage(typesQuery.error, "Failed to load book types")}<Button type="button" variant="outline" size="sm" onClick={() => void typesQuery.refetch()}>Try again</Button></div> : null}
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
        <table className="admin-stack-policies w-full min-w-[900px] text-left text-sm">
          <thead><tr className="border-b border-border bg-muted/20"><th className="px-3 py-2">Book type</th><th className="px-3 py-2">Loan duration</th><th className="px-3 py-2">Initial fine</th><th className="px-3 py-2">Recurring fine</th><th className="px-3 py-2">Interval</th><th className="px-3 py-2">Assigned books</th><th className="px-3 py-2">Action</th></tr></thead>
          <tbody>{types.map((type) => {
            const activePolicy = Number(type.is_active ?? 1) === 1;
            const fieldsDisabled = saving || deletingId !== null || !activePolicy;
            return <tr key={type.id} className="border-b border-border/70 align-top">
              <td className="px-3 py-2"><Input aria-label={`${type.name} policy name`} value={type.name} disabled={fieldsDisabled} onChange={(event) => setTypeDrafts((all) => ({ ...all, [type.id]: { ...all[type.id], name: event.target.value } }))} /><span className={`mt-1 block text-xs ${activePolicy ? "text-success" : "text-muted-foreground"}`}>{activePolicy ? "Active" : "Inactive · delete only"}</span></td>
              <td className="px-3 py-2"><Input aria-label={`${type.name} loan duration`} type="number" min="1" value={type.loan_duration_unit === "hour" ? Number(type.loan_duration_minutes / 60).toFixed(2) : Math.round(type.loan_duration_minutes / 1440)} disabled={fieldsDisabled} onChange={(event) => setTypeDrafts((all) => ({ ...all, [type.id]: { ...all[type.id], loan_duration_minutes: type.loan_duration_unit === "hour" ? Math.round(Number(event.target.value) * 60) : Math.round(Number(event.target.value) * 1440) } }))} /></td>
              <td className="px-3 py-2"><Input aria-label={`${type.name} initial fine`} type="number" min="0" step="0.01" value={type.initial_fine} disabled={fieldsDisabled} onChange={(event) => setTypeDrafts((all) => ({ ...all, [type.id]: { ...all[type.id], initial_fine: Number(event.target.value) } }))} /></td>
              <td className="px-3 py-2"><Input aria-label={`${type.name} recurring fine`} type="number" min="0" step="0.01" value={type.fine_per_hour} disabled={fieldsDisabled} onChange={(event) => setTypeDrafts((all) => ({ ...all, [type.id]: { ...all[type.id], fine_per_hour: Number(event.target.value) } }))} /></td>
              <td className="px-3 py-2"><select aria-label={`${type.name} fine interval`} value={type.fine_interval} disabled={fieldsDisabled} onChange={(event) => setTypeDrafts((all) => ({ ...all, [type.id]: { ...all[type.id], fine_interval: event.target.value as "hour" | "day" } }))} className="h-10 border border-input bg-background px-2 text-sm"><option value="hour">Hour</option><option value="day">Day</option></select></td>
              <td className="px-3 py-3 text-xs text-muted-foreground">{Number(type.assigned_active_books ?? 0)} active · {Number(type.assigned_archived_books ?? 0)} archived</td>
              <td className="px-3 py-2"><div className="flex flex-wrap gap-2"><Button type="button" disabled={fieldsDisabled} onClick={() => void update(type)}>Save changes</Button><Button type="button" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground" disabled={saving || deletingId !== null} onClick={() => void remove(type)}><Trash2 className="mr-1.5 h-4 w-4" />{deletingId === type.id ? "Deleting…" : "Delete policy"}</Button></div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  </section>;
}

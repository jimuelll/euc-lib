import { useEffect, useState, type FormEvent } from "react";
import { Archive, Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { createDepartment, deleteDepartment, fetchDepartments, restoreDepartment, updateDepartment, type Department } from "./api";

const messageOf = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Something went wrong. Try again.";

export default function AdminDepartments() {
  const [items, setItems] = useState<Department[]>([]);
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await fetchDepartments(status)); }
    catch (error) { toast.error(messageOf(error)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [status]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      if (editing) await updateDepartment(editing, name);
      else await createDepartment(name);
      toast.success(editing ? "Department updated" : "Department added");
      setName(""); setEditing(null); await load();
    } catch (error) { toast.error(messageOf(error)); }
    finally { setPending(false); }
  };

  const remove = async (item: Department) => {
    const count = Number(item.user_reference_count || 0);
    const action = count ? "Archive" : "Permanently delete";
    const usage = count ? ` ${count} employee record${count === 1 ? "" : "s"} will keep this department name.` : " This department is unused.";
    if (!window.confirm(`${action} “${item.name}”?${usage}`)) return;
    setPending(true);
    try {
      const result = await deleteDepartment(item.id);
      toast.success(result.action === "archived" ? "Department archived; employee records keep their reference" : "Unused department deleted");
      await load();
    } catch (error) { toast.error(messageOf(error)); }
    finally { setPending(false); }
  };

  const restore = async (item: Department) => {
    setPending(true);
    try { await restoreDepartment(item.id); toast.success("Department restored"); await load(); }
    catch (error) { toast.error(messageOf(error)); }
    finally { setPending(false); }
  };

  return <section className="mt-8 border-t border-border pt-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Departments</h2><p className="mt-1 text-sm text-muted-foreground">Manage employee account choices. Referenced departments are archived and can be restored.</p></div>
      <div className="flex gap-1 border border-border p-1" aria-label="Department status">
        {(["active", "archived"] as const).map((value) => <Button key={value} type="button" size="sm" variant={status === value ? "secondary" : "ghost"} aria-pressed={status === value} onClick={() => setStatus(value)}>{value === "active" ? "Active" : "Archived"}</Button>)}
      </div>
    </div>
    <div className="mt-4 grid gap-5 lg:grid-cols-2">
      <form className="space-y-3 border border-border bg-card p-5" onSubmit={save}>
        <label className="text-sm font-medium" htmlFor="department-name">Department name</label>
        <Input id="department-name" value={name} onChange={(event) => setName(event.target.value)} required disabled={pending} />
        <div className="flex gap-2"><Button type="submit" disabled={pending || !name.trim()}>{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}{editing ? "Save department" : "Add department"}</Button>{editing && <Button type="button" variant="outline" disabled={pending} onClick={() => { setEditing(null); setName(""); }}>Cancel</Button>}</div>
      </form>
      <div className="divide-y divide-border border border-border bg-card" aria-live="polite">
        {loading ? <div className="space-y-3 p-4" aria-label="Loading departments"><div className="h-4 animate-pulse bg-muted" /><div className="h-4 w-2/3 animate-pulse bg-muted" /></div> : items.length ? items.map((item) => {
          const count = Number(item.user_reference_count || 0);
          return <div className="flex flex-wrap items-center justify-between gap-3 p-4" key={item.id}>
            <div className="min-w-0"><p className="font-medium">{item.name}</p><p className="mt-1 text-sm text-muted-foreground">{count} employee record{count === 1 ? "" : "s"} reference this department</p></div>
            <div className="flex shrink-0 gap-2">{item.is_active ? <><Button size="sm" variant="outline" disabled={pending} onClick={() => { setEditing(item.id); setName(item.name); }}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="ghost" disabled={pending} className="text-destructive" onClick={() => void remove(item)}>{count ? <Archive className="mr-1.5 h-3.5 w-3.5" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}{count ? "Archive" : "Delete"}</Button></> : <Button size="sm" variant="outline" disabled={pending} onClick={() => void restore(item)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Restore</Button>}</div>
          </div>;
        }) : <p className="p-4 text-sm text-muted-foreground">No {status} departments.</p>}
      </div>
    </div>
  </section>;
}

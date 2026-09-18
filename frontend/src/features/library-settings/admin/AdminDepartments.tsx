import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { createDepartment, deleteDepartment, fetchDepartments, updateDepartment, type Department } from "./api";

const messageOf = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Something went wrong. Try again.";

export default function AdminDepartments() {
  const [items, setItems] = useState<Department[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const load = () => fetchDepartments().then(setItems).catch((error) => toast.error(messageOf(error)));
  useEffect(() => { void load(); }, []);
  const save = async (event: React.FormEvent) => { event.preventDefault(); try { if (editing) await updateDepartment(editing, name); else await createDepartment(name); toast.success(editing ? "Department updated" : "Department added"); setName(""); setEditing(null); void load(); } catch (error) { toast.error(messageOf(error)); } };
  return <section className="mt-8 border-t border-border pt-6"><h2 className="text-lg font-semibold">Departments</h2><p className="mt-1 text-sm text-muted-foreground">Configure the departments available for employee accounts.</p><div className="mt-4 grid gap-5 lg:grid-cols-2"><form className="space-y-3 border border-border bg-card p-5" onSubmit={save}><label className="text-sm font-medium" htmlFor="department-name">Department name</label><Input id="department-name" value={name} onChange={(event) => setName(event.target.value)} required /><div className="flex gap-2"><Button type="submit">{editing ? "Save department" : "Add department"}</Button>{editing ? <Button type="button" variant="outline" onClick={() => { setEditing(null); setName(""); }}>Cancel</Button> : null}</div></form><div className="divide-y border border-border bg-card">{items.length ? items.map((item) => <div className="flex items-center justify-between gap-3 p-4" key={item.id}><span>{item.name}</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setEditing(item.id); setName(item.name); }}>Edit</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { if (!window.confirm(`Delete ${item.name}?`)) return; try { await deleteDepartment(item.id); toast.success("Department removed"); void load(); } catch (error) { toast.error(messageOf(error)); } }}>Delete</Button></div></div>) : <p className="p-4 text-sm text-muted-foreground">No departments yet.</p>}</div></div></section>;
}

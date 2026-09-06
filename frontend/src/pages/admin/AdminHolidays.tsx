import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BookOpen, CalendarDays, CalendarOff, Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { AdminPage, AdminPanel } from "./components/AdminPage";
import { ContentRowsSkeleton } from "@/components/ui/content-skeletons";
import {
  createAcademicProgram, createAcademicTerm, createLibraryHoliday,
  deleteAcademicProgram, deleteAcademicTerm, deleteLibraryHoliday,
  fetchAcademicPrograms, fetchAcademicTerms, fetchLibrarySettings,
  setCurrentAcademicTerm, updateAcademicProgram, updateAcademicTerm, updateLibraryHoliday,
  type AcademicProgram, type AcademicTerm, type LibraryHoliday,
} from "./adminLibrarySettings/api";

type TermDraft = { name: string; starts_on: string; ends_on: string; is_current: boolean };
type HolidayDraft = { name: string; holiday_date: string; description: string };
const blankTerm: TermDraft = { name: "", starts_on: "", ends_on: "", is_current: false };
const blankHoliday: HolidayDraft = { name: "", holiday_date: "", description: "" };
const fmt = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString();
const messageOf = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Something went wrong. Try again.";

function BusyButton({ pending, children, ...props }: React.ComponentProps<typeof Button> & { pending?: boolean }) {
  return <Button {...props} disabled={props.disabled || pending}>{pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : children}</Button>;
}

export default function AcademicSettings() {
  const [tab, setTab] = useState("terms");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [holidays, setHolidays] = useState<LibraryHoliday[]>([]);
  const [term, setTerm] = useState<TermDraft>(blankTerm);
  const [program, setProgram] = useState("");
  const [holiday, setHoliday] = useState<HolidayDraft>(blankHoliday);
  const [editingTermId, setEditingTermId] = useState<number | null>(null);
  const [editingProgramId, setEditingProgramId] = useState<number | null>(null);
  const [editingHolidayId, setEditingHolidayId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [settings, nextPrograms, nextTerms] = await Promise.all([fetchLibrarySettings(), fetchAcademicPrograms(), fetchAcademicTerms()]);
      setHolidays(settings.holidays); setPrograms(nextPrograms); setTerms(nextTerms);
    } catch (error) { toast.error(messageOf(error)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const run = async (key: string, operation: () => Promise<unknown>, success: string) => {
    setPending(key);
    try { await operation(); toast.success(success); await load(); return true; }
    catch (error) { toast.error(messageOf(error)); return false; }
    finally { setPending(null); }
  };
  const cancelTerm = () => { setEditingTermId(null); setTerm(blankTerm); };
  const cancelProgram = () => { setEditingProgramId(null); setProgram(""); };
  const cancelHoliday = () => { setEditingHolidayId(null); setHoliday(blankHoliday); };
  const rows = (items: { id: number; name: string }[], empty: string, render: (item: any) => ReactNode) => loading ? <div className="p-5"><ContentRowsSkeleton rows={4} /></div> : <div className="divide-y divide-border">{items.map(render)}{!items.length && <p className="p-5 text-sm text-muted-foreground">{empty}</p>}</div>;
  const Header = ({ icon: Icon, title, detail }: { icon: typeof CalendarDays; title: string; detail: string }) => <div className="flex items-start gap-3 border-b border-border py-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center border border-warning/30 bg-warning/10 text-warning"><Icon className="h-4 w-4" /></div><div><h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{title}</h2><p className="mt-1 text-sm text-muted-foreground">{detail}</p></div></div>;
  const editActions = (onEdit: () => void, onDelete: () => void, actionKey: string) => <div className="flex shrink-0 gap-2"><Button type="button" size="sm" variant="outline" onClick={onEdit} disabled={Boolean(pending)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button><Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete} disabled={Boolean(pending)}>{pending === actionKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}<span className="sr-only">Delete</span></Button></div>;

  return <AdminPage title="Academic calendar & settings" description="Manage terms, standardized programs, and no-service dates." contentWidth="wide"><Tabs value={tab} onValueChange={setTab}>
    <div className="border-y border-border bg-muted/20 px-2 py-2 sm:px-3"><TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0"><TabsTrigger value="terms" className="gap-2 rounded-sm px-3 py-2 text-xs"><CalendarDays className="h-4 w-4" />Academic terms</TabsTrigger><TabsTrigger value="programs" className="gap-2 rounded-sm px-3 py-2 text-xs"><BookOpen className="h-4 w-4" />Programs / Courses</TabsTrigger><TabsTrigger value="holidays" className="gap-2 rounded-sm px-3 py-2 text-xs"><CalendarOff className="h-4 w-4" />Holidays</TabsTrigger></TabsList></div>
    <TabsContent value="terms" className="mt-0"><Header icon={CalendarDays} title="Academic terms" detail="Set the current term for student records. A current term cannot be deleted." /><div className="mt-5 grid gap-5 lg:grid-cols-2"><AdminPanel title={editingTermId ? "Edit academic term" : "Add academic term"}><form className="space-y-4" onSubmit={(event: FormEvent) => { event.preventDefault(); void run("term", () => editingTermId ? updateAcademicTerm(editingTermId, term) : createAcademicTerm(term), editingTermId ? "Academic term updated" : "Academic term added").then((ok) => ok && cancelTerm()); }}><div><Label htmlFor="term-name">Term name</Label><Input id="term-name" className="mt-2" value={term.name} onChange={(event) => setTerm({ ...term, name: event.target.value })} required /></div><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="term-start">Starts</Label><Input id="term-start" className="mt-2" type="date" value={term.starts_on} onChange={(event) => setTerm({ ...term, starts_on: event.target.value })} required /></div><div><Label htmlFor="term-end">Ends</Label><Input id="term-end" className="mt-2" type="date" value={term.ends_on} onChange={(event) => setTerm({ ...term, ends_on: event.target.value })} required /></div></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={term.is_current} onChange={(event) => setTerm({ ...term, is_current: event.target.checked })} />Make this the current term</label><div className="flex gap-2"><BusyButton type="submit" pending={pending === "term"}>{editingTermId ? "Save term" : "Add term"}</BusyButton>{editingTermId && <Button type="button" variant="outline" onClick={cancelTerm} disabled={Boolean(pending)}><X className="mr-1.5 h-4 w-4" />Cancel</Button>}</div></form></AdminPanel><AdminPanel title="Configured terms" contentClassName="p-0">{rows(terms, "No academic terms yet.", (item: AcademicTerm) => <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><p className="font-medium">{item.name}</p><p className="mt-1 text-sm text-muted-foreground">{fmt(item.starts_on)} – {fmt(item.ends_on)}</p></div><div className="flex items-center gap-2">{item.is_current ? <span className="inline-flex items-center gap-1 text-sm font-medium text-success"><Check className="h-4 w-4" />Current</span> : <Button size="sm" variant="outline" disabled={Boolean(pending)} onClick={() => void run(`current-${item.id}`, () => setCurrentAcademicTerm(item.id), "Current term updated")}>Set current</Button>}{editActions(() => { setEditingTermId(item.id); setTerm({ name: item.name, starts_on: item.starts_on.slice(0, 10), ends_on: item.ends_on.slice(0, 10), is_current: Boolean(item.is_current) }); }, () => { if (window.confirm(`Delete ${item.name}?`)) void run(`delete-term-${item.id}`, () => deleteAcademicTerm(item.id), "Academic term deleted"); }, `delete-term-${item.id}`)}</div></div>)}</AdminPanel></div></TabsContent>
    <TabsContent value="programs" className="mt-0"><Header icon={BookOpen} title="Programs / Courses" detail="These standardized choices are available when creating and editing student accounts." /><div className="mt-5 grid gap-5 lg:grid-cols-2"><AdminPanel title={editingProgramId ? "Edit program / course" : "Add program / course"}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void run("program", () => editingProgramId ? updateAcademicProgram(editingProgramId, program) : createAcademicProgram(program), editingProgramId ? "Program / course updated" : "Program / course added").then((ok) => ok && cancelProgram()); }}><div><Label htmlFor="program-name">Program / course name</Label><Input id="program-name" className="mt-2" value={program} onChange={(event) => setProgram(event.target.value)} placeholder="BS Information Technology" required /></div><div className="flex gap-2"><BusyButton type="submit" pending={pending === "program"}>{editingProgramId ? "Save program" : "Add program / course"}</BusyButton>{editingProgramId && <Button type="button" variant="outline" onClick={cancelProgram} disabled={Boolean(pending)}>Cancel</Button>}</div></form></AdminPanel><AdminPanel title="Configured programs / courses" contentClassName="p-0">{rows(programs, "No programs / courses yet.", (item: AcademicProgram) => <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-4"><p className="font-medium">{item.name}</p>{editActions(() => { setEditingProgramId(item.id); setProgram(item.name); }, () => { if (window.confirm(`Delete ${item.name}?`)) void run(`delete-program-${item.id}`, () => deleteAcademicProgram(item.id), "Program / course removed"); }, `delete-program-${item.id}`)}</div>)}</AdminPanel></div></TabsContent>
    <TabsContent value="holidays" className="mt-0"><Header icon={CalendarOff} title="Holidays" detail="Active holidays extend affected circulation due dates." /><div className="mt-5 grid gap-5 lg:grid-cols-2"><AdminPanel title={editingHolidayId ? "Edit holiday" : "Add holiday"}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void run("holiday", () => editingHolidayId ? updateLibraryHoliday(editingHolidayId, holiday) : createLibraryHoliday(holiday), editingHolidayId ? "Holiday updated" : "Holiday added").then((ok) => ok && cancelHoliday()); }}><div><Label htmlFor="holiday-name">Holiday name</Label><Input id="holiday-name" className="mt-2" value={holiday.name} onChange={(event) => setHoliday({ ...holiday, name: event.target.value })} placeholder="Holiday name" required /></div><div><Label htmlFor="holiday-date">Date</Label><Input id="holiday-date" className="mt-2" type="date" value={holiday.holiday_date} onChange={(event) => setHoliday({ ...holiday, holiday_date: event.target.value })} required /></div><div><Label htmlFor="holiday-note">Note <span className="text-muted-foreground">(optional)</span></Label><Input id="holiday-note" className="mt-2" value={holiday.description} onChange={(event) => setHoliday({ ...holiday, description: event.target.value })} placeholder="Optional note" /></div><div className="flex gap-2"><BusyButton type="submit" pending={pending === "holiday"}>{editingHolidayId ? "Save holiday" : "Add holiday"}</BusyButton>{editingHolidayId && <Button type="button" variant="outline" onClick={cancelHoliday} disabled={Boolean(pending)}>Cancel</Button>}</div></form></AdminPanel><AdminPanel title="Configured holidays" contentClassName="p-0">{rows(holidays, "No holidays yet.", (item: LibraryHoliday) => <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><p className="font-medium">{item.name}</p><p className="mt-1 text-sm text-muted-foreground">{fmt(item.holiday_date)}{item.description ? ` · ${item.description}` : ""}</p></div>{editActions(() => { setEditingHolidayId(item.id); setHoliday({ name: item.name, holiday_date: item.holiday_date.slice(0, 10), description: item.description ?? "" }); }, () => { if (window.confirm(`Delete ${item.name}?`)) void run(`delete-holiday-${item.id}`, () => deleteLibraryHoliday(item.id), "Holiday removed"); }, `delete-holiday-${item.id}`)}</div>)}</AdminPanel></div></TabsContent>
  </Tabs></AdminPage>;
}

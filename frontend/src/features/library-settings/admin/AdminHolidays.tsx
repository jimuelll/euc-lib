import { LibraryTermTimeline } from "@/components/ui/library-patterns";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Upload, Search, Info, Loader2 } from "@/components/ui/library-glyphs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { ContentRowsSkeleton } from "@/components/ui/content-skeletons";
import { AdminPageHeader, AdminPageTabs, AdminFilterChips, AdminDetailDrawer, AdminRowMenu, AdminStatusBadge, AdminDateTime, formatAdminDate, useAdminUrlState, useAdminConfirmDialog, useUnsavedChanges } from "@/features/admin";
import { invalidateServerState } from "@/app/server-state";
import { librarySettingsKeys } from "../library-settings.keys";
import * as api from "./api";
import { nationalHolidays2026, holidaySource } from "./national-holidays";
import "./academic-settings.css";

type Kind = "terms" | "programs" | "holidays" | "departments";
type Item = api.AcademicTerm | api.AcademicProgram | api.LibraryHoliday | api.Department;
type Draft = { name: string; starts_on: string; ends_on: string; holiday_date: string; description: string };
const blank: Draft = { name: "", starts_on: "", ends_on: "", holiday_date: "", description: "" };
const labels: Record<Kind, string> = { terms: "term", programs: "program", holidays: "holiday", departments: "department" };
const descriptions: Record<Kind, string> = {
  terms: "Manage the terms used for student assignment and account validity.",
  programs: "Manage program and course choices for accounts and catalog holdings.",
  holidays: "Manage the dates when the library does not provide service.",
  departments: "Manage department choices for employee accounts.",
};
const day = (value: string) => String(value).slice(0, 10);
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const dateRange = (start: string, end: string) => {
  if (!validDay(day(start)) || !validDay(day(end))) return "—";
  const sameYear = day(start).slice(0,4) === day(end).slice(0,4);
  return `${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", ...(!sameYear ? { year: "numeric" } as const : {}) }).format(new Date(day(start)+"T00:00:00"))} – ${formatAdminDate(day(end), false)}`;
};
const weekday = (value: string) => new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric" }).format(new Date(day(value)+"T00:00:00"));
const errorMessage = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Could not save changes. Try again.";
const active = (item: Item) => "is_active" in item && Boolean(item.is_active);
function Changed({ item }: { item: Item }) {
  const date = item.updated_at || item.created_at;
  return <p className="academic-audit">{date ? <>Last changed{item.changed_by ? ` by ${item.changed_by}` : ""} on {formatAdminDate(date)}</> : "Change history unavailable"}</p>;
}

export default function AcademicSettings() {
  const [params, patchParams] = useAdminUrlState();
  const tab: Kind = ["terms", "programs", "holidays", "departments"].includes(params.get("tab") || "") ? params.get("tab") as Kind : "terms";
  const client = useQueryClient();
  const settings = useQuery({ queryKey: librarySettingsKeys.settings("all"), queryFn: ({ signal }) => api.fetchLibrarySettings("all", signal) });
  const programsQuery = useQuery({ queryKey: librarySettingsKeys.programs("all"), queryFn: ({ signal }) => api.fetchAcademicPrograms("all", signal) });
  const termsQuery = useQuery({ queryKey: librarySettingsKeys.terms(), queryFn: ({ signal }) => api.fetchAcademicTerms(signal) });
  const departmentsQuery = useQuery({ queryKey: librarySettingsKeys.departments("all"), queryFn: ({ signal }) => api.fetchDepartments("all", signal) });
  const terms = termsQuery.data || [];
  const collections: Record<Kind, Item[]> = { terms, programs: programsQuery.data || [], holidays: settings.data?.holidays || [], departments: departmentsQuery.data || [] };
  const queries = { terms: termsQuery, programs: programsQuery, holidays: settings, departments: departmentsQuery };
  const query = queries[tab];
  const [statuses, setStatuses] = useState<Record<Kind, string>>({ terms: "all", programs: "active", holidays: "active", departments: "active" });
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{ kind: Kind; item?: Item } | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [serverError, setServerError] = useState("");
  const [pending, setPending] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const { confirm, confirmDialog } = useAdminConfirmDialog();
  const unsaved = useUnsavedChanges(draft, Boolean(editor), editor ? `${editor.kind}-${editor.item?.id || "new"}` : "closed");
  const importGuard = useUnsavedChanges(selectedDates, importOpen, "holiday-import");
  const closeEditor = async () => { if (!pending && await unsaved.confirmDiscard()) setEditor(null); };
  const openEditor = (kind: Kind, item?: Item) => {
    setDraft({ ...blank, name: item?.name || "", ...("starts_on" in (item || {}) ? { starts_on: day((item as api.AcademicTerm).starts_on), ends_on: day((item as api.AcademicTerm).ends_on) } : {}), ...("holiday_date" in (item || {}) ? { holiday_date: day((item as api.LibraryHoliday).holiday_date), description: (item as api.LibraryHoliday).description || "" } : {}) });
    setServerError(""); setEditor({ kind, item });
  };
  const run = async (operation: () => Promise<unknown>, message: string, undo?: (result: unknown) => Promise<unknown>) => {
    setPending(true);
    try {
      const result = await operation();
      await invalidateServerState(client, "settings");
      toast.success(message, undo && !(message === "Term added" && (result as { term?: api.AcademicTerm })?.term?.is_current) ? { action: { label: "Undo", onClick: () => { void run(() => undo(result), "Change undone"); } } } : undefined);
      return result || true;
    } catch (error) { setServerError(errorMessage(error)); toast.error(errorMessage(error)); return false; }
    finally { setPending(false); }
  };
  const archive = (kind: Kind, id: number) => kind === "programs" ? api.deleteAcademicProgram(id, "archive") : kind === "departments" ? api.deleteDepartment(id, "archive") : api.deleteLibraryHoliday(id);
  const restore = (kind: Kind, id: number) => kind === "programs" ? api.restoreAcademicProgram(id) : kind === "departments" ? api.restoreDepartment(id) : api.restoreLibraryHoliday(id);
  const remove = async (kind: Kind, item: Item, permanently = false) => {
    if (!await confirm({ title: `${permanently ? "Delete" : "Archive"} ${item.name}?`, description: permanently ? "This entry has no references. Permanent deletion cannot be undone. References will be checked again before deleting." : kind === "holidays" ? "New loans will stop using this holiday. Existing loans keep their due dates. You can restore this holiday later." : "This choice will be hidden from new records. Existing references remain available, and you can restore it later.", actionLabel: permanently ? "Delete permanently" : "Archive", tone: "danger" })) return;
    const operation = () => permanently ? kind === "terms" ? api.deleteAcademicTerm(item.id) : kind === "programs" ? api.deleteAcademicProgram(item.id, "delete") : api.deleteDepartment(item.id, "delete") : archive(kind, item.id);
    await run(operation, `${labels[kind][0].toUpperCase()+labels[kind].slice(1)} ${permanently ? "deleted" : "archived"}`, permanently ? undefined : () => restore(kind, item.id));
  };
  const makeCurrent = async (item: api.AcademicTerm) => {
    const previous = terms.find(term => term.is_current);
    if (await confirm({ title: `Set ${item.name} as current?`, description: "New student records will use this term by default. Account validity uses each student's assigned term end date. Existing student assignments and saved loan due dates stay unchanged.", actionLabel: "Set as current" })) await run(() => api.setCurrentAcademicTerm(item.id), "Current term updated", previous ? () => api.setCurrentAcademicTerm(previous.id) : undefined);
  };
  const peers = editor ? collections[editor.kind].filter(item => item.id !== editor.item?.id) : [];
  const duplicate = editor?.kind !== "holidays" && peers.some(item => item.name.trim().toLocaleLowerCase() === draft.name.trim().toLocaleLowerCase());
  const overlapping = editor?.kind === "terms" && validDay(draft.starts_on) && validDay(draft.ends_on) ? terms.find(item => item.id !== editor.item?.id && draft.starts_on <= day(item.ends_on) && draft.ends_on >= day(item.starts_on)) : undefined;
  const duplicateDate = editor?.kind === "holidays" && peers.some(item => day((item as api.LibraryHoliday).holiday_date) === draft.holiday_date);
  const nameError = draft.name.trim() && duplicate ? "This name already exists. Check active and archived entries." : "";
  const datesError = overlapping ? `These dates overlap ${overlapping.name}.` : editor?.kind === "terms" && draft.starts_on && draft.ends_on && draft.ends_on < draft.starts_on ? "End date must be on or after the start date." : duplicateDate ? "This date already has a holiday. Check Archived to restore it." : "";
  const required = !draft.name.trim() ? "Enter a name" : editor?.kind === "terms" && (!validDay(draft.starts_on) || !validDay(draft.ends_on)) ? "Choose start and end dates" : editor?.kind === "holidays" && !validDay(draft.holiday_date) ? "Choose a date" : "";
  const previousTerm = terms.filter(item => item.id !== editor?.item?.id && day(item.ends_on) < draft.starts_on).sort((a,b) => day(b.ends_on).localeCompare(day(a.ends_on)))[0];
  const nextTerm = terms.filter(item => item.id !== editor?.item?.id && day(item.starts_on) > draft.ends_on).sort((a,b) => day(a.starts_on).localeCompare(day(b.starts_on)))[0];
  const nextGap = nextTerm && validDay(draft.ends_on) ? Math.round((Date.parse(day(nextTerm.starts_on))-Date.parse(draft.ends_on))/86400000)-1 : 0;
  const gap = previousTerm && validDay(draft.starts_on) ? Math.round((Date.parse(draft.starts_on)-Date.parse(day(previousTerm.ends_on)))/86400000)-1 : 0;
  const save = async () => {
    if (!editor || required || nameError || datesError || pending) return;
    const { kind, item } = editor;
    const payload = { ...draft, name: draft.name.trim(), is_current: kind === "terms" && Boolean((item as api.AcademicTerm)?.is_current) };
    const operation = () => kind === "terms" ? item ? api.updateAcademicTerm(item.id, payload) : api.createAcademicTerm(payload) : kind === "programs" ? item ? api.updateAcademicProgram(item.id, payload.name) : api.createAcademicProgram(payload.name) : kind === "departments" ? item ? api.updateDepartment(item.id, payload.name) : api.createDepartment(payload.name) : item ? api.updateLibraryHoliday(item.id, payload) : api.createLibraryHoliday(payload);
    const undo = item ? () => kind === "terms" ? api.updateAcademicTerm(item.id, { ...(item as api.AcademicTerm), is_current: Boolean((item as api.AcademicTerm).is_current), starts_on: day((item as api.AcademicTerm).starts_on), ends_on: day((item as api.AcademicTerm).ends_on) }) : kind === "programs" ? api.updateAcademicProgram(item.id, item.name) : kind === "departments" ? api.updateDepartment(item.id, item.name) : api.updateLibraryHoliday(item.id, { ...(item as api.LibraryHoliday), holiday_date: day((item as api.LibraryHoliday).holiday_date), description: (item as api.LibraryHoliday).description || "" }) : (result: unknown) => {
      const saved = result as { term?: api.AcademicTerm; program?: api.AcademicProgram; department?: api.Department; holiday?: api.LibraryHoliday };
      const created = saved.term || saved.program || saved.department || saved.holiday;
      if (!created || (kind === "terms" && (created as api.AcademicTerm).is_current)) return Promise.reject(new Error("The current term must be retained. Set another term as current first."));
      return kind === "terms" ? api.deleteAcademicTerm(created.id) : archive(kind, created.id);
    };
    if (await run(operation, `${labels[kind][0].toUpperCase()+labels[kind].slice(1)} ${item ? "updated" : "added"}`, undo)) { unsaved.markSaved(); setEditor(null); }
  };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const termOrder = (term: api.AcademicTerm) => term.is_current ? 0 : day(term.starts_on) >= today ? 1 : 2;
  const allItems = collections[tab];
  const visible = allItems.filter(item => (tab === "terms" || (statuses[tab] === "active" ? active(item) : !active(item))) && item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  visible.sort((a,b) => tab === "terms" ? termOrder(a as api.AcademicTerm)-termOrder(b as api.AcademicTerm) || day((a as api.AcademicTerm).starts_on).localeCompare(day((b as api.AcademicTerm).starts_on)) : tab === "holidays" ? day((a as api.LibraryHoliday).holiday_date).localeCompare(day((b as api.LibraryHoliday).holiday_date)) : a.name.localeCompare(b.name));
  const groups = new Map<string, Item[]>();
  visible.forEach(item => {
    const namedYear = item.name.match(/(?:19|20)\d{2}\s*[–-]\s*(?:19|20)\d{2}/)?.[0].replace(/\s*[–-]\s*/, "–");
    const year = tab === "terms" ? namedYear || `${day((item as api.AcademicTerm).starts_on).slice(0,4)}${day((item as api.AcademicTerm).ends_on).slice(0,4) !== day((item as api.AcademicTerm).starts_on).slice(0,4) ? `–${day((item as api.AcademicTerm).ends_on).slice(0,4)}` : ""}` : tab === "holidays" ? day((item as api.LibraryHoliday).holiday_date).slice(0,4) : "";
    const group = tab === "terms" ? `Academic year ${year} · ${(item as api.AcademicTerm).is_current ? "Current" : termOrder(item as api.AcademicTerm) === 1 ? "Upcoming" : "Past and in progress"}` : year;
    groups.set(group, [...(groups.get(group) || []), item]);
  });
  const references = (item: Item, kind: Kind) => {
    const users = Number("user_reference_count" in item ? item.user_reference_count || 0 : 0);
    return <p className="academic-references"><Link to={`/admin/manage?${kind === "programs" ? "programId" : kind === "departments" ? "departmentId" : "termId"}=${item.id}&status=all&academicLabel=${encodeURIComponent(item.name)}`}>{users} user reference{users !== 1 ? "s" : ""}</Link>{kind === "programs" && <> · <Link to={`/admin/catalog?tab=holdings&programId=${item.id}`}>{Number((item as api.AcademicProgram).holding_reference_count || 0)} holding references</Link></>}<Info aria-label="Reference counts include archived accounts and holdings" className="h-3.5 w-3.5" ><title>Counts include archived accounts and holdings.</title></Info></p>;
  };
  const openImport = () => { setSelectedDates(nationalHolidays2026.filter(holiday => !collections.holidays.some(item => day((item as api.LibraryHoliday).holiday_date) === holiday.holiday_date)).map(holiday => holiday.holiday_date)); setServerError(""); setImportOpen(true); };
  const importSelected = async () => {
    if (pending || !selectedDates.length) return;
    if (await run(() => api.importLibraryHolidays(nationalHolidays2026.filter(holiday => selectedDates.includes(holiday.holiday_date))), `${selectedDates.length} holidays imported`, async result => { for (const holiday of (result as { holidays: api.LibraryHoliday[] }).holidays) await api.deleteLibraryHoliday(holiday.id); })) { importGuard.markSaved(); setImportOpen(false); }
  };
  return <div className="academic-settings admin-desk-workspace">
    <AdminPageHeader title="Academic Settings" actions={<span className="admin-desk-secondary">{query.dataUpdatedAt ? <>Updated <time dateTime={new Date(query.dataUpdatedAt).toISOString()}>{new Date(query.dataUpdatedAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" })}</time></> : "Loading settings…"}</span>} />
    <AdminPageTabs label="Academic Settings sections" value={tab} onChange={value => { setSearch(""); patchParams({ tab: value }); }} items={([
      ["terms", "Academic terms", "academic"], ["programs", "Programs / Courses", "catalog"], ["holidays", "Holidays", "reservations"], ["departments", "Departments", "users"],
    ] as const).map(([value, label, icon]) => ({ value, label, icon, badge: queries[value].isSuccess ? collections[value].length : undefined, descriptionId: `academic-${value}-count`, badgeDescription: "configured entries", unsaved: unsaved.dirty && editor?.kind === value }))}>
      {[tab].map(kind => <TabsContent key={kind} value={kind} className="academic-panel">
        <div className="academic-title-row"><p className="admin-desk-secondary">{descriptions[kind]}</p><div className="academic-actions">{kind === "holidays" && <Button variant="outline" onClick={openImport} disabled={pending || !query.isSuccess}><Upload className="h-4 w-4" />Import national holidays</Button>}<Button onClick={() => openEditor(kind)} disabled={pending || !query.isSuccess}><Plus className="h-4 w-4" />Add {labels[kind]}</Button></div></div>
        {kind === "holidays" && <div className="academic-notice"><Info className="h-4 w-4" /><p>Active holidays extend due dates for new loans. Changes do not recalculate existing due dates. Holidays are archived so existing loans keep their due dates.</p></div>}
        {kind !== "terms" && <div className="academic-filter-row"><AdminFilterChips label={`${kind} status`} value={statuses[kind]} onChange={value => setStatuses({ ...statuses, [kind]: value })} items={[{ value: "active", label: "Active", count: query.isSuccess ? allItems.filter(active).length : undefined }, { value: "archived", label: "Archived", count: query.isSuccess ? allItems.filter(item => !active(item)).length : undefined }]} />{(kind === "programs" || kind === "departments") && allItems.length > 10 && <div className="academic-search"><Search className="h-4 w-4" /><Input aria-label={`Search ${kind}`} value={search} onChange={event => setSearch(event.target.value)} placeholder={`Search ${kind}…`} /></div>}</div>}
        {query.isPending ? <ContentRowsSkeleton rows={4} /> : query.isError ? <div role="alert" className="academic-empty"><p>Could not load {kind}.</p><Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></div> : !visible.length ? <div className="academic-empty"><p>{search ? "No matching entries" : `No ${kind === "terms" ? "academic terms" : `${statuses[kind]} ${kind}`}`}</p>{!search && statuses[kind] !== "archived" && <Button onClick={() => openEditor(kind)}>Add {labels[kind]}</Button>}</div> : [...groups].map(([group, items]) => <section key={group} className="academic-group" aria-label={group || descriptions[kind]}>{group && <h2>{group}</h2>}<div className="academic-list" data-library-records={kind === "terms" ? "terms" : undefined}>{items.map(item => {
          const term = item as api.AcademicTerm;
          const totalRefs = Number("user_reference_count" in item ? item.user_reference_count || 0 : 0) + Number("holding_reference_count" in item ? item.holding_reference_count || 0 : 0);
          const menu = kind === "terms" ? [...(!term.is_current ? [{ label: "Set as current", onSelect: () => { void makeCurrent(term); } }] : []), ...(!term.is_current && !totalRefs ? [{ label: "Delete permanently", destructive: true, onSelect: () => { void remove(kind,item,true); } }] : [])] : [...(active(item) ? [{ label: "Archive", destructive: true, onSelect: () => { void remove(kind,item); } }] : []), ...(kind !== "holidays" && !totalRefs ? [{ label: "Delete permanently", destructive: true, onSelect: () => { void remove(kind,item,true); } }] : [])];
          return <article key={item.id} className="academic-row"><div className="academic-row-copy"><div className="academic-row-title"><h3>{item.name}</h3><AdminStatusBadge status={kind === "terms" && term.is_current ? "ready" : "neutral"}>{kind === "terms" ? term.is_current ? "Current" : day(term.starts_on) > today ? "Upcoming" : day(term.ends_on) < today ? "Past" : "In progress" : active(item) ? "Active" : "Archived"}</AdminStatusBadge></div>{kind === "terms" && <><p className="sr-only">{dateRange(term.starts_on,term.ends_on)}</p><LibraryTermTimeline start={term.starts_on} end={term.ends_on} today={today} /></>}{kind === "holidays" && <p className="admin-desk-secondary">{weekday((item as api.LibraryHoliday).holiday_date)}{(item as api.LibraryHoliday).description ? ` · ${(item as api.LibraryHoliday).description}` : ""}</p>}{kind !== "holidays" && references(item,kind)}<Changed item={item} /></div><div className="academic-actions">{kind === "terms" || active(item) ? <Button size="sm" variant="outline" onClick={() => openEditor(kind,item)} disabled={pending}><Pencil className="h-3.5 w-3.5" />Edit</Button> : <Button size="sm" variant="outline" disabled={pending} onClick={() => void run(() => restore(kind,item.id), `${labels[kind]} restored`, () => archive(kind,item.id))}>Restore</Button>}{menu.length > 0 && <AdminRowMenu label={`Actions for ${item.name}`} items={menu} disabled={pending} />}</div></article>;
        })}</div></section>)}
      </TabsContent>)}
    </AdminPageTabs>
    <AdminDetailDrawer className="academic-drawer" open={Boolean(editor)} onClose={() => { void closeEditor(); }} title={`${editor?.item ? "Edit" : "Add"} ${labels[editor?.kind || tab]}`} description={descriptions[editor?.kind || tab]} footer={<><span className="academic-footer-status" role="status">{pending ? "Saving…" : required || nameError || datesError || `${draft.name || labels[editor?.kind || tab]} · ${unsaved.dirty ? "Unsaved changes" : "No unsaved changes"}`}</span><Button variant="outline" disabled={pending} onClick={() => { void closeEditor(); }}>Cancel</Button><Button form="academic-editor" type="submit" disabled={pending || Boolean(required || nameError || datesError) || Boolean(editor?.item && !unsaved.dirty)}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}{editor?.item ? "Save changes" : `Add ${labels[editor?.kind || tab]}`}</Button></>}>
      <form id="academic-editor" onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={pending} className="academic-form">
        <div className="admin-form-field"><Label htmlFor="academic-name">{editor?.kind === "programs" ? "Program / Course name" : "Name"}</Label><Input id="academic-name" value={draft.name} maxLength={150} onChange={event => { setDraft({ ...draft, name: event.target.value }); setServerError(""); }} placeholder={editor?.kind === "programs" ? "e.g. BS Information Technology" : editor?.kind === "terms" ? "e.g. First semester 2026–2027" : editor?.kind === "departments" ? "e.g. College of Engineering" : "e.g. Christmas Day"} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "academic-name-error" : undefined} />{nameError && <p id="academic-name-error" className="academic-error">{nameError}</p>}</div>
        {editor?.kind === "terms" && <><div className="academic-date-fields"><AdminDateTime dateOnly label="Starts" value={draft.starts_on} onChange={value => setDraft({ ...draft, starts_on: value })} /><AdminDateTime dateOnly label="Ends" value={draft.ends_on} onChange={value => setDraft({ ...draft, ends_on: value })} /></div>{gap > 0 && !datesError && <div className="academic-notice"><Info className="h-4 w-4" /><p>{gap} day{gap !== 1 ? "s" : ""} between {previousTerm.name} and this term. Confirm that this break is intended.</p></div>}{nextGap > 0 && !datesError && <p className="admin-desk-secondary">{nextGap} days before {nextTerm.name}. Confirm that this break is intended.</p>}<p className="admin-desk-secondary">{!terms.length ? "The first term becomes current automatically." : "Use Set as current in the row menu to change the default term."} Editing an assigned term's end date changes those students' account validity.</p></>}
        {editor?.kind === "holidays" && <><AdminDateTime dateOnly label="Date" value={draft.holiday_date} onChange={value => setDraft({ ...draft, holiday_date: value })} /><div className="admin-form-field"><Label htmlFor="academic-note">Note (optional)</Label><Input id="academic-note" value={draft.description} maxLength={500} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="e.g. Library closed for the day" /></div></>}
        {datesError && <p role="alert" className="academic-error">{datesError}</p>}{serverError && <p role="alert" className="academic-error">{serverError}</p>}{editor?.item && <Changed item={editor.item} />}
      </fieldset></form>
    </AdminDetailDrawer>
    <AdminDetailDrawer className="academic-drawer" open={importOpen} onClose={() => { if (!pending) void importGuard.confirmDiscard().then(ok => ok && setImportOpen(false)); }} title="Import national holidays" description="Review the 2026 Philippine non-working holidays before adding them." footer={<><span className="academic-footer-status">{selectedDates.length} selected</span><Button variant="outline" disabled={pending} onClick={() => { void importGuard.confirmDiscard().then(ok => ok && setImportOpen(false)); }}>Cancel</Button><Button disabled={pending || !selectedDates.length} onClick={() => void importSelected()}>{pending ? "Importing…" : "Import selected"}</Button></>}>
      <div className="academic-form"><p className="admin-desk-secondary">Based on <a href={holidaySource} target="_blank" rel="noreferrer" className="underline">Proclamation 1006</a>. Separately announced Eid dates can be added manually. Existing dates are skipped, including archived holidays.</p>{nationalHolidays2026.map(holiday => { const exists = collections.holidays.some(item => day((item as api.LibraryHoliday).holiday_date) === holiday.holiday_date); return <label key={holiday.holiday_date} className="academic-import-row"><input type="checkbox" disabled={exists || pending} checked={selectedDates.includes(holiday.holiday_date)} onChange={event => setSelectedDates(event.target.checked ? [...selectedDates, holiday.holiday_date] : selectedDates.filter(date => date !== holiday.holiday_date))} /><span>{holiday.name}<small>{formatAdminDate(holiday.holiday_date, false)}{exists ? " · Already configured" : ""}</small></span></label>; })}{serverError && <p role="alert" className="academic-error">{serverError}</p>}</div>
    </AdminDetailDrawer>
    {confirmDialog}{unsaved.discardDialog}{importGuard.discardDialog}
  </div>;
}

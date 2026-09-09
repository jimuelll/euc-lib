import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Loader2, Plus, Save, Send, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { AdminPanel } from "../components/AdminPage";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import {
  archiveGuideModule,
  createGuideDraft,
  getGuideForEditing,
  publishGuideDraft,
  reorderGuideModules,
  unpublishGuideModule,
  updateGuideDraft,
  type EditableGuideModule,
  type GuideContent,
  type GuideRole,
} from "@/services/user-guide.service";

const blankGuide = (): GuideContent => ({
  slug: "", title: "", category: "General", summary: "", overview: "", target_path: "/admin",
  audience_roles: ["staff", "admin", "super_admin"], before_you_begin: [],
  steps: [{ title: "", body: "" }], warnings: [], troubleshooting: [], image_url: null, image_public_id: null,
});

const asDraft = (item: EditableGuideModule): GuideContent => ({
  slug: item.slug, title: item.title, category: item.category, summary: item.summary,
  overview: item.overview, target_path: item.target_path, audience_roles: [...item.audience_roles],
  before_you_begin: [...item.before_you_begin], steps: item.steps.map((step) => ({ ...step })),
  warnings: [...item.warnings], troubleshooting: item.troubleshooting.map((tip) => ({ ...tip })),
  image_url: item.image_url, image_public_id: item.image_public_id,
});

const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <div className="space-y-2"><Label>{label}</Label>{hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}{children}</div>
);

export default function UserGuideEditor() {
  const [modules, setModules] = useState<EditableGuideModule[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<GuideContent>(blankGuide());
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const { upload, uploading, progress, error: uploadError, reset: resetUpload } = useCloudinaryUpload("library/user-guide");
  const selected = modules.find((item) => item.id === selectedId) || null;

  const load = async (preferredId?: number) => {
    setLoading(true);
    try {
      const items = await getGuideForEditing();
      setModules(items);
      const next = items.find((item) => item.id === preferredId) || items[0] || null;
      setSelectedId(next?.id ?? null);
      setDraft(next ? asDraft(next) : blankGuide());
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Could not load the user guide editor.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const choose = (item: EditableGuideModule) => {
    setSelectedId(item.id);
    setDraft(asDraft(item));
    resetUpload();
  };

  const startNew = () => {
    setSelectedId(null);
    setDraft(blankGuide());
    resetUpload();
  };

  const save = async (quiet = false) => {
    setPending("save");
    try {
      const saved = selectedId
        ? await updateGuideDraft(selectedId, draft)
        : await createGuideDraft(draft);
      await load(saved.id);
      if (!quiet) toast.success("Draft saved. Published readers still see the previous version.");
      return saved;
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Could not save this draft.");
      return null;
    } finally { setPending(""); }
  };

  const publish = async () => {
    setPending("publish");
    const saved = await save(true);
    if (!saved) return;
    setPending("publish");
    try {
      await publishGuideDraft(saved.id);
      await load(saved.id);
      toast.success("Guide module published.");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "The draft was saved, but it could not be published.");
    } finally { setPending(""); }
  };

  const unpublish = async () => {
    if (!selected || !window.confirm(`Hide “${selected.title}” from the user guide? Its draft will be kept.`)) return;
    setPending("unpublish");
    try { await unpublishGuideModule(selected.id); await load(selected.id); toast.success("Module hidden from readers."); }
    catch (err: any) { toast.error(err.response?.data?.message || "Could not hide this module."); }
    finally { setPending(""); }
  };

  const archive = async () => {
    if (!selected || !window.confirm(`Archive “${selected.title}”? It will no longer appear in the editor or guide.`)) return;
    setPending("archive");
    try { await archiveGuideModule(selected.id); await load(); toast.success("Guide module archived."); }
    catch (err: any) { toast.error(err.response?.data?.message || "Could not archive this module."); }
    finally { setPending(""); }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= modules.length) return;
    const previous = modules;
    const reordered = [...modules];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setModules(reordered);
    try { await reorderGuideModules(reordered.map((item) => item.id)); toast.success("Guide order updated."); }
    catch (err: any) { setModules(previous); toast.error(err.response?.data?.message || "Could not change the guide order."); }
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = await upload(file);
    if (result) setDraft((current) => ({ ...current, image_url: result.secure_url, image_public_id: result.public_id }));
    event.target.value = "";
  };

  if (loading) return <AdminPanel><p className="py-10 text-center text-sm text-muted-foreground">Loading guide editor…</p></AdminPanel>;

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <AdminPanel className="self-start" title="Guide modules" actions={<Button size="sm" onClick={startNew}><Plus className="mr-2 h-4 w-4" />New</Button>} contentClassName="p-0">
        <div className="max-h-[44rem] divide-y divide-border overflow-y-auto">
          {modules.map((item, index) => (
            <div key={item.id} className={item.id === selectedId ? "bg-primary/5" : ""}>
              <button type="button" onClick={() => choose(item)} className="w-full px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant={item.is_published ? "default" : "outline"} className="rounded-sm text-[10px]">{item.is_published ? "Published" : "Draft"}</Badge>
                  {item.has_unpublished_changes ? <Badge variant="secondary" className="rounded-sm text-[10px]">New edits</Badge> : null}
                </span>
              </button>
              <div className="flex justify-end gap-1 px-3 pb-2">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} aria-label={`Move ${item.title} up`} onClick={() => void move(index, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === modules.length - 1} aria-label={`Move ${item.title} down`} onClick={() => void move(index, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
          {!modules.length ? <p className="p-5 text-sm text-muted-foreground">No guide modules yet.</p> : null}
        </div>
      </AdminPanel>

      <AdminPanel title={selected ? `Edit: ${selected.title}` : "New guide module"} actions={selected ? <div className="flex items-center gap-2">{selected.is_published ? <Badge className="rounded-sm"><Eye className="mr-1 h-3 w-3" />Live</Badge> : <Badge variant="outline" className="rounded-sm"><EyeOff className="mr-1 h-3 w-3" />Hidden</Badge>}</div> : undefined}>
        <form className="space-y-7" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Module title"><Input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value, slug: selectedId ? draft.slug : event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} placeholder="For example: Circulation" /></Field>
            <Field label="Category"><Input required value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="For example: Daily tasks" /></Field>
          </div>
          <Field label="Short summary" hint="One sentence shown before someone opens this topic."><Input required maxLength={240} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></Field>
          <Field label="Overview" hint="Explain what this module is for in familiar, non-technical words."><Textarea required rows={4} value={draft.overview} onChange={(event) => setDraft({ ...draft, overview: event.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Module link" hint="Optional. Must begin with /admin."><Input value={draft.target_path || ""} onChange={(event) => setDraft({ ...draft, target_path: event.target.value })} placeholder="/admin/catalog" /></Field>
            <Field label="Guide address" hint="A short unique name used by the system."><Input required value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-") })} placeholder="circulation" /></Field>
          </div>

          <Field label="Who should see this module?">
            <div className="flex flex-wrap gap-5 border-y border-border py-3">
              {(["staff", "admin", "super_admin"] as GuideRole[]).map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm capitalize"><Checkbox checked={draft.audience_roles.includes(role)} onCheckedChange={(checked) => setDraft({ ...draft, audience_roles: checked ? [...draft.audience_roles, role] : draft.audience_roles.filter((item) => item !== role) })} />{role.replace("_", " ")}</label>
              ))}
            </div>
          </Field>

          <Field label="Optional example image" hint="Use one clear screenshot that does not show private student information.">
            {draft.image_url ? <div className="relative w-fit"><img src={draft.image_url} alt="Guide module preview" className="max-h-72 border border-border object-contain" /><Button type="button" size="icon" variant="destructive" className="absolute right-2 top-2" aria-label="Remove guide image" onClick={() => setDraft({ ...draft, image_url: null, image_public_id: null })}><X className="h-4 w-4" /></Button></div> : null}
            <label className="inline-flex cursor-pointer items-center border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"><ImagePlus className="mr-2 h-4 w-4" />{draft.image_url ? "Replace image" : "Choose image"}<input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(event) => void uploadImage(event)} /></label>
            {uploading ? <div className="max-w-sm space-y-1"><Progress value={progress} className="h-2" /><p className="text-xs text-muted-foreground">Uploading image… {progress}%</p></div> : null}
            {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
          </Field>

          <StringList title="Before you begin" values={draft.before_you_begin} placeholder="What should the reader prepare?" onChange={(before_you_begin) => setDraft({ ...draft, before_you_begin })} />

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Steps</h3><p className="text-xs text-muted-foreground">At least one complete step is required.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, steps: [...draft.steps, { title: "", body: "" }] })}><Plus className="mr-2 h-4 w-4" />Add step</Button></div>
            {draft.steps.map((step, index) => <div key={index} className="grid gap-3 border border-border p-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto]"><span className="flex h-8 w-8 items-center justify-center bg-muted text-sm font-semibold">{index + 1}</span><div className="space-y-2"><Input aria-label={`Step ${index + 1} title`} value={step.title} placeholder="Step title" onChange={(event) => setDraft({ ...draft, steps: draft.steps.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })} /><Textarea aria-label={`Step ${index + 1} instructions`} rows={3} value={step.body} placeholder="Describe exactly what to do." onChange={(event) => setDraft({ ...draft, steps: draft.steps.map((item, i) => i === index ? { ...item, body: event.target.value } : item) })} /></div><Button type="button" variant="ghost" size="icon" aria-label={`Remove step ${index + 1}`} disabled={draft.steps.length === 1} onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button></div>)}
          </section>

          <StringList title="Important reminders" values={draft.warnings} placeholder="Add a warning or reminder" onChange={(warnings) => setDraft({ ...draft, warnings })} />

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Troubleshooting</h3><p className="text-xs text-muted-foreground">Optional answers to common problems.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, troubleshooting: [...draft.troubleshooting, { problem: "", solution: "" }] })}><Plus className="mr-2 h-4 w-4" />Add answer</Button></div>
            {draft.troubleshooting.map((tip, index) => <div key={index} className="grid gap-3 border border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto]"><div className="space-y-2"><Input aria-label={`Problem ${index + 1}`} value={tip.problem} placeholder="What might go wrong?" onChange={(event) => setDraft({ ...draft, troubleshooting: draft.troubleshooting.map((item, i) => i === index ? { ...item, problem: event.target.value } : item) })} /><Textarea aria-label={`Solution ${index + 1}`} rows={2} value={tip.solution} placeholder="Explain how to fix it." onChange={(event) => setDraft({ ...draft, troubleshooting: draft.troubleshooting.map((item, i) => i === index ? { ...item, solution: event.target.value } : item) })} /></div><Button type="button" variant="ghost" size="icon" aria-label={`Remove troubleshooting answer ${index + 1}`} onClick={() => setDraft({ ...draft, troubleshooting: draft.troubleshooting.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button></div>)}
          </section>

          <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-2 border-t border-border bg-card/95 px-5 py-4 backdrop-blur">
            <Button type="submit" variant="outline" disabled={Boolean(pending) || uploading}>{pending === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save draft</Button>
            <Button type="button" disabled={Boolean(pending) || uploading} onClick={() => void publish()}>{pending === "publish" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Save and publish</Button>
            {selected?.is_published ? <Button type="button" variant="outline" disabled={Boolean(pending)} onClick={() => void unpublish()}><EyeOff className="mr-2 h-4 w-4" />Hide</Button> : null}
            {selected ? <Button type="button" variant="ghost" className="ml-auto text-destructive hover:text-destructive" disabled={Boolean(pending)} onClick={() => void archive()}><Trash2 className="mr-2 h-4 w-4" />Archive</Button> : null}
          </div>
        </form>
      </AdminPanel>
    </div>
  );
}

function StringList({ title, values, placeholder, onChange }: { title: string; values: string[]; placeholder: string; onChange: (items: string[]) => void }) {
  return <section className="space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{title}</h3><Button type="button" size="sm" variant="outline" onClick={() => onChange([...values, ""])}><Plus className="mr-2 h-4 w-4" />Add item</Button></div>{values.map((value, index) => <div key={index} className="flex gap-2"><Input aria-label={`${title} item ${index + 1}`} value={value} placeholder={placeholder} onChange={(event) => onChange(values.map((item, i) => i === index ? event.target.value : item))} /><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${title.toLowerCase()} item ${index + 1}`} onClick={() => onChange(values.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}</section>;
}

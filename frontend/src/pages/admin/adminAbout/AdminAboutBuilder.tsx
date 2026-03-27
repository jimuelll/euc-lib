import { Input }    from "@/components/ui/input";
import { Button }   from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  Divider,
  StringListEditor,
  StaffEditor,
  SpacesEditor,
} from "./components/AdminAboutComponents";
import { useAboutData } from "./AdminAboutData";

const AdminAboutBuilder = () => {
  const { form, setField, loading, saving, handleSubmit } = useAboutData();

  if (loading) {
    return (
      <div className="max-w-2xl py-10 flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-3 w-3 rounded-full bg-warning/60 animate-pulse" />
        Loading about settings…
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-heading text-lg font-bold text-foreground">Edit About Page</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage all content shown on the public-facing About page.
      </p>

      <form className="mt-6 space-y-5 rounded-lg border bg-card p-6" onSubmit={handleSubmit}>

        {/* ── Library Identity ── */}
        <Divider label="Library Identity" />
        <Field label="Library Name">
          <Input
            value={form.library_name}
            onChange={(e) => setField("library_name", e.target.value)}
            placeholder="Enverga-Candelaria Library"
          />
        </Field>

        <hr className="border-border" />

        {/* ── Mission & Vision ── */}
        <Divider label="Mission & Vision" />
        <Field label="Section Title">
          <Input
            value={form.mission_title}
            onChange={(e) => setField("mission_title", e.target.value)}
            placeholder="Empowering Academic Growth"
          />
        </Field>
        <Field label="Mission Text">
          <Textarea
            value={form.mission_text}
            onChange={(e) => setField("mission_text", e.target.value)}
            placeholder="Describe the library's mission and vision…"
            rows={4}
          />
        </Field>

        <hr className="border-border" />

        {/* ── Library History ── */}
        <Divider label="Library History" />
        <Field label="Section Title">
          <Input
            value={form.history_title}
            onChange={(e) => setField("history_title", e.target.value)}
            placeholder="Est. 1975"
          />
        </Field>
        <Field label="History Text">
          <Textarea
            value={form.history_text}
            onChange={(e) => setField("history_text", e.target.value)}
            placeholder="Brief history of the library…"
            rows={4}
          />
        </Field>

        <hr className="border-border" />

        {/* ── Rules & Policies ── */}
        <Divider label="Rules & Policies" />
        <StringListEditor
          label="Borrowing Policies"
          items={form.policies}
          placeholder="e.g. Maximum of 5 books at a time"
          onChange={(v) => setField("policies", v)}
        />

        <hr className="border-border" />

        {/* ── Facilities & Resources ── */}
        <Divider label="Facilities & Resources" />
        <StringListEditor
          label="Facility Items"
          items={form.facilities}
          placeholder="e.g. 3 reading halls with 200+ seating capacity"
          onChange={(v) => setField("facilities", v)}
        />

        <hr className="border-border" />

        {/* ── Staff Directory ── */}
        <Divider label="Staff Directory" />
        <StaffEditor staff={form.staff} onChange={(v) => setField("staff", v)} />

        <hr className="border-border" />

        {/* ── Library Spaces ── */}
        <Divider label="Library Spaces" />
        <SpacesEditor spaces={form.spaces} onChange={(v) => setField("spaces", v)} />

        <hr className="border-border" />

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </form>
    </div>
  );
};

export default AdminAboutBuilder;
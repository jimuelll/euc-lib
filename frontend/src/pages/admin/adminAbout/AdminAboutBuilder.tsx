import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminPage, AdminPanel } from "../components/AdminPage";
import { useAboutData } from "./AdminAboutData";
import {
  Divider,
  Field,
  SpacesEditor,
  StaffEditor,
  StringListEditor,
} from "./components/AdminAboutComponents";

const AdminAboutBuilder = () => {
  const { form, setField, loading, saving, handleSubmit } = useAboutData();

  if (loading) {
    return (
      <div className="flex max-w-2xl items-center gap-2 py-10 text-sm text-muted-foreground">
        <div className="h-3 w-3 animate-pulse rounded-full bg-warning/60" />
        Loading about settings...
      </div>
    );
  }

  return (
    <AdminPage
      eyebrow="Content Management"
      title="Edit About Page"
      description="Manage the content shown on the public About page using clearer sections and a more readable editing surface."
      contentWidth="wide"
    >
      <AdminPanel
        title="About content"
        description="Update the library identity, mission, history, policies, facilities, staff, and spaces before saving changes."
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          <Divider label="Library Identity" />
          <Field label="Library Name">
            <Input
              value={form.library_name}
              onChange={(e) => setField("library_name", e.target.value)}
              placeholder="Enverga-Candelaria Library"
            />
          </Field>

          <hr className="border-border" />

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
              placeholder="Describe the library mission and vision..."
              rows={4}
            />
          </Field>

          <hr className="border-border" />

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
              placeholder="Brief history of the library..."
              rows={4}
            />
          </Field>

          <hr className="border-border" />

          <Divider label="Rules & Policies" />
          <StringListEditor
            label="Borrowing Policies"
            items={form.policies}
            placeholder="e.g. Maximum of 5 books at a time"
            onChange={(v) => setField("policies", v)}
          />

          <hr className="border-border" />

          <Divider label="Facilities & Resources" />
          <StringListEditor
            label="Facility Items"
            items={form.facilities}
            placeholder="e.g. 3 reading halls with 200+ seating capacity"
            onChange={(v) => setField("facilities", v)}
          />

          <hr className="border-border" />

          <Divider label="Staff Directory" />
          <StaffEditor staff={form.staff} onChange={(v) => setField("staff", v)} />

          <hr className="border-border" />

          <Divider label="Library Spaces" />
          <SpacesEditor spaces={form.spaces} onChange={(v) => setField("spaces", v)} />

          <div className="border-t border-border/70 pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </AdminPanel>
    </AdminPage>
  );
};

export default AdminAboutBuilder;

import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Button }   from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, UploadCloud, X } from "lucide-react";
import { useRef } from "react";
import type { StaffMember, LibrarySpace } from "@/services/about.service";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";

// ── Primitives ────────────────────────────────────────────────────────────────

export const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    {children}
  </div>
);

export const Divider = ({ label }: { label: string }) => (
  <div className="pt-2 pb-1">
    <div className="flex items-center gap-3">
      <div className="h-px w-4 bg-warning shrink-0" />
      <p
        className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {label}
      </p>
      <div className="h-px flex-1 bg-border" />
    </div>
  </div>
);

// ── List editors ──────────────────────────────────────────────────────────────

export const StringListEditor = ({
  label, items, placeholder, onChange,
}: {
  label: string; items: string[]; placeholder: string; onChange: (next: string[]) => void;
}) => {
  const update = (i: number, val: string) => { const n = [...items]; n[i] = val; onChange(n); };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add    = () => onChange([...items, ""]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground/40 w-6 shrink-0 text-right"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <Input
              value={item}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-muted-foreground/40 hover:text-destructive transition-colors"
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={add} className="mt-1 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add item
        </Button>
      </div>
    </div>
  );
};

// ── Shared image uploader ─────────────────────────────────────────────────────

const ImageUploader = ({
  imageUrl,
  onUrl,
  alt = "Preview",
}: {
  imageUrl: string;
  onUrl: (url: string) => void;
  alt?: string;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress, error } = useCloudinaryUpload();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const result = await upload(file);
    if (result) onUrl(result.secure_url);
  };

  const handleRemove = () => onUrl("");

  return (
    <div className="space-y-2">
      {imageUrl ? (
        <div className="relative h-32 overflow-hidden rounded-md border border-border group">
          <img
            src={imageUrl}
            alt={alt}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <button
              type="button"
              onClick={handleRemove}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Remove image
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="
            relative w-full rounded-md border-2 border-dashed border-border
            bg-muted/20 hover:bg-muted/40 transition-colors
            flex flex-col items-center justify-center gap-1.5 py-6
            disabled:pointer-events-none disabled:opacity-60
          "
        >
          <UploadCloud className="h-6 w-6 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground">
            {uploading ? `Uploading… ${progress}%` : "Click to upload image"}
          </span>
          {uploading && (
            <div className="absolute bottom-0 left-0 h-0.5 bg-warning transition-all" style={{ width: `${progress}%` }} />
          )}
        </button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
};

// ── Staff editor ──────────────────────────────────────────────────────────────

export const StaffEditor = ({
  staff, onChange,
}: {
  staff: StaffMember[]; onChange: (next: StaffMember[]) => void;
}) => {
  const update = (i: number, field: keyof StaffMember, val: string) =>
    onChange(staff.map((m, idx) => (idx === i ? { ...m, [field]: val } : m)));
  const remove = (i: number) => onChange(staff.filter((_, idx) => idx !== i));
  const add    = () => onChange([...staff, { name: "", role: "", image_url: "" }]);

  return (
    <div className="space-y-2">
      <Label>Staff Members</Label>
      <div className="space-y-2">
        {staff.map((member, i) => (
          <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Staff #{String(i + 1).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-muted-foreground/40 hover:text-destructive transition-colors"
                aria-label="Remove staff member"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={member.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Full name" />
              <Input value={member.role} onChange={(e) => update(i, "role", e.target.value)} placeholder="Job title / role" />
            </div>
            <ImageUploader
              imageUrl={member.image_url ?? ""}
              onUrl={(url) => update(i, "image_url", url)}
              alt={member.name || "Staff photo"}
            />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={add} className="mt-1 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add staff member
        </Button>
      </div>
    </div>
  );
};

// ── Spaces editor ─────────────────────────────────────────────────────────────

export const SpacesEditor = ({
  spaces, onChange,
}: {
  spaces: LibrarySpace[]; onChange: (next: LibrarySpace[]) => void;
}) => {
  const update = (i: number, field: keyof LibrarySpace, val: string) =>
    onChange(spaces.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));
  const remove = (i: number) => onChange(spaces.filter((_, idx) => idx !== i));
  const add    = () => onChange([...spaces, { name: "", description: "", image_url: "" }]);

  return (
    <div className="space-y-2">
      <Label>Library Spaces</Label>
      <div className="space-y-2">
        {spaces.map((space, i) => (
          <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Space #{String(i + 1).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-muted-foreground/40 hover:text-destructive transition-colors"
                aria-label="Remove space"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <Input
              value={space.name}
              onChange={(e) => update(i, "name", e.target.value)}
              placeholder="Space name (e.g. Main Reading Hall)"
            />
            <Textarea
              value={space.description}
              onChange={(e) => update(i, "description", e.target.value)}
              placeholder="Brief description of this space…"
              rows={2}
            />
            <ImageUploader
              imageUrl={space.image_url}
              onUrl={(url) => update(i, "image_url", url)}
              alt={space.name || "Space photo"}
            />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={add} className="mt-1 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add space
        </Button>
      </div>
    </div>
  );
};
import { useState } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import {
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui";
import { toast } from "@/components/ui/sonner";
import { Trash2, Plus, Pencil, X, Check, Eye, EyeOff, Loader2, GripVertical } from "lucide-react";
import { FormField, FieldType, FIELD_TYPES } from "./AdminCatalog.types";

type Props = {
  fields: FormField[];
  onFieldsChange: (fields: FormField[]) => void;
};

const toKey = (label: string) =>
  label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

const inputClass =
  "rounded-none border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:border-primary transition-colors h-9";

// ─── Primitives ───────────────────────────────────────────────────────────────

const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span
    className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${className ?? ""}`}
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {children}
  </span>
);

const PanelLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2.5 px-5 py-3 border-b border-border bg-muted/30">
    <div className="h-px w-4 bg-warning shrink-0" />
    <p
      className="text-[10px] font-bold uppercase tracking-[0.25em] text-foreground"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {children}
    </p>
  </div>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label
    className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 mb-1.5"
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {children}
  </label>
);

// ─── Main component ───────────────────────────────────────────────────────────

const AdminCatalogBuilder = ({ fields, onFieldsChange }: Props) => {
  const [newFieldLabel,    setNewFieldLabel]    = useState("");
  const [newFieldType,     setNewFieldType]     = useState<FieldType>("text");
  const [newFieldOptions,  setNewFieldOptions]  = useState("");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldPublic,   setNewFieldPublic]   = useState(true);
  const [editingFieldKey,  setEditingFieldKey]  = useState<string | null>(null);
  const [editingLabel,     setEditingLabel]     = useState("");
  const [saving,           setSaving]           = useState(false);

  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  const saveSchema = async (updated: FormField[]) => {
    setSaving(true);
    try {
      await axiosInstance.put("api/admin/catalog-schema", { fields: updated });
      toast.success("Schema saved");
      onFieldsChange(updated);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save schema");
    } finally { setSaving(false); }
  };

  const handleAddField = async () => {
    if (!newFieldLabel.trim()) { toast.error("Field label is required"); return; }
    const key = toKey(newFieldLabel);
    if (fields.find((f) => f.key === key)) { toast.error("Field already exists"); return; }
    await saveSchema([
      ...fields,
      {
        key,
        label:    newFieldLabel.trim(),
        type:     newFieldType,
        required: newFieldRequired,
        public:   newFieldPublic,
        order:    fields.length,
        options:
          newFieldType === "select"
            ? newFieldOptions.split(",").map((o) => o.trim()).filter(Boolean)
            : undefined,
      },
    ]);
    setNewFieldLabel(""); setNewFieldType("text");
    setNewFieldOptions(""); setNewFieldRequired(false); setNewFieldPublic(true);
  };

  const handleDeleteField  = (key: string) => saveSchema(fields.filter((f) => f.key !== key));
  const handleSaveLabel    = (key: string) => {
    saveSchema(fields.map((f) => (f.key === key ? { ...f, label: editingLabel } : f)));
    setEditingFieldKey(null);
  };
  const handleTogglePublic = (key: string, current: boolean) =>
    saveSchema(fields.map((f) => (f.key === key ? { ...f, public: !current } : f)));
  const handleMove = (key: string, dir: "up" | "down") => {
    const sorted = [...fields].sort((a, b) => a.order - b.order);
    const idx    = sorted.findIndex((f) => f.key === key);
    const swap   = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= sorted.length) return;
    [sorted[idx].order, sorted[swap].order] = [sorted[swap].order, sorted[idx].order];
    saveSchema([...sorted]);
  };

  return (
    <div className="mt-6 border border-border grid lg:grid-cols-2">

      {/* ── Left: current fields ─────────────────────────────────────── */}
      <div className="border-b lg:border-b-0 lg:border-r border-border">
        <PanelLabel>Current Fields</PanelLabel>

        {/* Column headers */}
        <div className="grid grid-cols-[24px_32px_1fr_auto_auto] gap-x-3 items-center px-5 py-2 border-b border-border bg-muted/20">
          {["", "#", "Label / Key", "Badges", ""].map((h, i) => (
            <span
              key={i}
              className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {h}
            </span>
          ))}
        </div>

        <div className="divide-y divide-border">
          {sortedFields.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p
                className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/35"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                No fields defined
              </p>
            </div>
          ) : (
            sortedFields.map((f, idx) => (
              <div
                key={f.key}
                className="flex items-center gap-3 px-5 py-3 bg-background hover:bg-muted/15 transition-colors"
              >
                {/* Move arrows */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => handleMove(f.key, "up")}
                    disabled={idx === 0 || saving}
                    className="text-[8px] leading-none text-muted-foreground/30 hover:text-foreground disabled:opacity-20 transition-colors"
                  >▲</button>
                  <button
                    onClick={() => handleMove(f.key, "down")}
                    disabled={idx === sortedFields.length - 1 || saving}
                    className="text-[8px] leading-none text-muted-foreground/30 hover:text-foreground disabled:opacity-20 transition-colors"
                  >▼</button>
                </div>

                {/* Index */}
                <span
                  className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground/25 w-5 shrink-0 text-right"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>

                {/* Label — editable */}
                <div className="min-w-0 flex-1">
                  {editingFieldKey === f.key ? (
                    <Input
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      className="rounded-none border-border h-7 text-sm focus-visible:ring-0 focus-visible:border-primary"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveLabel(f.key);
                        if (e.key === "Escape") setEditingFieldKey(null);
                      }}
                    />
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-foreground truncate leading-tight">{f.label}</p>
                      <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">{f.key}</p>
                    </div>
                  )}
                </div>

                {/* Type + flags */}
                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end max-w-[120px]">
                  <Badge className="border-border/60 text-muted-foreground/50 bg-muted/30">{f.type}</Badge>
                  {f.required && (
                    <Badge className="border-destructive/25 text-destructive/70 bg-destructive/5">Req</Badge>
                  )}
                  {f.locked && (
                    <Badge className="border-border text-muted-foreground/30">Locked</Badge>
                  )}
                </div>

                {/* Public toggle */}
                <button
                  onClick={() => handleTogglePublic(f.key, !!f.public)}
                  title={f.public ? "Public — visible in catalogue" : "Hidden from catalogue"}
                  className={`shrink-0 p-1 rounded transition-colors ${
                    f.public
                      ? "text-primary hover:text-primary/60"
                      : "text-muted-foreground/25 hover:text-muted-foreground"
                  }`}
                >
                  {f.public ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>

                {/* Edit / confirm / delete */}
                {!f.locked && (
                  editingFieldKey === f.key ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleSaveLabel(f.key)}
                        className="p-1 text-success hover:text-success/70 transition-colors"
                        title="Save"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingFieldKey(null)}
                        className="p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => { setEditingFieldKey(f.key); setEditingLabel(f.label); }}
                        className="p-1 text-muted-foreground/35 hover:text-foreground transition-colors"
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteField(f.key)}
                        className="p-1 text-muted-foreground/25 hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                )}
              </div>
            ))
          )}
        </div>

        {/* Legend */}
        <div className="border-t border-border px-5 py-2.5 flex items-center gap-2 bg-muted/10">
          <Eye className="h-3 w-3 text-muted-foreground/30 shrink-0" />
          <p className="text-[10px] text-muted-foreground/40 tracking-wide">
            Eye icon = visible in public catalogue
          </p>
        </div>
      </div>

      {/* ── Right: add new field ──────────────────────────────────────── */}
      <div>
        <PanelLabel>Add New Field</PanelLabel>

        <div className="p-5 space-y-5">

          {/* Field Label */}
          <div>
            <FieldLabel>Field Label</FieldLabel>
            <Input
              value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              placeholder="e.g. Publisher"
              className={inputClass}
              onKeyDown={(e) => e.key === "Enter" && handleAddField()}
            />
          </div>

          {/* Field Type */}
          <div>
            <FieldLabel>Field Type</FieldLabel>
            <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as FieldType)}>
              <SelectTrigger className={inputClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border-border">
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="rounded-none text-sm">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Options — select type only */}
          {newFieldType === "select" && (
            <div>
              <FieldLabel>
                Options{" "}
                <span className="normal-case tracking-normal text-muted-foreground/40 font-normal ml-1">
                  (comma-separated)
                </span>
              </FieldLabel>
              <Input
                value={newFieldOptions}
                onChange={(e) => setNewFieldOptions(e.target.value)}
                placeholder="Option A, Option B, Option C"
                className={inputClass}
              />
            </div>
          )}

          {/* Toggles */}
          <div className="flex items-center gap-6 pt-1 border-t border-border/50">
            {[
              { label: "Required", checked: newFieldRequired, onChange: setNewFieldRequired },
              { label: "Public",   checked: newFieldPublic,   onChange: setNewFieldPublic   },
            ].map(({ label, checked, onChange }) => (
              <label key={label} className="flex items-center gap-2.5 cursor-pointer group">
                {/* Sharp custom checkbox */}
                <div className="relative flex items-center shrink-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="h-4 w-4 border border-border bg-background peer-checked:bg-primary peer-checked:border-primary transition-colors flex items-center justify-center">
                    {checked && (
                      <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                      </svg>
                    )}
                  </div>
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground group-hover:text-foreground transition-colors"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {label}
                </span>
              </label>
            ))}
          </div>

          {/* Submit */}
          <button
            onClick={handleAddField}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-primary h-10 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {saving ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
            ) : (
              <><Plus className="h-3.5 w-3.5" /> Add Field</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminCatalogBuilder;
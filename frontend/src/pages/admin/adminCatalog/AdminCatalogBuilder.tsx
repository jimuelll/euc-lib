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
import { useAdminConfirmDialog } from "../components/useAdminConfirmDialog";
import {
  Trash2, Plus, Pencil, X, Check,
  Eye, EyeOff, Loader2, ArchiveRestore, ChevronDown, ChevronUp, Lock, LockOpen,
} from "lucide-react";
import { FormField, FieldType, FIELD_TYPES, MAX_CUSTOM_FIELDS } from "./AdminCatalog.types";

type Props = {
  fields: FormField[];
  onFieldsChange: (fields: FormField[]) => void;
};

const toKey = (label: string) =>
  label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

const inputClass =
  "rounded-none border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:border-primary transition-colors h-9";

const SYSTEM_LOCKED_KEYS = new Set(["title", "author"]);

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
  const [newFieldLabel,     setNewFieldLabel]     = useState("");
  const [newFieldType,      setNewFieldType]      = useState<FieldType>("text");
  const [newFieldOptions,   setNewFieldOptions]   = useState("");
  const [newFieldRequired,  setNewFieldRequired]  = useState(false);
  const [newFieldPublic,    setNewFieldPublic]    = useState(true);
  const [editingFieldKey,   setEditingFieldKey]   = useState<string | null>(null);
  const [editingLabel,      setEditingLabel]      = useState("");
  const [editingOptionsKey, setEditingOptionsKey] = useState<string | null>(null);
  const [editingOptions,    setEditingOptions]    = useState("");
  const [saving,            setSaving]            = useState(false);
  const [showArchivedPanel, setShowArchivedPanel] = useState(false);
  const { confirm, confirmDialog } = useAdminConfirmDialog();

  // Only non-locked, non-archived fields count toward the cap
  const activeCustomFields = fields.filter((f) => !f.locked && !f.archived);
  const customFieldCount   = activeCustomFields.length;
  const atCap              = customFieldCount >= MAX_CUSTOM_FIELDS;

  const sortedFields   = [...fields].filter((f) => !f.archived).sort((a, b) => a.order - b.order);
  const archivedFields = fields.filter((f) => f.archived);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const saveSchema = async (updated: FormField[]) => {
    setSaving(true);
    try {
      await axiosInstance.put("api/admin/catalog-schema", { fields: updated });
      toast.success("Schema saved");
      onFieldsChange(updated);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save schema");
    } finally {
      setSaving(false);
    }
  };

  const handleAddField = async () => {
    if (!newFieldLabel.trim()) { toast.error("Field label is required"); return; }
    if (atCap) {
      toast.error(`Maximum of ${MAX_CUSTOM_FIELDS} custom fields reached. Remove one before adding another.`);
      return;
    }
    const key = toKey(newFieldLabel);
    if (!key || key.length < 2) { toast.error("Label produces an invalid key — try a longer name"); return; }
    if (fields.find((f) => f.key === key && !f.archived)) { toast.error("A field with that name already exists"); return; }

    await saveSchema([
      ...fields,
      {
        key,
        label:    newFieldLabel.trim(),
        type:     newFieldType,
        required: newFieldRequired,
        public:   newFieldPublic,
        order:    fields.length,
        archived: false,
        options:
          newFieldType === "select"
            ? newFieldOptions.split(",").map((o) => o.trim()).filter(Boolean)
            : undefined,
      },
    ]);
    setNewFieldLabel("");
    setNewFieldType("text");
    setNewFieldOptions("");
    setNewFieldRequired(false);
    setNewFieldPublic(true);
  };

  const handleDeleteField = async (key: string) => {
    const shouldDelete = await confirm({
      title: "Archive this field?",
      description: "Existing data in book records will be kept, and you can restore the field later.",
      actionLabel: "Archive Field",
      tone: "danger",
    });
    if (!shouldDelete) return;
    saveSchema(fields.map((f) => (f.key === key ? { ...f, archived: true } : f)));
  };

  const handleRestoreField = (key: string) => {
    if (atCap) {
      toast.error(`Maximum of ${MAX_CUSTOM_FIELDS} custom fields reached. Remove an active field first.`);
      return;
    }
    const maxOrder = Math.max(0, ...fields.filter((f) => !f.archived).map((f) => f.order));
    saveSchema(fields.map((f) => (f.key === key ? { ...f, archived: false, order: maxOrder + 1 } : f)));
  };

  const handleSaveLabel = (key: string) => {
    saveSchema(fields.map((f) => (f.key === key ? { ...f, label: editingLabel } : f)));
    setEditingFieldKey(null);
  };

  const handleStartOptionsEdit = (field: FormField) => {
    setEditingOptionsKey(field.key);
    setEditingOptions((field.options ?? []).join(", "));
  };

  const handleSaveOptions = (key: string) => {
    const nextOptions = editingOptions
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean);

    if (!nextOptions.length) {
      toast.error("Dropdown fields need at least one option");
      return;
    }

    saveSchema(fields.map((f) => (f.key === key ? { ...f, options: nextOptions } : f)));
    setEditingOptionsKey(null);
    setEditingOptions("");
  };

  const handleCancelOptionsEdit = () => {
    setEditingOptionsKey(null);
    setEditingOptions("");
  };

  const handleToggleLocked = (key: string, current: boolean) => {
    if (SYSTEM_LOCKED_KEYS.has(key) && current) {
      toast.error("This field is required by the system and must stay locked.");
      return;
    }
    saveSchema(fields.map((f) => (f.key === key ? { ...f, locked: !current } : f)));
  };

  const handleTogglePublic = (key: string, current: boolean) =>
    saveSchema(fields.map((f) => (f.key === key ? { ...f, public: !current } : f)));

  const handleMove = (key: string, dir: "up" | "down") => {
    const sorted = [...fields].filter((f) => !f.archived).sort((a, b) => a.order - b.order);
    const idx    = sorted.findIndex((f) => f.key === key);
    const swap   = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= sorted.length) return;
    [sorted[idx].order, sorted[swap].order] = [sorted[swap].order, sorted[idx].order];
    const archived = fields.filter((f) => f.archived);
    saveSchema([...sorted, ...archived]);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mt-6 flex w-full flex-col overflow-hidden border border-border">
      {confirmDialog}

      {/* ── Two-column: current fields + add new field ────────────────── */}
      <div className="grid lg:grid-cols-2">

        {/* Left: current fields */}
        <div className="border-b lg:border-b-0 lg:border-r border-border">
          <PanelLabel>Current Fields</PanelLabel>

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
                <div key={f.key}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-5 py-3 bg-background hover:bg-muted/15 transition-colors">
                  {/* Move arrows */}
                  <div className="flex items-center gap-1.5 shrink-0 sm:flex-col sm:gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMove(f.key, "up")}
                      disabled={idx === 0 || saving}
                      className="text-[8px] leading-none text-muted-foreground/30 hover:text-foreground disabled:opacity-20 transition-colors"
                    >▲</button>
                    <button
                      type="button"
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
                  <div className="min-w-0 flex-[1_1_12rem]">
                    {editingFieldKey === f.key ? (
                      <Input
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        className="rounded-none border-border h-7 text-sm focus-visible:ring-0 focus-visible:border-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter")  handleSaveLabel(f.key);
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
                  <div className="flex flex-wrap items-center gap-1 shrink-0 sm:ml-auto sm:justify-end">
                    <Badge className="border-border/60 text-muted-foreground/50 bg-muted/30">{f.type}</Badge>
                    {f.required && <Badge className="border-destructive/25 text-destructive/70 bg-destructive/5">Req</Badge>}
                    {f.locked   && <Badge className="border-border text-muted-foreground/30">Locked</Badge>}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleLocked(f.key, !!f.locked)}
                    disabled={saving || (SYSTEM_LOCKED_KEYS.has(f.key) && !!f.locked)}
                    title={
                      f.locked
                        ? SYSTEM_LOCKED_KEYS.has(f.key)
                          ? "Required by the system"
                          : "Locked from schema changes"
                        : "Unlocked for schema changes"
                    }
                    className={`shrink-0 p-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      f.locked ? "text-muted-foreground/45 hover:text-foreground" : "text-warning hover:text-warning/70"
                    }`}
                  >
                    {f.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                  </button>

                  {/* Public toggle */}
                  <button
                    type="button"
                    onClick={() => handleTogglePublic(f.key, !!f.public)}
                    title={f.public ? "Public — visible in catalogue" : "Hidden from catalogue"}
                    className={`shrink-0 p-1 rounded transition-colors ${
                      f.public ? "text-primary hover:text-primary/60" : "text-muted-foreground/25 hover:text-muted-foreground"
                    }`}
                  >
                    {f.public ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>

                  {/* Edit / delete — non-locked only */}
                  {!f.locked && (
                    editingFieldKey === f.key ? (
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => handleSaveLabel(f.key)} className="p-1 text-success hover:text-success/70 transition-colors" title="Save">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setEditingFieldKey(null)} className="p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors" title="Cancel">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => { setEditingFieldKey(f.key); setEditingLabel(f.label); }}
                          className="p-1 text-muted-foreground/35 hover:text-foreground transition-colors"
                          title="Rename"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {f.type === "select" && (
                          <button
                            type="button"
                            onClick={() => handleStartOptionsEdit(f)}
                            className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/45 hover:text-foreground transition-colors"
                            style={{ fontFamily: "var(--font-heading)" }}
                            title="Edit dropdown options"
                          >
                            Options
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteField(f.key)}
                          className="p-1 text-muted-foreground/25 hover:text-destructive transition-colors"
                          title="Remove field"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  )}
                  </div>

                  {f.type === "select" && editingOptionsKey === f.key && (
                    <div className="border-t border-border/60 bg-muted/10 px-5 py-3">
                      <FieldLabel>
                        Dropdown Options{" "}
                        <span className="normal-case tracking-normal text-muted-foreground/40 font-normal ml-1">
                          (comma-separated)
                        </span>
                      </FieldLabel>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          value={editingOptions}
                          onChange={(e) => setEditingOptions(e.target.value)}
                          className={inputClass}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveOptions(f.key);
                            if (e.key === "Escape") handleCancelOptionsEdit();
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveOptions(f.key)}
                          disabled={saving}
                          className="flex items-center justify-center gap-1.5 border border-success/40 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-success transition-colors hover:bg-success hover:text-success-foreground disabled:opacity-50"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelOptionsEdit}
                          disabled={saving}
                          className="flex items-center justify-center gap-1.5 border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-50"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Legend */}
          <div className="border-t border-border px-5 py-2.5 flex items-center gap-2 bg-muted/10">
            <Eye className="h-3 w-3 text-muted-foreground/30 shrink-0" />
            <p className="text-[10px] text-muted-foreground/40 tracking-wide">
              Eye icon = visible on the public homepage catalogue only
            </p>
          </div>
        </div>

        {/* Right: add new field */}
        <div>
          <PanelLabel>Add New Field</PanelLabel>

          <form
            className="space-y-5 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAddField();
            }}
          >

            {/* Custom field usage counter */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Custom Fields
              </span>
              <span
                className={`text-[10px] font-bold tabular-nums px-2 py-0.5 border ${
                  atCap
                    ? "border-destructive/40 text-destructive bg-destructive/5"
                    : customFieldCount >= MAX_CUSTOM_FIELDS - 3
                    ? "border-warning/40 text-warning bg-warning/5"
                    : "border-border text-muted-foreground/50"
                }`}
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {customFieldCount} / {MAX_CUSTOM_FIELDS}
              </span>
            </div>

            {/* Cap warning */}
            {atCap && (
              <div className="flex items-start gap-2.5 border border-destructive/25 bg-destructive/5 px-3 py-2.5">
                <X className="h-3.5 w-3.5 text-destructive/60 mt-0.5 shrink-0" />
                <p className="text-[10px] text-destructive/80 leading-relaxed">
                  Maximum of {MAX_CUSTOM_FIELDS} custom fields reached. Remove an existing field or restore an archived one to free up a slot.
                </p>
              </div>
            )}

            {/* Field Label */}
            <div>
              <FieldLabel>Field Label</FieldLabel>
              <Input
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="e.g. Publisher"
                className={inputClass}
                disabled={atCap}
                onKeyDown={(e) => e.key === "Enter" && handleAddField()}
              />
              {newFieldLabel.trim() && (
                <p className="mt-1 text-[10px] font-mono text-muted-foreground/40">
                  key: <span className="text-muted-foreground/70">{toKey(newFieldLabel)}</span>
                </p>
              )}
            </div>

            {/* Field Type */}
            <div>
              <FieldLabel>Field Type</FieldLabel>
              <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as FieldType)} disabled={atCap}>
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
                  disabled={atCap}
                />
              </div>
            )}

            {/* Toggles */}
            <div className="flex flex-col gap-3 border-t border-border/50 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3">
              {[
                { label: "Required", checked: newFieldRequired, onChange: setNewFieldRequired },
                { label: "Homepage Catalogue", checked: newFieldPublic, onChange: setNewFieldPublic },
              ].map(({ label, checked, onChange }) => (
                <label
                  key={label}
                  className={`flex items-center gap-2.5 cursor-pointer group ${atCap ? "pointer-events-none opacity-40" : ""}`}
                >
                  <div className="relative flex items-center shrink-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => onChange(e.target.checked)}
                      className="peer sr-only"
                      disabled={atCap}
                    />
                    <div className="flex h-4 w-4 items-center justify-center border border-border bg-background transition-colors peer-checked:border-primary peer-checked:bg-primary">
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
              type="submit"
              disabled={saving || atCap}
              className="w-full flex items-center justify-center gap-2 bg-primary h-10 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {saving
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                : <><Plus className="h-3.5 w-3.5" /> Add Field</>
              }
            </button>
          </form>
        </div>
      </div>

      {/* ── Archived fields panel (full width, below the two-column grid) ── */}
      {archivedFields.length > 0 && (
        <div className="border-t border-border">

          {/* Collapsible toggle */}
          <button
            type="button"
            onClick={() => setShowArchivedPanel((p) => !p)}
            className="flex w-full items-center justify-between gap-3 px-5 py-3 bg-muted/20 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-px w-4 bg-muted-foreground/30 shrink-0" />
              <p
                className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Archived Fields
              </p>
              <span
                className="text-[10px] font-bold tabular-nums border border-border px-1.5 py-0.5 text-muted-foreground/40"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {archivedFields.length}
              </span>
            </div>
            {showArchivedPanel
              ? <ChevronUp   className="h-3.5 w-3.5 text-muted-foreground/40" />
              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
            }
          </button>

          {/* Rows */}
          {showArchivedPanel && (
            <div className="divide-y divide-border border-t border-border">
              {archivedFields.map((f) => (
                <div
                  key={f.key}
                  className="flex flex-col gap-3 px-5 py-3 bg-background opacity-60 transition-opacity hover:opacity-100 sm:flex-row sm:items-center"
                >
                  {/* Label + key */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate leading-tight">{f.label}</p>
                    <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">{f.key}</p>
                  </div>

                  {/* Type badge */}
                  <Badge className="border-border/60 text-muted-foreground/40 bg-muted/20 shrink-0">
                    {f.type}
                  </Badge>

                  {/* Data retained hint */}
                  <p
                    className="text-[10px] text-muted-foreground/40 shrink-0 hidden sm:block"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Data retained
                  </p>

                  {/* Restore */}
                  <button
                    type="button"
                    onClick={() => handleRestoreField(f.key)}
                    disabled={saving || atCap}
                    title={
                      atCap
                        ? `Remove an active field first (${MAX_CUSTOM_FIELDS} max)`
                        : `Restore "${f.label}"`
                    }
                    className="flex items-center gap-1.5 border border-warning/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-warning hover:bg-warning hover:text-warning-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    <ArchiveRestore className="h-3 w-3" />
                    Restore
                  </button>
                </div>
              ))}

              {/* Footer note */}
              <div className="px-5 py-2.5 bg-muted/10">
                <p className="text-[10px] text-muted-foreground/40 tracking-wide">
                  Restoring a field re-adds it to the form. All previously saved data in book records is still intact.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminCatalogBuilder;


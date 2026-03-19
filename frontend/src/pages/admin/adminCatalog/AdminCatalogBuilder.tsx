import { useState } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import {
  Input,
  Label,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui";
import { toast } from "@/components/ui/sonner";
import { Trash2, Plus, Pencil, X, Check } from "lucide-react";
import { FormField, FieldType, FIELD_TYPES } from "./AdminCatalog.types";

type Props = {
  fields: FormField[];
  onFieldsChange: (fields: FormField[]) => void;
};

const toKey = (label: string) =>
  label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

const AdminCatalogBuilder = ({ fields, onFieldsChange }: Props) => {
  const [newFieldLabel, setNewFieldLabel]     = useState("");
  const [newFieldType, setNewFieldType]       = useState<FieldType>("text");
  const [newFieldOptions, setNewFieldOptions] = useState("");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [editingLabel, setEditingLabel]       = useState("");
  const [saving, setSaving]                   = useState(false);

  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  const saveSchema = async (updated: FormField[]) => {
    setSaving(true);
    try {
      await axiosInstance.put("/admin/catalog-schema", { fields: updated });
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
    const key = toKey(newFieldLabel);
    if (fields.find((f) => f.key === key)) { toast.error("Field already exists"); return; }
    await saveSchema([
      ...fields,
      {
        key,
        label: newFieldLabel.trim(),
        type: newFieldType,
        required: newFieldRequired,
        order: fields.length,
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
  };

  const handleDeleteField  = (key: string) =>
    saveSchema(fields.filter((f) => f.key !== key));

  const handleSaveLabel = (key: string) => {
    saveSchema(fields.map((f) => (f.key === key ? { ...f, label: editingLabel } : f)));
    setEditingFieldKey(null);
  };

  const handleMove = (key: string, dir: "up" | "down") => {
    const sorted = [...fields].sort((a, b) => a.order - b.order);
    const idx     = sorted.findIndex((f) => f.key === key);
    const swap    = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= sorted.length) return;
    [sorted[idx].order, sorted[swap].order] = [sorted[swap].order, sorted[idx].order];
    saveSchema([...sorted]);
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">

      {/* ── Left: current fields ── */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Current Fields</h3>
        <div className="space-y-1.5">
          {sortedFields.map((f, idx) => (
            <div
              key={f.key}
              className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-xs"
            >
              {/* Order */}
              <div className="flex flex-col leading-none">
                <button
                  onClick={() => handleMove(f.key, "up")}
                  disabled={idx === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                >▲</button>
                <button
                  onClick={() => handleMove(f.key, "down")}
                  disabled={idx === sortedFields.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                >▼</button>
              </div>

              {/* Label */}
              <div className="min-w-0 flex-1">
                {editingFieldKey === f.key ? (
                  <Input
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    className="h-6 text-xs"
                    autoFocus
                  />
                ) : (
                  <span className="truncate font-medium">{f.label}</span>
                )}
              </div>

              {/* Type badge */}
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                {f.type}
              </span>

              {/* Required badge */}
              {f.required && (
                <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">
                  req
                </span>
              )}

              {/* Locked badge */}
              {f.locked && (
                <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-muted-foreground">
                  locked
                </span>
              )}

              {/* Actions */}
              {!f.locked && (
                editingFieldKey === f.key ? (
                  <>
                    <button onClick={() => handleSaveLabel(f.key)} className="text-green-500 hover:text-green-600">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditingFieldKey(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditingFieldKey(f.key); setEditingLabel(f.label); }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteField(f.key)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: add new field ── */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Add New Field</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Field Label</Label>
            <Input
              value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              placeholder="e.g. Publisher"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Field Type</Label>
            <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as FieldType)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {newFieldType === "select" && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                Options <span className="text-muted-foreground">(comma-separated)</span>
              </Label>
              <Input
                value={newFieldOptions}
                onChange={(e) => setNewFieldOptions(e.target.value)}
                placeholder="Option A, Option B"
                className="h-8 text-sm"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              id="req-check"
              type="checkbox"
              checked={newFieldRequired}
              onChange={(e) => setNewFieldRequired(e.target.checked)}
              className="accent-primary"
            />
            <label htmlFor="req-check" className="text-xs text-foreground">Required field</label>
          </div>

          <Button size="sm" onClick={handleAddField} disabled={saving} className="w-full">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {saving ? "Saving..." : "Add Field"}
          </Button>
        </div>
      </div>

    </div>
  );
};

export default AdminCatalogBuilder;
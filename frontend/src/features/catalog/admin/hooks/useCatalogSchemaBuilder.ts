import { useState } from "react";
import { toast } from "@/components/ui/sonner";
import { useAdminConfirmDialog } from "@/features/admin";
import { FieldType, FieldScope, FormField } from "../AdminCatalog.types";
import { saveCatalogSchema } from "../catalog.api";
import { getApiErrorMessage } from "@/utils/apiError";
import { SYSTEM_LOCKED_KEYS, toKey } from "../components/CatalogBuilderConstants";

type Props = {
  fields: FormField[];
  onFieldsChange: (fields: FormField[]) => void;
};

export const useCatalogSchemaBuilder = ({ fields, onFieldsChange }: Props) => {
  const [newFieldLabel,     setNewFieldLabel]     = useState("");
  const [newFieldType,      setNewFieldType]      = useState<FieldType>("text");
  const [newFieldOptions,   setNewFieldOptions]   = useState("");
  const [newFieldRequired,  setNewFieldRequired]  = useState(false);
  const [newFieldPublic,    setNewFieldPublic]    = useState(true);
  const [newFieldScope,     setNewFieldScope]     = useState<FieldScope>("shared");
  const [scopeTab,          setScopeTab]          = useState<"all" | FieldScope>("all");
  const [editingFieldKey,   setEditingFieldKey]   = useState<string | null>(null);
  const [editingLabel,      setEditingLabel]      = useState("");
  const [editingOptionsKey, setEditingOptionsKey] = useState<string | null>(null);
  const [editingOptions,    setEditingOptions]    = useState("");
  const [saving,            setSaving]            = useState(false);
  const [showArchivedPanel, setShowArchivedPanel] = useState(false);
  const { confirm, confirmDialog } = useAdminConfirmDialog();

  // Keep this count for administrators' reference. Catalog fields are unlimited.
  const activeCustomFields = fields.filter((f) => !f.locked && !f.archived);
  const customFieldCount   = activeCustomFields.length;

  const sortedFields   = [...fields].filter((f) => !f.archived && (scopeTab === "all" || (f.scope ?? "shared") === scopeTab)).sort((a, b) => a.order - b.order);
  const archivedFields = fields.filter((f) => f.archived);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const saveSchema = async (updated: FormField[]) => {
    setSaving(true);
    try {
      await saveCatalogSchema(updated, fields);
      toast.success("Schema saved");
      onFieldsChange(updated);
      return true;
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to save schema"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAddField = async () => {
    if (!newFieldLabel.trim()) { toast.error("Field label is required"); return; }
    const key = toKey(newFieldLabel);
    if (!key || key.length < 2) { toast.error("Label produces an invalid key — try a longer name"); return; }
    if (fields.find((f) => f.key === key)) { toast.error("A field with that name already exists. Restore the archived field instead."); return; }

    const saved = await saveSchema([
      ...fields,
      {
        key,
        label:    newFieldLabel.trim(),
        type:     newFieldType,
        required: newFieldRequired,
        public:   newFieldPublic,
        order:    fields.length,
        archived: false,
        scope: newFieldScope,
        options:
          newFieldType === "select"
            ? newFieldOptions.split(",").map((o) => o.trim()).filter(Boolean)
            : undefined,
      },
    ]);
    if (!saved) return;
    setNewFieldLabel("");
    setNewFieldType("text");
    setNewFieldOptions("");
    setNewFieldRequired(false);
    setNewFieldPublic(true);
    setNewFieldScope("shared");
  };

  const handleDeleteField = async (key: string) => {
    const shouldDelete = await confirm({
      title: "Archive this field?",
      description: "Existing catalog-record data will be kept, and you can restore the field later.",
      actionLabel: "Archive Field",
      tone: "danger",
    });
    if (!shouldDelete) return;
    saveSchema(fields.map((f) => (f.key === key ? { ...f, archived: true } : f)));
  };

  const handleRestoreField = (key: string) => {
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

  // Scope controls where an existing field renders; changing it never changes
  // the JSON key or discards values already saved on catalog records.
  const handleScopeChange = (key: string, scope: FieldScope) =>
    saveSchema(fields.map((f) => (f.key === key ? { ...f, scope } : f)));

  const handleMove = (key: string, dir: "up" | "down") => {
    const sorted = fields.filter((f) => !f.archived && (scopeTab === "all" || (f.scope ?? "shared") === scopeTab)).map((f) => ({ ...f })).sort((a, b) => a.order - b.order);
    const idx    = sorted.findIndex((f) => f.key === key);
    const swap   = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= sorted.length) return;
    [sorted[idx].order, sorted[swap].order] = [sorted[swap].order, sorted[idx].order];
    const orders = new Map(sorted.map((field) => [field.key, field.order]));
    saveSchema(fields.map((field) => orders.has(field.key) ? { ...field, order: orders.get(field.key)! } : field));
  };


  return {
    fields,
    confirmDialog,
    newFieldLabel, setNewFieldLabel,
    newFieldType, setNewFieldType,
    newFieldOptions, setNewFieldOptions,
    newFieldRequired, setNewFieldRequired,
    newFieldPublic, setNewFieldPublic,
    newFieldScope, setNewFieldScope,
    scopeTab, setScopeTab,
    editingFieldKey, setEditingFieldKey,
    editingLabel, setEditingLabel,
    editingOptionsKey, setEditingOptionsKey,
    editingOptions, setEditingOptions,
    saving,
    showArchivedPanel, setShowArchivedPanel,
    activeCustomFields, customFieldCount, sortedFields, archivedFields,
    saveSchema, handleAddField, handleDeleteField, handleRestoreField, handleSaveLabel,
    handleStartOptionsEdit, handleSaveOptions, handleCancelOptionsEdit,
    handleToggleLocked, handleTogglePublic, handleScopeChange, handleMove,
  };
};

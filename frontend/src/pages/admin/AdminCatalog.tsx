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
import { Textarea } from "@/components/ui/textarea";
import { GripVertical, Trash2, Plus, Pencil, X, Check } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType = "text" | "number" | "date" | "select" | "textarea";

type FormField = {
  key: string;           // snake_case column / setting key
  label: string;         // display label
  type: FieldType;
  options?: string[];    // only for "select" type
  required?: boolean;
  locked?: boolean;      // built-in fields can't be deleted
  order: number;
};

type Book = {
  id: number;
  title: string;
  author?: string;
  category?: string;
  isbn?: string;
  edition?: string;
  publication_year?: number;
  copies?: number;
  [key: string]: any;    // custom fields
};

// ─── Default locked fields ────────────────────────────────────────────────────

const DEFAULT_FIELDS: FormField[] = [
  { key: "title",            label: "Book Title",       type: "text",   required: true, locked: true, order: 0 },
  { key: "author",           label: "Author",           type: "text",   locked: true,   order: 1 },
  { key: "isbn",             label: "ISBN",             type: "text",   locked: true,   order: 2 },
  { key: "category",        label: "Category",         type: "select", locked: true,   order: 3,
    options: ["Computer Science","Engineering","Mathematics","Science","Literature","History","Business","Other"] },
  { key: "edition",          label: "Edition",          type: "text",   locked: true,   order: 4 },
  { key: "publication_year", label: "Publication Year", type: "number", locked: true,   order: 5 },
  { key: "copies",           label: "Copies",           type: "number", locked: true,   order: 6 },
];

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text",     label: "Text" },
  { value: "number",   label: "Number" },
  { value: "date",     label: "Date" },
  { value: "select",   label: "Dropdown" },
  { value: "textarea", label: "Textarea" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toKey = (label: string) =>
  label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

// ─── Sub-component: renders a single field input ──────────────────────────────

const FieldInput = ({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: any;
  onChange: (key: string, value: any) => void;
}) => {
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          rows={3}
        />
      );
    case "select":
      return (
        <Select value={value ?? ""} onValueChange={(v) => onChange(field.key, v)}>
          <SelectTrigger><SelectValue placeholder={`Select ${field.label}`} /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "number":
      return (
        <Input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          min={field.key === "copies" ? 0 : undefined}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      );
    default:
      return (
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      );
  }
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AdminCatalog = () => {
  const [mode, setMode] = useState<"catalog" | "builder">("catalog");
  const [catalogMode, setCatalogMode] = useState<"create" | "edit">("create");

  // Form schema state
  const [fields, setFields] = useState<FormField[]>(DEFAULT_FIELDS);

  // Builder state
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const [newFieldOptions, setNewFieldOptions] = useState("");   // comma-separated for select
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [schemaLoading, setSchemaLoading] = useState(false);

  // Book form values (dynamic)
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  // Search / edit state
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // ── Field value helpers ──────────────────────────────────────────────────────

  const setField = (key: string, value: any) =>
    setFormValues((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setFormValues({});
    setSelectedBook(null);
  };

  // ── Schema (builder) operations ──────────────────────────────────────────────

  const handleAddField = async () => {
    if (!newFieldLabel.trim()) {
      toast.error("Field label is required");
      return;
    }
    const key = toKey(newFieldLabel);
    if (fields.find((f) => f.key === key)) {
      toast.error("A field with that name already exists");
      return;
    }
    const newField: FormField = {
      key,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      order: fields.length,
      options:
        newFieldType === "select"
          ? newFieldOptions.split(",").map((o) => o.trim()).filter(Boolean)
          : undefined,
    };
    const updated = [...fields, newField];
    setFields(updated);
    setNewFieldLabel("");
    setNewFieldType("text");
    setNewFieldOptions("");
    setNewFieldRequired(false);
    await saveSchema(updated);
  };

  const handleDeleteField = async (key: string) => {
    const updated = fields.filter((f) => f.key !== key);
    setFields(updated);
    await saveSchema(updated);
  };

  const handleSaveLabel = async (key: string) => {
    const updated = fields.map((f) =>
      f.key === key ? { ...f, label: editingLabel } : f
    );
    setFields(updated);
    setEditingFieldKey(null);
    await saveSchema(updated);
  };

  const handleMoveField = async (key: string, direction: "up" | "down") => {
    const sorted = [...fields].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((f) => f.key === key);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    [sorted[idx].order, sorted[swapIdx].order] = [sorted[swapIdx].order, sorted[idx].order];
    setFields([...sorted]);
    await saveSchema(sorted);
  };

  const saveSchema = async (updated: FormField[]) => {
    setSchemaLoading(true);
    try {
      await axiosInstance.put("/admin/catalog-schema", { fields: updated });
      toast.success("Form schema saved");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save schema");
    } finally {
      setSchemaLoading(false);
    }
  };

  // ── Book CRUD ────────────────────────────────────────────────────────────────

  const handleCreateBook = async () => {
    const required = fields.filter((f) => f.required);
    for (const f of required) {
      if (!formValues[f.key]) {
        toast.error(`${f.label} is required`);
        return;
      }
    }
    setLoading(true);
    try {
      const res = await axiosInstance.post("/admin/books", formValues);
      toast.success(res.data.message);
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to add book");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchBooks = async () => {
    if (!searchQuery.trim()) {
      toast.error("Enter a title, author, or ISBN to search");
      return;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.get("/admin/books", {
        params: { query: searchQuery },
      });
      setSearchResults(res.data);
      if (!res.data.length) toast.info("No books found");
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBook = async () => {
    if (!selectedBook) return;
    const required = fields.filter((f) => f.required);
    for (const f of required) {
      if (!formValues[f.key]) {
        toast.error(`${f.label} is required`);
        return;
      }
    }
    setLoading(true);
    try {
      const res = await axiosInstance.put(`/admin/books/${selectedBook.id}`, formValues);
      toast.success(res.data.message);
      resetForm();
      setSearchResults([]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async () => {
    if (!selectedBook) return;
    if (!confirm(`Are you sure you want to delete "${selectedBook.title}"?`)) return;
    setLoading(true);
    try {
      const res = await axiosInstance.delete(`/admin/books/${selectedBook.id}`);
      toast.success(res.data.message);
      resetForm();
      setSearchResults((prev) => prev.filter((b) => b.id !== selectedBook.id));
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const selectBookForEdit = (b: Book) => {
    setSelectedBook(b);
    const vals: Record<string, any> = {};
    fields.forEach((f) => { vals[f.key] = b[f.key] ?? ""; });
    setFormValues(vals);
  };

  // ── Sorted fields for rendering ───────────────────────────────────────────────

  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl">
      <h2 className="font-heading text-lg font-bold text-foreground">Catalog Management</h2>
      <p className="mt-1 text-sm text-muted-foreground">Add, edit, or remove books from the catalog.</p>

      {/* Top-level mode toggle */}
      <div className="mt-4 flex gap-2">
        <Button
          variant={mode === "catalog" ? "default" : "outline"}
          onClick={() => setMode("catalog")}
        >
          Catalog
        </Button>
        <Button
          variant={mode === "builder" ? "default" : "outline"}
          onClick={() => setMode("builder")}
        >
          Form Builder
        </Button>
      </div>

      {/* ── FORM BUILDER ─────────────────────────────────────────────────────── */}
      {mode === "builder" && (
        <div className="mt-6 space-y-6">

          {/* Existing fields list */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 font-semibold text-foreground">Current Fields</h3>
            <div className="space-y-2">
              {sortedFields.map((f, idx) => (
                <div
                  key={f.key}
                  className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {/* Drag handle / order buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMoveField(f.key, "up")}
                      disabled={idx === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMoveField(f.key, "down")}
                      disabled={idx === sortedFields.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Label (editable for non-locked) */}
                  <div className="flex-1">
                    {editingFieldKey === f.key ? (
                      <Input
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium">{f.label}</span>
                    )}
                  </div>

                  {/* Type badge */}
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {f.type}
                  </span>

                  {/* Required badge */}
                  {f.required && (
                    <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                      required
                    </span>
                  )}

                  {/* Locked badge */}
                  {f.locked && (
                    <span className="rounded bg-accent px-2 py-0.5 text-xs text-muted-foreground">
                      locked
                    </span>
                  )}

                  {/* Edit / confirm label */}
                  {!f.locked && (
                    editingFieldKey === f.key ? (
                      <button onClick={() => handleSaveLabel(f.key)} className="text-green-500 hover:text-green-600">
                        <Check className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => { setEditingFieldKey(f.key); setEditingLabel(f.label); }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )
                  )}

                  {/* Cancel edit */}
                  {editingFieldKey === f.key && (
                    <button onClick={() => setEditingFieldKey(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}

                  {/* Delete (non-locked only) */}
                  {!f.locked && (
                    <button
                      onClick={() => handleDeleteField(f.key)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add new field */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 font-semibold text-foreground">Add New Field</h3>
            <div className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Field Label</Label>
                  <Input
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    placeholder="e.g. Publisher"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Field Type</Label>
                  <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as FieldType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newFieldType === "select" && (
                <div className="space-y-2">
                  <Label>Options <span className="text-muted-foreground text-xs">(comma-separated)</span></Label>
                  <Input
                    value={newFieldOptions}
                    onChange={(e) => setNewFieldOptions(e.target.value)}
                    placeholder="Option A, Option B, Option C"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  id="required-check"
                  type="checkbox"
                  checked={newFieldRequired}
                  onChange={(e) => setNewFieldRequired(e.target.checked)}
                  className="accent-primary"
                />
                <label htmlFor="required-check" className="text-sm text-foreground">
                  Required field
                </label>
              </div>

              <Button onClick={handleAddField} disabled={schemaLoading}>
                <Plus className="mr-2 h-4 w-4" />
                {schemaLoading ? "Saving..." : "Add Field"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── CATALOG ──────────────────────────────────────────────────────────── */}
      {mode === "catalog" && (
        <>
          {/* Sub-mode selector */}
          <div className="mt-4">
            <Label>Mode</Label>
            <Select value={catalogMode} onValueChange={(v) => { setCatalogMode(v as any); resetForm(); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="create">Add Book</SelectItem>
                <SelectItem value="edit">Edit / Search / Delete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Create form */}
          {catalogMode === "create" && (
            <form
              className="mt-6 space-y-4 rounded-lg border bg-card p-6"
              onSubmit={(e) => { e.preventDefault(); handleCreateBook(); }}
            >
              {sortedFields.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label>
                    {f.label}
                    {f.required && <span className="ml-1 text-destructive">*</span>}
                  </Label>
                  <FieldInput field={f} value={formValues[f.key]} onChange={setField} />
                </div>
              ))}
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Adding..." : "Add Book"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>
                  Clear Form
                </Button>
              </div>
            </form>
          )}

          {/* Edit / search / delete */}
          {catalogMode === "edit" && (
            <>
              <div className="mt-6 flex gap-2">
                <Input
                  placeholder="Search by title, author, or ISBN"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchBooks()}
                />
                <Button onClick={handleSearchBooks} disabled={loading}>
                  {loading ? "Searching..." : "Search"}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-lg border bg-card p-4">
                  <table className="w-full text-left text-sm text-foreground">
                    <thead>
                      <tr>
                        <th className="px-3 py-2">Title</th>
                        <th className="px-3 py-2">Author</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Copies</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map((b) => (
                        <tr
                          key={b.id}
                          className="border-t cursor-pointer hover:bg-accent/20"
                          onClick={() => selectBookForEdit(b)}
                        >
                          <td className="px-3 py-2">{b.title}</td>
                          <td className="px-3 py-2">{b.author || "—"}</td>
                          <td className="px-3 py-2">{b.category || "—"}</td>
                          <td className="px-3 py-2">{b.copies ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedBook && (
                <form
                  className="mt-6 space-y-4 rounded-lg border bg-card p-6"
                  onSubmit={(e) => { e.preventDefault(); handleUpdateBook(); }}
                >
                  <h3 className="font-semibold text-foreground">Editing: {selectedBook.title}</h3>
                  {sortedFields.map((f) => (
                    <div key={f.key} className="space-y-2">
                      <Label>
                        {f.label}
                        {f.required && <span className="ml-1 text-destructive">*</span>}
                      </Label>
                      <FieldInput field={f} value={formValues[f.key]} onChange={setField} />
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Updating..." : "Update Book"}
                    </Button>
                    <Button type="button" variant="destructive" onClick={handleDeleteBook} disabled={loading}>
                      {loading ? "Deleting..." : "Delete Book"}
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default AdminCatalog;
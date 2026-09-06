import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import type { Book, BookType, CatalogFormValue, CatalogFormValues, FormField } from "../AdminCatalog.types";
import FieldInput from "./FieldInput";

type Props = {
  book: Book;
  fields: FormField[];
  values: CatalogFormValues;
  errors: Record<string, string>;
  bookTypes: BookType[];
  loading: boolean;
  barcodeStrip?: React.ReactNode;
  onFieldChange: (key: string, value: CatalogFormValue) => void;
  onUpdate: () => void;
  onArchive: () => void;
  onDeselect: () => void;
};

const FormLabel = ({ children, htmlFor, required = false }: { children: React.ReactNode; htmlFor?: string; required?: boolean }) => (
  <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>
    {children}{required && <span className="ml-1 text-destructive">*</span>}
  </label>
);

export default function CatalogEditForm({
  book, fields, values, errors, bookTypes, loading, barcodeStrip,
  onFieldChange, onUpdate, onArchive, onDeselect,
}: Props) {
  const materialType = book.material_type === "thesis" ? "thesis" : "book";
  const materialLabel = materialType === "book" ? "Book" : "Thesis";
  const visibleFields = fields
    .filter((field) => !field.archived)
    .sort((a, b) => a.order - b.order)
    .filter((field) => (field.scope ?? "shared") === "shared" || field.scope === materialType);

  return (
    <div className="admin-panel-surface admin-etched-border mt-5 border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-3">
        <p className="text-base font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>Editing</p>
        <span className="max-w-[220px] truncate text-sm text-muted-foreground">{book.title}</span>
      </div>
      <div className="p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          {materialType === "book" && (
            <div>
              <FormLabel required>Loan policy</FormLabel>
              <Select value={String(values.book_type_id ?? "")} onValueChange={(value) => onFieldChange("book_type_id", value)}>
                <SelectTrigger aria-invalid={Boolean(errors.book_type_id)} aria-describedby={errors.book_type_id ? "edit-book-type-error" : undefined} className={errors.book_type_id ? "border-destructive" : undefined}>
                  <SelectValue placeholder="Select the loan and fine policy" />
                </SelectTrigger>
                <SelectContent>{bookTypes.map((type) => <SelectItem key={type.id} value={String(type.id)}>{type.name}</SelectItem>)}</SelectContent>
              </Select>
              {errors.book_type_id && <p id="edit-book-type-error" className="mt-1 text-sm text-destructive" role="alert">{errors.book_type_id}</p>}
            </div>
          )}
          {visibleFields.map((field) => (
            <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
              <FormLabel required={field.required} htmlFor={`edit-field-${field.key}`}>{field.label}</FormLabel>
              <FieldInput id={`edit-field-${field.key}`} field={field} value={values[field.key]} onChange={onFieldChange} error={errors[field.key]} />
              {errors[field.key] && <p id={`edit-field-${field.key}-error`} className="mt-1 text-sm text-destructive" role="alert">{errors[field.key]}</p>}
            </div>
          ))}
        </div>

        {barcodeStrip}

        <div className="mt-6 flex flex-wrap gap-2.5 border-t border-border pt-5">
          <button onClick={onUpdate} disabled={loading} className="flex min-h-11 items-center gap-2 bg-primary px-5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors" style={{ fontFamily: "var(--font-heading)" }}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</> : `Update ${materialLabel}`}
          </button>
          <button onClick={onArchive} disabled={loading} className="flex min-h-11 items-center gap-2 border border-destructive/40 px-4 text-[11px] font-bold uppercase tracking-[0.18em] text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 transition-colors" style={{ fontFamily: "var(--font-heading)" }}>
            <Trash2 className="h-4 w-4" /> {loading ? "Archiving…" : `Archive ${materialLabel}`}
          </button>
          <button onClick={onDeselect} disabled={loading} className="ml-auto flex min-h-11 items-center gap-2 border border-border px-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50 transition-colors" style={{ fontFamily: "var(--font-heading)" }}>
            <RefreshCw className="h-4 w-4" /> Deselect
          </button>
        </div>
      </div>
    </div>
  );
}

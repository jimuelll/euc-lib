import { Library, Loader2, Search, FileText, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { SegmentedNavigation } from "../../components/SegmentedNavigation";
import type { BookType, CatalogFormValue, CatalogFormValues, FormField } from "../AdminCatalog.types";
import FieldInput from "./FieldInput";

type MaterialType = "book" | "thesis";

type Props = {
  fields: FormField[];
  materialType: MaterialType;
  values: CatalogFormValues;
  errors: Record<string, string>;
  bookTypes: BookType[];
  loading: boolean;
  isbnLookup: boolean;
  onMaterialChange: (materialType: MaterialType) => void;
  onFieldChange: (key: string, value: CatalogFormValue) => void;
  onLookupIsbn: () => void;
  onSubmit: () => void;
  onClear: () => void;
  inSheet?: boolean;
};

const FormLabel = ({ children, htmlFor, required = false }: { children: React.ReactNode; htmlFor?: string; required?: boolean }) => (
  <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>
    {children}{required && <span className="ml-1 text-destructive">*</span>}
  </label>
);

export default function CatalogCreateForm({
  fields, materialType, values, errors, bookTypes, loading, isbnLookup,
  onMaterialChange, onFieldChange, onLookupIsbn, onSubmit, onClear, inSheet = false,
}: Props) {
  const fieldsForMaterial = fields
    .filter((field) => !field.archived)
    .sort((a, b) => a.order - b.order)
    .filter((field) => (field.scope ?? "shared") === "shared" || field.scope === materialType)
    .filter((field) => field.key !== "isbn");
  const materialLabel = materialType === "book" ? "Book" : "Thesis";
  const isbnError = errors.isbn;

  return (
    <div className={inSheet ? "" : "admin-panel-surface admin-etched-border mt-5 border border-border bg-card"}>
      {!inSheet && <div className="border-b border-border bg-muted/30 px-5 py-3">
        <p className="text-base font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>New {materialLabel} Entry</p>
      </div>}
      <div className={inSheet ? "py-5" : "p-5"}>
        <div className="mb-5">
          <SegmentedNavigation
            ariaLabel="Material type"
            value={materialType}
            onChange={onMaterialChange}
            segments={[{ value: "book", label: "Book", icon: Library }, { value: "thesis", label: "Thesis", icon: FileText }]}
          />
        </div>

        {materialType === "book" ? (
          <div className="mb-5 border border-warning/30 bg-warning/5 p-4">
            <FormLabel htmlFor="create-isbn">ISBN</FormLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="create-isbn"
                value={values.isbn ?? ""}
                onChange={(event) => onFieldChange("isbn", event.target.value)}
                placeholder="ISBN-10 or ISBN-13"
                aria-invalid={Boolean(isbnError)}
                aria-describedby={isbnError ? "create-isbn-error" : undefined}
                className={`min-h-11 min-w-0 flex-1 border bg-background px-3 text-base sm:text-sm ${isbnError ? "border-destructive" : "border-border"}`}
              />
              <button type="button" onClick={onLookupIsbn} disabled={isbnLookup} className="flex min-h-11 shrink-0 items-center justify-center gap-2 bg-primary px-4 text-[11px] font-bold uppercase tracking-[0.15em] text-primary-foreground disabled:opacity-50">
                {isbnLookup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Look up
              </button>
            </div>
            {isbnError && <p id="create-isbn-error" className="mt-2 text-sm text-destructive" role="alert">{isbnError}</p>}
          </div>
        ) : (
          <div className="mb-5 border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-foreground">
            Theses are reference-only. They appear in the catalogue but cannot be borrowed or reserved.
          </div>
        )}

        {materialType === "book" && (
          <div className="mb-5">
            <FormLabel required>Loan policy</FormLabel>
            <Select value={String(values.book_type_id ?? "")} onValueChange={(value) => onFieldChange("book_type_id", value)}>
              <SelectTrigger aria-invalid={Boolean(errors.book_type_id)} aria-describedby={errors.book_type_id ? "book-type-error" : undefined} className={errors.book_type_id ? "border-destructive" : undefined}>
                <SelectValue placeholder="Select the loan and fine policy" />
              </SelectTrigger>
              <SelectContent>{bookTypes.map((type) => <SelectItem key={type.id} value={String(type.id)}>{type.name} — {type.default_borrow_days} days, PHP {Number(type.initial_fine ?? 0).toFixed(2)} + PHP {Number(type.fine_per_hour).toFixed(2)}/{type.fine_interval ?? "hour"}</SelectItem>)}</SelectContent>
            </Select>
            {errors.book_type_id && <p id="book-type-error" className="mt-1 text-sm text-destructive" role="alert">{errors.book_type_id}</p>}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {fieldsForMaterial.map((field) => (
            <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
              <FormLabel required={field.required} htmlFor={`create-field-${field.key}`}>{field.label}</FormLabel>
              <FieldInput id={`create-field-${field.key}`} field={field} value={values[field.key]} onChange={onFieldChange} error={errors[field.key]} />
              {errors[field.key] && <p id={`create-field-${field.key}-error`} className="mt-1 text-sm text-destructive" role="alert">{errors[field.key]}</p>}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2.5 border-t border-border pt-5">
          <button onClick={onSubmit} disabled={loading} className="flex min-h-11 items-center gap-2 bg-primary px-5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors" style={{ fontFamily: "var(--font-heading)" }}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</> : <>{materialType === "book" ? <Library className="h-4 w-4" /> : <FileText className="h-4 w-4" />} Add {materialLabel}</>}
          </button>
          <button onClick={onClear} disabled={loading} className="flex min-h-11 items-center gap-2 border border-border px-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50 transition-colors" style={{ fontFamily: "var(--font-heading)" }}>
            <RefreshCw className="h-4 w-4" /> Clear
          </button>
        </div>
      </div>
    </div>
  );
}

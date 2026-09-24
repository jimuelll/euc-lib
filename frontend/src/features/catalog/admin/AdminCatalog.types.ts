export type FieldType = "text" | "number" | "date" | "select" | "textarea" | "repeatable";
export type FieldScope = "shared" | "book" | "thesis";

export type FormField = {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  locked?: boolean;
  public?: boolean;
  order: number;
  archived?: boolean; // soft-removed fields returned by getSchema({ includeArchived: true })
  /** Which material form renders this definition. Shared fields render on both. */
  scope?: FieldScope;
};

export type Book = {
  id: number;
  title: string;
  author?: string;
  category?: string;
  isbn?: string;
  edition?: string;
  publication_year?: number;
  copies?: number;
  accessioned_copies?: number;
  unaccessioned_copies?: number;
  voided_copies?: number;
  available?: number;
  total_copies?: number;
  deleted_at?: string | null;
  material_type?: "book" | "thesis";
  book_type_id?: number | string;
  needs_policy?: boolean | number;
  metadata?: Record<string, CatalogFormValue>;
  canBorrow?: boolean;
  canReserve?: boolean;
  [key: string]: unknown;
};

export type CatalogFormValue = string | string[] | number | boolean | null | undefined;
export type CatalogFormValues = Record<string, CatalogFormValue>;

export type BookType = {
  id: number;
  name: string;
  default_borrow_days: number;
  loan_duration_minutes: number;
  loan_duration_unit: "day" | "hour";
  fine_per_hour: number;
  fine_interval?: "hour" | "day";
  initial_fine?: number;
  is_active?: number | boolean;
  assigned_active_books?: number;
  assigned_archived_books?: number;
};

export type CatalogPagination = { page: number; limit: number; total: number; totalPages: number };

export const DEFAULT_FIELDS: FormField[] = [
  { key: "title",            label: "Title",            type: "text",   required: true, locked: true, public: true, order: 0, scope: "shared" },
  { key: "author",           label: "Author",           type: "text",   required: true, locked: true, public: true, order: 1, scope: "shared" },
  { key: "isbn",             label: "ISBN",             type: "text",   public: true,   order: 2 },
  { key: "publisher",        label: "Publisher",        type: "text",       public: true,  order: 3, scope: "book" },
  { key: "publication_place",label: "Publication Place",type: "text",       public: true,  order: 4, scope: "book" },
  { key: "copyright_year",   label: "Copyright Year",   type: "number",     public: true,  order: 5, scope: "book" },
  { key: "edition",          label: "Edition",          type: "text",       public: true,  order: 6, scope: "book" },
  { key: "physical_description", label: "Physical Description", type: "textarea", public: true, order: 7, scope: "book" },
  { key: "call_number",      label: "Call Number",      type: "text",       public: false, order: 8, scope: "book" },
  { key: "subjects",         label: "Subjects",         type: "repeatable", public: true,  order: 9, scope: "book" },
  { key: "added_title",      label: "Added Title",      type: "text",       public: true,  order: 10, scope: "book" },
  { key: "series_title",     label: "Series Title",     type: "text",       public: true,  order: 11, scope: "book" },
  { key: "added_authors",    label: "Added Authors",    type: "repeatable", public: true,  order: 12, scope: "book" },
  { key: "editors",          label: "Editors",          type: "repeatable", public: true,  order: 13, scope: "book" },
  { key: "coordinators",     label: "Coordinators",     type: "repeatable", public: true,  order: 14, scope: "book" },
  { key: "consultants",      label: "Consultants",      type: "repeatable", public: true,  order: 15, scope: "book" },
  { key: "contributors",     label: "Contributors",     type: "repeatable", public: true,  order: 16, scope: "book" },
  { key: "illustrators",     label: "Illustrators",     type: "repeatable", public: true,  order: 17, scope: "book" },
  { key: "copies",           label: "Copies",           type: "number",     public: true,  order: 18, scope: "book" },
  { key: "location",         label: "Location",         type: "text",       public: false, order: 19, scope: "book" },
];

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text",     label: "Text" },
  { value: "number",   label: "Number" },
  { value: "date",     label: "Date" },
  { value: "select",   label: "Dropdown" },
  { value: "textarea", label: "Textarea" },
  { value: "repeatable", label: "Repeatable list" },
];


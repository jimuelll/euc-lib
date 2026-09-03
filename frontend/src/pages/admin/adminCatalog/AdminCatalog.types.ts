export type FieldType = "text" | "number" | "date" | "select" | "textarea";

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
  material_type?: "book" | "thesis";
  book_type_id?: number | string;
  [key: string]: unknown;
};

export type CatalogFormValue = string | number | boolean | null | undefined;
export type CatalogFormValues = Record<string, CatalogFormValue>;

export type BookType = {
  id: number;
  name: string;
  default_borrow_days: number;
  fine_per_hour: number;
  fine_interval?: "hour" | "day";
  initial_fine?: number;
};

export type CatalogPagination = { page: number; limit: number; total: number; totalPages: number };

export const DEFAULT_FIELDS: FormField[] = [
  { key: "title",            label: "Book Title",       type: "text",   required: true, locked: true, public: true, order: 0 },
  { key: "author",           label: "Author",           type: "text",   required: true, locked: true, public: true, order: 1 },
  { key: "isbn",             label: "ISBN",             type: "text",   public: true,   order: 2 },
  { key: "category",         label: "Category",         type: "select", public: true,   order: 3,
    options: ["Computer Science","Engineering","Mathematics","Science","Literature","History","Business","Other"] },
  { key: "copies",           label: "Copies",           type: "number", public: true,   order: 4 },
  { key: "location",         label: "Location",         type: "text",   public: false,  order: 5 },
  { key: "edition",          label: "Edition",          type: "text",   public: true,   order: 6 },
  { key: "publication_year", label: "Publication Year", type: "number", public: true,   order: 7 },
];

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text",     label: "Text" },
  { value: "number",   label: "Number" },
  { value: "date",     label: "Date" },
  { value: "select",   label: "Dropdown" },
  { value: "textarea", label: "Textarea" },
];

/** Must stay in sync with MAX_CUSTOM_FIELDS in catalog.service.js */
export const MAX_CUSTOM_FIELDS = 15;

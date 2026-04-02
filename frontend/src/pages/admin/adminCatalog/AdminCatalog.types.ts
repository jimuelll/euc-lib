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
  [key: string]: any;
};

export const DEFAULT_FIELDS: FormField[] = [
  { key: "title",            label: "Book Title",       type: "text",   required: true, locked: true, public: true, order: 0 },
  { key: "author",           label: "Author",           type: "text",   required: true, locked: true, public: true, order: 1 },
  { key: "isbn",             label: "ISBN",             type: "text",   public: true,   order: 2 },
  { key: "category",         label: "Category",         type: "select", public: true,   order: 3,
    options: ["Computer Science","Engineering","Mathematics","Science","Literature","History","Business","Other"] },
  { key: "copies",           label: "Copies",           type: "number", public: true,   order: 4 },
  { key: "location",         label: "Location",         type: "text",   public: false,  order: 5 },
  { key: "edition",          label: "Edition",          type: "text",   public: true,   order: 6, archived: true },
  { key: "publication_year", label: "Publication Year", type: "number", public: true,   order: 7, archived: true },
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

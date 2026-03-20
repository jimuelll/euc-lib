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
  { key: "author",           label: "Author",           type: "text",   locked: true,   public: true, order: 1 },
  { key: "isbn",             label: "ISBN",             type: "text",   locked: true,   public: true, order: 2 },
  { key: "category",         label: "Category",         type: "select", locked: true,   public: true, order: 3,
    options: ["Computer Science","Engineering","Mathematics","Science","Literature","History","Business","Other"] },
  { key: "edition",          label: "Edition",          type: "text",   locked: true,   public: true, order: 4 },
  { key: "publication_year", label: "Publication Year", type: "number", locked: true,   public: true, order: 5 },
  { key: "copies",           label: "Copies",           type: "number", locked: true,   public: true, order: 6 },
];

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text",     label: "Text" },
  { value: "number",   label: "Number" },
  { value: "date",     label: "Date" },
  { value: "select",   label: "Dropdown" },
  { value: "textarea", label: "Textarea" },
];
import axiosInstance from "@/utils/AxiosInstance";
import type { Book, BookType, CatalogFormValues, CatalogPagination, FormField } from "./AdminCatalog.types";

type MessageResponse = { message: string };
export type IsbnMetadata = { isbn?: string; title?: string; author?: string; publisher?: string; edition?: string; publication_year?: string | number };
export type CatalogSearchResponse = { rows: Book[]; pagination: CatalogPagination };

export async function fetchCatalogSchema(): Promise<FormField[]> {
  const response = await axiosInstance.get<unknown[]>("api/admin/catalog-schema", { params: { includeArchived: "true" } });
  return response.data.map(toFormField);
}

function toFormField(value: unknown): FormField {
  const source = value as Partial<FormField> & { options?: string | string[] };
  return {
    key: String(source.key ?? ""), label: String(source.label ?? ""), type: source.type ?? "text",
    options: typeof source.options === "string" ? JSON.parse(source.options) : source.options,
    required: Boolean(source.required), locked: Boolean(source.locked), public: Boolean(source.public),
    archived: Boolean(source.archived), order: Number(source.order ?? 0), scope: source.scope ?? "shared",
  };
}

export async function saveCatalogSchema(fields: FormField[], baseFields: FormField[]): Promise<void> {
  await axiosInstance.put("api/admin/catalog-schema", { fields, baseFields });
}
export async function fetchBookTypes(): Promise<BookType[]> { return (await axiosInstance.get<BookType[]>("api/admin/book-types")).data; }
export async function lookupBookIsbn(isbn: string): Promise<IsbnMetadata> { return (await axiosInstance.get<IsbnMetadata>(`api/admin/books/isbn/${encodeURIComponent(isbn)}`)).data; }
export async function createCatalogBook(values: CatalogFormValues): Promise<MessageResponse> { return (await axiosInstance.post<MessageResponse>("api/admin/books", values)).data; }
export async function updateCatalogBook(id: number, values: CatalogFormValues): Promise<MessageResponse> { return (await axiosInstance.put<MessageResponse>(`api/admin/books/${id}`, values)).data; }
export async function archiveCatalogBook(id: number): Promise<MessageResponse> { return (await axiosInstance.delete<MessageResponse>(`api/admin/books/${id}`)).data; }
export async function restoreCatalogBook(id: number): Promise<MessageResponse> { return (await axiosInstance.post<MessageResponse>(`api/admin/books/${id}/restore`)).data; }
export async function searchCatalogBooks(params: { query: string; materialType: "all" | "book" | "thesis"; page: number; status: "active" | "archived" | "all" }): Promise<CatalogSearchResponse> {
  const response = await axiosInstance.get<Book[] | CatalogSearchResponse>("api/admin/books", { params: { query: params.query, materialType: params.materialType, status: params.status, page: params.page, limit: 25 } });
  const payload = response.data;
  const rows = Array.isArray(payload) ? payload : payload.rows;
  return { rows, pagination: Array.isArray(payload) ? { page: 1, limit: rows.length, total: rows.length, totalPages: 1 } : payload.pagination };
}
export type CatalogCopy = { id: number; barcode: string; condition: "good" | "damaged" | "lost"; is_active: number; status: "available" | "borrowed" | "reserved" };
export async function fetchCatalogBookCopies(bookId: number): Promise<CatalogCopy[]> { return (await axiosInstance.get<CatalogCopy[]>(`api/admin/books/${bookId}/copies`)).data; }
export async function fetchCatalogBarcode(barcode: string): Promise<string> { const response = await axiosInstance.get(`api/admin/copies/${encodeURIComponent(barcode)}/barcode-png`, { responseType: "blob" }); return URL.createObjectURL(response.data); }
export async function updateCatalogCopyCondition(copyId: number, condition: CatalogCopy["condition"]): Promise<void> { await axiosInstance.patch(`api/admin/copies/${copyId}`, { condition }); }
export type EmbeddingStatus = { total: number; ready: number; stale: number; failed: number; errors?: Array<{ bookId: number; message: string }> };
export type EmbeddingBackfillProgress = { status: "idle" | "running" | "completed" | "completed_with_errors"; total: number; completed: number; embedded: number; failed: number; skipped: number; currentTitle: string | null; errors: string[]; alreadyRunning?: boolean };
export async function fetchEmbeddingStatus(): Promise<EmbeddingStatus> { return (await axiosInstance.get<EmbeddingStatus>("api/admin/recommendations/embeddings/status")).data; }
export async function backfillEmbeddings(): Promise<EmbeddingBackfillProgress> { return (await axiosInstance.post<EmbeddingBackfillProgress>("api/admin/recommendations/embeddings/backfill")).data; }
export async function fetchBackfillProgress(): Promise<EmbeddingBackfillProgress> { return (await axiosInstance.get<EmbeddingBackfillProgress>("api/admin/recommendations/embeddings/backfill/progress")).data; }

import axiosInstance from "@/utils/AxiosInstance";
import type { Book, BookType, CatalogFormValues, CatalogPagination, FormField } from "./AdminCatalog.types";
export type { BookType } from "./AdminCatalog.types";

type MessageResponse = { message: string };
export type IsbnMetadata = { isbn?: string; title?: string; author?: string; publisher?: string; edition?: string; copyright_year?: string | number; publication_place?: string; physical_description?: string; subjects?: string[] };
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
export async function createBookType(payload: { name: string; default_borrow_days?: number; loan_duration_minutes: number; loan_duration_unit: "hour" | "day"; fine_per_hour: number; fine_interval: "hour" | "day"; initial_fine: number }): Promise<void> { await axiosInstance.post("api/admin/book-types", payload); }
export async function updateBookType(id: number, payload: BookType): Promise<void> { await axiosInstance.put(`api/admin/book-types/${id}`, payload); }
export type DeleteBookTypeResult = { id: number; name: string; active_books: number; archived_books: number; affected_books: number; message: string };
export async function deleteBookType(id: number): Promise<DeleteBookTypeResult> { return (await axiosInstance.delete<DeleteBookTypeResult>(`api/admin/book-types/${id}`)).data; }
export async function lookupBookIsbn(isbn: string): Promise<IsbnMetadata> { return (await axiosInstance.get<IsbnMetadata>(`api/admin/books/isbn/${encodeURIComponent(isbn)}`)).data; }
export async function createCatalogBook(values: CatalogFormValues): Promise<MessageResponse> { return (await axiosInstance.post<MessageResponse>("api/admin/books", values)).data; }
export async function updateCatalogBook(id: number, values: CatalogFormValues): Promise<MessageResponse> { return (await axiosInstance.put<MessageResponse>(`api/admin/books/${id}`, values)).data; }
export type CatalogBookImage = { image_url: string; image_public_id: string };
export async function uploadCatalogBookImage(id: number, file: File, onProgress?: (progress: number) => void): Promise<CatalogBookImage> {
  const formData = new FormData();
  formData.append("image", file);
  return (await axiosInstance.post<CatalogBookImage>(`api/admin/books/${id}/image`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => { if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100)); },
  })).data;
}
export async function removeCatalogBookImage(id: number): Promise<void> {
  await axiosInstance.delete(`api/admin/books/${id}/image`);
}
export async function archiveCatalogBook(id: number): Promise<MessageResponse> { return (await axiosInstance.delete<MessageResponse>(`api/admin/books/${id}`)).data; }
export async function restoreCatalogBook(id: number): Promise<MessageResponse> { return (await axiosInstance.post<MessageResponse>(`api/admin/books/${id}/restore`)).data; }
export async function searchCatalogBooks(params: { query: string; materialType: "all" | "book" | "thesis"; page: number; status: "active" | "archived" | "all"; policyStatus?: "all" | "needs_policy" }): Promise<CatalogSearchResponse> {
  const response = await axiosInstance.get<Book[] | CatalogSearchResponse>("api/admin/books", { params: { query: params.query, materialType: params.materialType, status: params.status, policyStatus: params.policyStatus ?? "all", page: params.page, limit: 25 } });
  const payload = response.data;
  const rows = Array.isArray(payload) ? payload : payload.rows;
  return { rows, pagination: Array.isArray(payload) ? { page: 1, limit: rows.length, total: rows.length, totalPages: 1 } : payload.pagination };
}
export type CatalogCopy = { id: number; barcode: string; accession_number?: string | null; accession_voided?: number | boolean; borrow_eligible?: number | boolean; needs_policy?: number | boolean; condition: "good" | "damaged" | "lost"; is_active: number; status: "available" | "borrowed" | "reserved" };
export async function fetchCatalogBookCopies(bookId: number): Promise<CatalogCopy[]> { return (await axiosInstance.get<CatalogCopy[]>(`api/admin/books/${bookId}/copies`)).data; }
export async function fetchCatalogBarcode(barcode: string): Promise<string> { const response = await axiosInstance.get(`api/admin/copies/${encodeURIComponent(barcode)}/barcode-png`, { responseType: "blob" }); return URL.createObjectURL(response.data); }
export async function updateCatalogCopyCondition(copyId: number, condition: CatalogCopy["condition"]): Promise<void> { await axiosInstance.patch(`api/admin/copies/${copyId}`, { condition }); }
export async function retireCatalogCopy(copyId: number): Promise<{ copies: number }> { return (await axiosInstance.post<{ copies: number }>(`api/admin/copies/${copyId}/retire`)).data; }
export async function restoreCatalogCopy(copyId: number): Promise<{ copies: number; lendingEligible: boolean }> { return (await axiosInstance.post<{ copies: number; lendingEligible: boolean }>(`api/admin/copies/${copyId}/restore`)).data; }
export type CatalogCopyDetails = CatalogCopy & { title?: string; author?: string; due_date?: string; borrower_name?: string; notes?: string };
export async function fetchCatalogCopy(barcode: string): Promise<CatalogCopyDetails> { return (await axiosInstance.get<CatalogCopyDetails>(`api/admin/copies/${encodeURIComponent(barcode)}`)).data; }
export type CatalogSettings = { show_unheld_in_opac: boolean; updated_at?: string | null };
export async function fetchCatalogSettings(): Promise<CatalogSettings> { return (await axiosInstance.get<CatalogSettings>("api/admin/catalog-settings")).data; }
export async function saveCatalogSettings(showUnheldInOpac: boolean): Promise<CatalogSettings> { return (await axiosInstance.put<{ settings: CatalogSettings }>("api/admin/catalog-settings", { show_unheld_in_opac: showUnheldInOpac })).data.settings; }
export type CatalogHolding = {
  copy_id: number; book_id: number; barcode: string; condition: "good" | "damaged" | "lost"; is_active: number;
  title: string; author?: string | null; isbn?: string | null; book_type?: string | null; needs_policy?: number | boolean; program_is_active?: number | boolean;
  accession_number: string | null; accession_voided?: number | boolean; price: number | string | null; program_id: number | null; course: string | null;
  course_code: string | null; location: string | null; date_acquired: string | null; distributor: string | null;
  invoice_reference: string | null; circulation_status: "available" | "borrowed" | "reserved";
  borrow_eligible?: boolean | number;
  due_date?: string | null; borrower_name?: string | null; has_active_loan?: number | boolean; has_ready_reservation?: number | boolean;
};
export type CatalogHoldingsResponse = { rows: CatalogHolding[]; total: number; page: number; limit: number; pagination: CatalogPagination };
export async function fetchBookHoldings(bookId: number): Promise<CatalogHolding[]> { return (await axiosInstance.get<CatalogHolding[]>(`api/admin/books/${bookId}/holdings`)).data; }
export async function fetchCatalogHoldings(params: { query?: string; programId?: number; status?: string; completion?: string; page?: number }): Promise<CatalogHoldingsResponse> {
  return (await axiosInstance.get<CatalogHoldingsResponse>("api/admin/holdings", { params: { ...params, limit: 25 } })).data;
}
export async function saveCopyHolding(copyId: number, payload: { accession_number: string; price: string; program_id: string; course_code: string; location: string; date_acquired: string; distributor: string; invoice_reference: string }): Promise<void> {
  await axiosInstance.put(`api/admin/copies/${copyId}/holding`, payload);
}
export async function voidCopyAccession(copyId: number, payload: { reason: string }): Promise<{ accessionNumber: string }> {
  return (await axiosInstance.post<{ accessionNumber: string }>(`api/admin/copies/${copyId}/holding/void-accession`, payload)).data;
}
export type EmbeddingStatus = { total: number; ready: number; stale: number; failed: number; errors?: Array<{ bookId: number; message: string }> };
export type EmbeddingBackfillProgress = { status: "idle" | "running" | "completed" | "completed_with_errors"; total: number; completed: number; embedded: number; failed: number; skipped: number; currentTitle: string | null; errors: string[]; alreadyRunning?: boolean };
export async function fetchEmbeddingStatus(): Promise<EmbeddingStatus> { return (await axiosInstance.get<EmbeddingStatus>("api/admin/recommendations/embeddings/status")).data; }
export async function backfillEmbeddings(): Promise<EmbeddingBackfillProgress> { return (await axiosInstance.post<EmbeddingBackfillProgress>("api/admin/recommendations/embeddings/backfill")).data; }
export async function fetchBackfillProgress(): Promise<EmbeddingBackfillProgress> { return (await axiosInstance.get<EmbeddingBackfillProgress>("api/admin/recommendations/embeddings/backfill/progress")).data; }
export type ManualMetadataBook = { id: number; title: string; author?: string | null; isbn?: string | null; source: string | null; metadataStatus: "missing" | "failed" | "ready" | "manual"; embeddingStatus: string };
export type ManualMetadataBooksResponse = { rows: ManualMetadataBook[]; pagination: CatalogPagination };
export type ManualBookMetadata = {
  book: Pick<ManualMetadataBook, "id" | "title" | "author" | "isbn">;
  summary: string;
  subjects: string[];
  additionalDetails: { publisher: string; categories: string[]; language: string; pageCount: number | string | null; publishedDate: string };
  source: string | null;
  metadataStatus: "missing" | "failed" | "ready" | "manual";
  embeddingStatus: string;
  embeddingError: string | null;
};
export type SaveManualBookMetadataResponse = { metadataStatus: "manual"; embeddingStatus: "ready" | "failed"; summary: string; subjects: string[]; additionalDetails: ManualBookMetadata["additionalDetails"]; embeddingError: string | null };
export async function fetchManualMetadataBooks(params: { query?: string; needsAttention?: boolean; page?: number }): Promise<ManualMetadataBooksResponse> {
  return (await axiosInstance.get<ManualMetadataBooksResponse>("api/admin/recommendations/books", { params: { q: params.query || "", needsAttention: params.needsAttention ? "true" : "false", page: params.page || 1, limit: 25 } })).data;
}
export async function fetchManualBookMetadata(bookId: number): Promise<ManualBookMetadata> {
  return (await axiosInstance.get<ManualBookMetadata>(`api/admin/recommendations/books/${bookId}/metadata`)).data;
}
export async function saveManualBookMetadata(bookId: number, payload: { summary: string; subjects: string[]; additionalDetails: ManualBookMetadata["additionalDetails"] }): Promise<SaveManualBookMetadataResponse> {
  return (await axiosInstance.put<SaveManualBookMetadataResponse>(`api/admin/recommendations/books/${bookId}/metadata`, payload)).data;
}

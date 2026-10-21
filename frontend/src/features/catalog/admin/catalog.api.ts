import axiosInstance from "@/utils/AxiosInstance";
import type { Book, BookType, CatalogFormValues, CatalogPagination, FormField } from "./AdminCatalog.types";
export type { BookType } from "./AdminCatalog.types";

type MessageResponse = { message: string };
export type IsbnMetadata = { isbn?: string; title?: string; author?: string; publisher?: string; edition?: string; copyright_year?: string | number; publication_place?: string; physical_description?: string; subjects?: string[]; description?: string };
export type CatalogSearchResponse = { rows: Book[]; pagination: CatalogPagination; summary?: { active: number; archived: number; needsHoldings: number; all: number } };

export async function fetchCatalogSchema(signal?: AbortSignal): Promise<FormField[]> {
  const response = await axiosInstance.get<unknown[]>("api/admin/catalog-schema", { params: { includeArchived: "true" }, signal });
  return response.data.map(toFormField);
}

function toFormField(value: unknown): FormField {
  const source = value as Partial<FormField> & { options?: string | string[]; archived_options?: string | string[] };
  return {
    key: String(source.key ?? ""), label: String(source.label ?? ""), type: source.type ?? "text",
    options: typeof source.options === "string" ? JSON.parse(source.options) : source.options,
    archived_options: typeof source.archived_options === "string" ? JSON.parse(source.archived_options) : source.archived_options||[],
    required: Boolean(source.required), locked: Boolean(source.locked), public: Boolean(source.public),
    archived: Boolean(source.archived), order: Number(source.order ?? 0), scope: source.scope ?? "shared",
  };
}

export async function saveCatalogSchema(fields: FormField[], baseFields: FormField[], deleteKeys:string[]=[]): Promise<void> {
  await axiosInstance.put("api/admin/catalog-schema", { fields, baseFields, deleteKeys });
}
export type FieldUsage={archivedBy?:string;archivedAt?:string;used:number;activeUsed?:number;archivedUsed?:number;bookUsed:number;thesisUsed:number;missingBooks:number;missingTheses:number;publicUsed:number;options:Record<string,number>};
export type ConfigurationImpact={fields:Record<string,FieldUsage>;activeRecords?:{book:number;thesis:number};unheldBooks:number;generatedAt:string};
export async function fetchConfigurationImpact(signal?:AbortSignal):Promise<ConfigurationImpact>{return (await axiosInstance.get<ConfigurationImpact>('api/admin/catalog-schema/impact',{signal})).data;}
export async function fetchBookTypes(signal?: AbortSignal): Promise<BookType[]> { return (await axiosInstance.get<BookType[]>("api/admin/book-types", { signal })).data; }
export async function createBookType(payload: { name: string; default_borrow_days?: number; loan_duration_minutes: number; loan_duration_unit: "hour" | "day"; fine_per_hour: number; fine_interval: "hour" | "day"; initial_fine: number }): Promise<BookType> { return (await axiosInstance.post<BookType>("api/admin/book-types", payload)).data; }
export async function updateBookType(id: number, payload: BookType & {reason?:string}): Promise<BookType> { return (await axiosInstance.put<BookType>(`api/admin/book-types/${id}`, payload)).data; }
export type DeleteBookTypeResult = { id: number; name: string; active_books: number; archived_books: number; affected_books: number; message: string };
export async function deleteBookType(id: number): Promise<DeleteBookTypeResult> { return (await axiosInstance.delete<DeleteBookTypeResult>(`api/admin/book-types/${id}`)).data; }
export async function lookupBookIsbn(isbn: string): Promise<IsbnMetadata> { return (await axiosInstance.get<IsbnMetadata>(`api/admin/books/isbn/${encodeURIComponent(isbn)}`)).data; }
export async function createCatalogBook(values: CatalogFormValues): Promise<MessageResponse & { id: number }> { return (await axiosInstance.post<MessageResponse & { id: number }>("api/admin/books", values)).data; }
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
export async function searchCatalogBooks(params: { query: string; materialType: "all" | "book" | "thesis"; page: number; status: "active" | "archived" | "all"; policyStatus?: "all" | "needs_policy"; holdingStatus?: "all" | "needs"; uncategorized?:boolean; fieldKey?:string; fieldUsage?:"used"|"missing"; unheld?:boolean; bookId?: number; bookTypeId?:number; limit?: number }, signal?: AbortSignal): Promise<CatalogSearchResponse> {
  const response = await axiosInstance.get<Book[] | CatalogSearchResponse>("api/admin/books", { params: { query: params.query, materialType: params.materialType, status: params.status, policyStatus: params.policyStatus ?? "all", holdingStatus: params.holdingStatus, uncategorized:params.uncategorized, fieldKey:params.fieldKey,fieldUsage:params.fieldUsage,unheld:params.unheld, bookId: params.bookId,bookTypeId:params.bookTypeId, page: params.page, limit: params.limit ?? 25 }, signal });
  const payload = response.data;
  const rows = Array.isArray(payload) ? payload : payload.rows;
  return { rows, summary: Array.isArray(payload) ? undefined : payload.summary, pagination: Array.isArray(payload) ? { page: 1, limit: rows.length, total: rows.length, totalPages: 1 } : payload.pagination };
}
export type CatalogCopy = { id: number; barcode: string; accession_number?: string | null; accession_voided?: number | boolean; borrow_eligible?: number | boolean; needs_policy?: number | boolean; condition: "good" | "damaged" | "lost" | "weeded" | "discarded"; is_active: number; status: "available" | "borrowed" | "reserved" };
export async function addCatalogCopies(bookId:number,count:number):Promise<{message:string;copies:number}>{return (await axiosInstance.post(`api/admin/books/${bookId}/copies`,{count})).data;}
export async function fetchCatalogBookCopies(bookId: number, signal?: AbortSignal): Promise<CatalogCopy[]> { return (await axiosInstance.get<CatalogCopy[]>(`api/admin/books/${bookId}/copies`, { signal })).data; }
export async function fetchCatalogBarcode(barcode: string): Promise<string> { const response = await axiosInstance.get(`api/admin/copies/${encodeURIComponent(barcode)}/barcode-png`, { responseType: "blob" }); return URL.createObjectURL(response.data); }
export async function updateCatalogCopyCondition(copyId: number, condition: CatalogCopy["condition"]): Promise<void> { await axiosInstance.patch(`api/admin/copies/${copyId}`, { condition }); }
export async function retireCatalogCopy(copyId: number): Promise<{ copies: number }> { return (await axiosInstance.post<{ copies: number }>(`api/admin/copies/${copyId}/retire`)).data; }
export async function restoreCatalogCopy(copyId: number): Promise<{ copies: number; lendingEligible: boolean }> { return (await axiosInstance.post<{ copies: number; lendingEligible: boolean }>(`api/admin/copies/${copyId}/restore`)).data; }
export type CatalogCopyDetails = CatalogCopy & { title?: string; author?: string; due_date?: string; borrower_name?: string; notes?: string };
export async function fetchCatalogCopy(barcode: string, signal?: AbortSignal): Promise<CatalogCopyDetails> { return (await axiosInstance.get<CatalogCopyDetails>(`api/admin/copies/${encodeURIComponent(barcode)}`, { signal })).data; }
export type CatalogSettings = { show_unheld_in_opac: boolean; updated_at?: string | null };
export async function fetchCatalogSettings(signal?: AbortSignal): Promise<CatalogSettings> { return (await axiosInstance.get<CatalogSettings>("api/admin/catalog-settings", { signal })).data; }
export async function saveCatalogSettings(showUnheldInOpac: boolean): Promise<CatalogSettings> { return (await axiosInstance.put<{ settings: CatalogSettings }>("api/admin/catalog-settings", { show_unheld_in_opac: showUnheldInOpac })).data.settings; }
export type CatalogHolding = {
  copy_id: number; book_id: number; barcode: string; condition: "good" | "damaged" | "lost" | "weeded" | "discarded"; is_active: number;
  title: string; author?: string | null; isbn?: string | null; book_type?: string | null; needs_policy?: number | boolean; program_is_active?: number | boolean;
  accession_number: string | null; accession_voided?: number | boolean; price: number | string | null; program_id: number | null; course: string | null;
  course_code: string | null; location: string | null; date_acquired: string | null; distributor: string | null;
  invoice_reference: string | null; circulation_status: "available" | "borrowed" | "reserved";
  borrow_eligible?: boolean | number;
  due_date?: string | null; borrower_name?: string | null; has_active_loan?: number | boolean; has_ready_reservation?: number | boolean;
};
export type CatalogHoldingsResponse = { rows: CatalogHolding[]; total: number; page: number; limit: number; pagination: CatalogPagination; summary?: Record<string,number> };
export async function fetchBookHoldings(bookId: number, signal?: AbortSignal): Promise<CatalogHolding[]> { return (await axiosInstance.get<CatalogHolding[]>(`api/admin/books/${bookId}/holdings`, { signal })).data; }
export async function fetchCatalogHoldings(params: { query?: string; programId?: number; bookId?: number; status?: string; completion?: string; page?: number }, signal?: AbortSignal): Promise<CatalogHoldingsResponse> {
  return (await axiosInstance.get<CatalogHoldingsResponse>("api/admin/holdings", { params: { ...params, limit: 25 }, signal })).data;
}
export async function saveCopyHolding(copyId: number, payload: { accession_number: string; price: string; program_id: string; course_code: string; location: string; date_acquired: string; distributor: string; invoice_reference: string }): Promise<void> {
  await axiosInstance.put(`api/admin/copies/${copyId}/holding`, payload);
}
export async function voidCopyAccession(copyId: number, payload: { reason: string }): Promise<{ accessionNumber: string }> {
  return (await axiosInstance.post<{ accessionNumber: string }>(`api/admin/copies/${copyId}/holding/void-accession`, payload)).data;
}
export type BackfillOptions={scope:"attention"|"synopses"|"embeddings"|"selected"|"all";limit:number;bookIds?:number[];retryFailures:boolean};
export type BackfillPreview={total:number;missingSynopses?:number;synopsisLookups:number;embeddings:number;estimatedSeconds:number|null};
export type ProviderConfiguration={model:string;gemini:boolean;openLibrary:boolean;googleBooks:boolean;googleBooksKey:boolean;hardcover:boolean};
export type EmbeddingStatus = {updatedAt?:string;lastBackfill?:EmbeddingBackfillProgress;providers?:ProviderConfiguration; total: number; ready: number; stale: number; failed: number; missing: number; missingSynopses: number; missingDetails?:number; needsAttention: number; errors?: Array<{ bookId: number; message: string }> };
export type EmbeddingBackfillProgress = { status: "idle" | "running" | "completed" | "completed_with_errors" | "paused_rate_limited" | "cancelled" | "interrupted";runId?:string;actorName?:string;auditEventId?:number;startedAt?:string;finishedAt?:string;cancelRequested?:boolean;succeeded?:number;skipped?:number;failedBooks?:number;scope?:string;providers?:string[];auditError?:string; total: number; completed: number; missingSynopses: number; embedded: number; synopsesAdded: number; synopsesNotFound: number; failed: number; lookupFailed: number; deferred: number; rateLimitRetryAt: string | null; currentTitle: string | null; errors: string[]; lookupErrors?: string[]; alreadyRunning?: boolean };
export async function fetchEmbeddingStatus(signal?: AbortSignal): Promise<EmbeddingStatus> { return (await axiosInstance.get<EmbeddingStatus>("api/admin/recommendations/embeddings/status", { signal })).data; }
export async function backfillEmbeddings(options?:BackfillOptions): Promise<EmbeddingBackfillProgress> { return (await axiosInstance.post<EmbeddingBackfillProgress>("api/admin/recommendations/embeddings/backfill",options)).data; }
export async function fetchBackfillProgress(signal?: AbortSignal): Promise<EmbeddingBackfillProgress> { return (await axiosInstance.get<EmbeddingBackfillProgress>("api/admin/recommendations/embeddings/backfill/progress", { signal })).data; }
export async function previewBackfill(options:BackfillOptions):Promise<BackfillPreview>{return (await axiosInstance.post<BackfillPreview>("api/admin/recommendations/embeddings/backfill/preview",options)).data;}
export async function cancelBackfill():Promise<EmbeddingBackfillProgress>{return (await axiosInstance.post<EmbeddingBackfillProgress>("api/admin/recommendations/embeddings/backfill/cancel")).data;}
export type SynopsisStatus = "present" | "not_checked" | "no_description" | "lookup_failed" | "missing";
export type ManualMetadataBook = { id: number; title: string; author?: string | null; isbn?: string | null; imageUrl?:string|null; source: string | null; metadataStatus: "missing" | "failed" | "ready" | "manual"; synopsisStatus: SynopsisStatus; embeddingStatus: string };
export type ManualMetadataBooksResponse = { rows: ManualMetadataBook[]; pagination: CatalogPagination };
export type ManualBookMetadata = {staffEditedAt?:string|null;staffEditedBy?:string|null;
  book: Pick<ManualMetadataBook, "id" | "title" | "author" | "isbn">;
  summary: string;
  subjects: string[];
  additionalDetails: { publisher: string; categories: string[]; language: string; pageCount: number | string | null; publishedDate: string };
  source: string | null;
  metadataStatus: "missing" | "failed" | "ready" | "manual";
  metadataError: string | null;
  synopsisStatus: SynopsisStatus;
  synopsisError: string | null;
  embeddingStatus: string;
  embeddingError: string | null;
};
export type SaveManualBookMetadataResponse = { metadataStatus: "manual"; embeddingStatus: "ready" | "failed"; summary: string; subjects: string[]; additionalDetails: ManualBookMetadata["additionalDetails"]; embeddingError: string | null };
export async function fetchManualMetadataBooks(params: { query?: string; needsAttention?: boolean; page?: number;limit?:number;synopsis?:string;embedding?:string;details?:string;sort?:string }, signal?: AbortSignal): Promise<ManualMetadataBooksResponse> {
  return (await axiosInstance.get<ManualMetadataBooksResponse>("api/admin/recommendations/books", { params: { q: params.query || "", needsAttention: params.needsAttention ? "true" : "false", page: params.page || 1, limit: params.limit??25,synopsis:params.synopsis,embedding:params.embedding,details:params.details,sort:params.sort }, signal })).data;
}
export async function fetchManualBookMetadata(bookId: number, signal?: AbortSignal): Promise<ManualBookMetadata> {
  return (await axiosInstance.get<ManualBookMetadata>(`api/admin/recommendations/books/${bookId}/metadata`, { signal })).data;
}
export async function saveManualBookMetadata(bookId: number, payload: { summary: string; subjects: string[]; additionalDetails: ManualBookMetadata["additionalDetails"] }): Promise<SaveManualBookMetadataResponse> {
  return (await axiosInstance.put<SaveManualBookMetadataResponse>(`api/admin/recommendations/books/${bookId}/metadata`, payload)).data;
}

export type RecommendationPreview={rows:Array<{id:number;title:string;author?:string;reason:string;source:'ai'|'rule'}>};
export async function fetchRecommendationPreview(bookId:number,signal?:AbortSignal):Promise<RecommendationPreview>{return (await axiosInstance.get<RecommendationPreview>(`api/admin/recommendations/books/${bookId}/preview`,{signal})).data;}

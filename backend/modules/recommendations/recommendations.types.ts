import type { RowDataPacket } from "mysql2/promise";

export type MaterialType = "book" | "thesis";

export interface CatalogRecord extends RowDataPacket {
  id: number;
  title: string;
  author: string | null;
  isbn: string | null;
  material_type: MaterialType;
  metadata: unknown;
  image_url?: string | null;
  copies?: number | string | null;
  has_active_policy?: number | boolean;
  available?: number | string | null;
  total_copies?: number | string | null;
  checked_out?: number | string | null;
  reserved_copies?: number | string | null;
  popularity?: number | string | null;
  reason?: string;
  source?: "rule" | "ai";
  score?: number;
}

export interface RecommendationCandidate extends CatalogRecord {
  has_active_policy: number | boolean;
  available: number | string;
  total_copies: number | string;
  checked_out: number | string;
  reserved_copies: number | string;
  popularity: number | string;
}

export interface EmbeddingRecord extends RowDataPacket {
  book_id: number;
  vector_json: string;
  model?: string;
  content_hash?: string;
  dimensions?: number;
  status?: string;
  last_error?: string | null;
}

export interface EnrichmentRecord extends RowDataPacket {
  source: string | null;
  enrichment_json: string | null;
  status: string | null;
  last_error: string | null;
}

export interface MetadataListRecord extends RowDataPacket {
  id: number;
  title: string;
  author: string | null;
  isbn: string | null;
  metadata_source: string | null;
  metadata_status: string | null;
  enrichment_json: string | null;
  embedding_status: string | null;
}

export interface ManualMetadataRecord extends RowDataPacket {
  id: number;
  title: string;
  author: string | null;
  isbn: string | null;
  material_type: MaterialType;
  metadata_source: string | null;
  metadata_status: string | null;
  enrichment_json: string | null;
  metadata_error: string | null;
  embedding_status: string | null;
  embedding_error: string | null;
}

export interface BackfillBook extends RowDataPacket {
  id: number;
  title: string;
}

export interface EmbeddingErrorRecord extends RowDataPacket {
  book_id: number;
  last_error: string;
}

export interface EmbeddingStatusRecord extends RowDataPacket {
  total: number | string;
  ready: number | string;
  stale: number | string;
  failed: number | string;
  missing: number | string;
}

export interface Enrichment {
  description?: string;
  googleBooksSynopsisCheckVersion?: number;
  subjects?: string[];
  categories?: string[];
  publisher?: string;
  language?: string;
  pageCount?: string | number | null;
  publishedDate?: string;
  [key: string]: unknown;
}

export interface ManualMetadataPayload {
  summary?: unknown;
  subjects?: unknown;
  additionalDetails?: unknown;
}

export interface MetadataListOptions {
  query?: string;
  needsAttention?: boolean;
  page?: number;
  limit?: number;
}

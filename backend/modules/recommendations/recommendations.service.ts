import crypto = require("crypto");
import repository = require("./recommendations.repository");
import type {
  BackfillBook,
  CatalogRecord,
  Enrichment,
  ManualMetadataPayload,
  MaterialType,
  MetadataListOptions,
  RecommendationCandidate,
} from "./recommendations.types";
const isbnMetadataLookup = require("../catalog/isbn-metadata.lookup") as {
  lookupIsbnMetadata: (isbn: string, options?: { retryRateLimit?: boolean; skipGoogleBooks?: boolean }) => Promise<{
    description: string; subjects: string[]; categories: string[]; publisher: string; language: string;
    pageCount: string | number | null; publishedDate: string; errors: string[];
    descriptionSource: "openlibrary" | "googlebooks" | "hardcover" | null; synopsisChecked: boolean; synopsisErrors: string[];
    googleBooksResponded: boolean; googleBooksStatus: number | null; googleBooksRetryAfterMs: number | null; googleBooksRateLimited: boolean;
  }>;
  lookupBookSynopsis: (isbn: string, options?: { retryRateLimit?: boolean }) => Promise<{
    description: string; source: "openlibrary" | "googlebooks" | "hardcover" | null;
    responded: boolean; checked: boolean; errors: string[]; status: number | null; retryAfterMs: number | null; rateLimited: boolean;
  }>;
  lookupGoogleBooksSynopsis: (isbn: string, options?: { retryRateLimit?: boolean }) => Promise<{
    description: string; responded: boolean; errors: string[]; status: number | null; retryAfterMs: number | null; rateLimited: boolean;
  }>;
};

const { logDevelopment } = require("../../logger") as { logDevelopment: (...values: unknown[]) => void };
const { hydrateCatalogRecord, parseMetadata } = require("../catalog/catalog.projection") as {
  hydrateCatalogRecord: (record: CatalogRecord, options: { publicKeys: string[] }) => CatalogRecord;
  parseMetadata: (value: unknown) => Record<string, unknown>;
};
const catalogSettings = require("../catalog/catalog.settings.service") as {
  getCatalogSettings: () => Promise<{ show_unheld_in_opac: boolean }>;
};

interface ScoredCandidate extends RecommendationCandidate {
  score: number;
  source: "rule" | "ai";
  reason: string;
}

interface BackfillState {
  status: "idle" | "running" | "completed" | "completed_with_errors" | "paused_rate_limited";
  total: number;
  completed: number;
  missingSynopses: number;
  embedded: number;
  synopsesAdded: number;
  synopsesNotFound: number;
  failed: number;
  lookupFailed: number;
  deferred: number;
  rateLimitRetryAt: string | null;
  currentTitle: string | null;
  errors: string[];
  lookupErrors: string[];
}

type SynopsisStatus = "present" | "not_checked" | "no_description" | "lookup_failed" | "missing";

interface EnrichmentOutcome {
  enrichment: Enrichment | null;
  synopsisStatus: SynopsisStatus;
  synopsisCheckedNow: boolean;
  descriptionAddedNow: boolean;
  lookupFailed: boolean;
  lookupErrors: string[];
  rateLimited: boolean;
  retryAfterMs: number | null;
}

interface ServiceError extends Error {
  status?: number;
}

const createServiceError = (message: string, status: number): ServiceError => Object.assign(new Error(message), { status });
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error || "Unknown error");

const BOOK_LIMIT = 8;
const THESIS_LIMIT = 5;
const BOOK_RULE_LIMIT = 3;
const BOOK_AI_LIMIT = BOOK_LIMIT - BOOK_RULE_LIMIT;
const embeddingModel = () => process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const GOOGLE_BOOKS_SYNOPSIS_CHECK_VERSION = 1;
const SYNOPSIS_PROVIDER_CHECK_VERSION = 1;
let activeBackfill: BackfillState = { status: "idle", total: 0, completed: 0, missingSynopses: 0, embedded: 0, synopsesAdded: 0, synopsesNotFound: 0, failed: 0, lookupFailed: 0, deferred: 0, rateLimitRetryAt: null, currentTitle: null, errors: [], lookupErrors: [] };

const normalized = (value: unknown): string => String(value || "").toLowerCase().trim();
const parseEnrichment = (value: unknown): Enrichment => {
  if (!value) return {};
  try {
    const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Enrichment : {};
  } catch { return {}; }
};
const hasUsefulMetadata = (enrichment: Enrichment | null | undefined): boolean => Boolean(
  String(enrichment?.description || "").trim()
  || (Array.isArray(enrichment?.subjects) && enrichment.subjects.some((subject) => String(subject || "").trim()))
  || (Array.isArray(enrichment?.categories) && enrichment.categories.some((category) => String(category || "").trim()))
  || String(enrichment?.publisher || "").trim()
  || String(enrichment?.language || "").trim()
  || String(enrichment?.pageCount || "").trim()
  || String(enrichment?.publishedDate || "").trim()
);
const hasDescription = (enrichment: Enrichment | null | undefined): boolean => Boolean(String(enrichment?.description || "").trim());
const hasSynopsisCheck = (enrichment: Enrichment | null | undefined): boolean => Number(enrichment?.synopsisProviderCheckVersion || 0) >= SYNOPSIS_PROVIDER_CHECK_VERSION;
const synopsisStatus = (isbn: string | null | undefined, source: string | null | undefined, enrichment: Enrichment): SynopsisStatus => {
  if (hasDescription(enrichment)) return "present";
  if (!isbn || source === "manual") return "missing";
  if (String(enrichment.synopsisLastError || enrichment.googleBooksSynopsisLastError || "").trim()) return "lookup_failed";
  if (hasSynopsisCheck(enrichment)) return "no_description";
  return "not_checked";
};
const publicEmbeddingError = (error: unknown): string => String(error instanceof Error ? error.message : error || "Embedding failed").replace(/key=[^&\s]+/gi, "key=[redacted]").slice(0, 240);
const publicMetadataError = (error: unknown): string => String(error instanceof Error ? error.message : error || "Metadata lookup failed")
  .replace(/key=[^&\s]+/gi, "key=[redacted]")
  .replace(/https?:\/\/\S+/gi, "[metadata provider]")
  .slice(0, 240);
const tokens = (value: unknown): Set<string> => new Set(normalized(value).split(/[^a-z0-9]+/).filter((token) => token.length > 2));
const overlap = (a: unknown, b: unknown): number => {
  const left = tokens(a); const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let count = 0; for (const token of left) if (right.has(token)) count += 1;
  return count / Math.max(left.size, right.size);
};
const cosine = (left: number[] | null, right: number[] | null): number => {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return -1;
  let dot = 0; let leftMagnitude = 0; let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) { dot += left[index] * right[index]; leftMagnitude += left[index] ** 2; rightMagnitude += right[index] ** 2; }
  return leftMagnitude && rightMagnitude ? dot / Math.sqrt(leftMagnitude * rightMagnitude) : -1;
};

const embeddingText = (book: CatalogRecord, enrichment: Enrichment = {}): string => {
  const metadata = parseMetadata(book.metadata);
  const fields = book.material_type === "thesis"
    ? [book.title, book.author, metadata.thesis_program, metadata.thesis_keywords, metadata.thesis_abstract, metadata.thesis_adviser, metadata.academic_year]
    : [book.title, book.author, metadata.category, metadata.edition, metadata.publication_year, enrichment.description, ...(enrichment.subjects || []), ...(enrichment.categories || []), enrichment.publisher, enrichment.language, enrichment.pageCount, enrichment.publishedDate];
  return fields.filter(Boolean).join("\n");
};
const contentHash = (book: CatalogRecord, enrichment: Enrichment): string => crypto.createHash("sha256").update(embeddingText(book, enrichment)).digest("hex");

const publicFields = async (): Promise<Set<string>> => {
  return new Set(await repository.getPublicFieldKeys());
};
const activeCandidates = async (materialType: MaterialType, excludedIds: number[] = []): Promise<RecommendationCandidate[]> => {
  const settings = materialType === "book" ? await catalogSettings.getCatalogSettings() : { show_unheld_in_opac: true };
  return repository.findActiveCandidates(materialType, excludedIds, { showUnheldInOpac: settings.show_unheld_in_opac });
};
const serialize = async (records: ScoredCandidate[]): Promise<Record<string, unknown>[]> => {
  const fields = [...await publicFields()];
  return records.map((record) => {
    const hydrated = hydrateCatalogRecord(record, { publicKeys: fields });
    const isBook = record.material_type === "book";
    const hasActivePolicy = Boolean(record.has_active_policy);
    const available = Number(record.available || 0);
    const checkedOut = Number(record.checked_out || 0);
    const reserved = Number(record.reserved_copies || 0);
    const availabilityStatus = !isBook ? "reference_only"
      : available > 0 ? "available"
        : checkedOut > 0 ? "checked_out"
          : reserved > 0 ? "reserved" : "unavailable";
    return {
      id: hydrated.id, title: hydrated.title, author: hydrated.author, isbn: hydrated.isbn,
      image_url: hydrated.image_url ?? null,
      copies: hydrated.copies, material_type: hydrated.material_type, metadata: hydrated.metadata,
      ...(hydrated.metadata as Record<string, unknown>),
      canBorrow: isBook && Number(record.available || 0) > 0,
      canReserve: isBook && hasActivePolicy && Number(record.total_copies || 0) > 0,
      needs_policy: isBook && !hasActivePolicy,
      available, total_copies: Number(record.total_copies || 0), availability_status: availabilityStatus,
      reason: record.reason, source: record.source,
    };
  });
};

const ruleScore = (seed: CatalogRecord, candidate: CatalogRecord): number => {
  const seedMeta = parseMetadata(seed.metadata); const candidateMeta = parseMetadata(candidate.metadata);
  if (seed.material_type === "thesis") {
    return (normalized(seedMeta.thesis_program) && normalized(seedMeta.thesis_program) === normalized(candidateMeta.thesis_program) ? 8 : 0)
      + overlap(seedMeta.thesis_keywords, candidateMeta.thesis_keywords) * 5
      + (normalized(seedMeta.thesis_adviser) && normalized(seedMeta.thesis_adviser) === normalized(candidateMeta.thesis_adviser) ? 2 : 0)
      + (normalized(seedMeta.academic_year) && normalized(seedMeta.academic_year) === normalized(candidateMeta.academic_year) ? 1 : 0)
      + overlap(`${seed.title} ${seed.author}`, `${candidate.title} ${candidate.author}`);
  }
  return (normalized(seedMeta.category) && normalized(seedMeta.category) === normalized(candidateMeta.category) ? 8 : 0)
    + (normalized(seed.author) && normalized(seed.author) === normalized(candidate.author) ? 3 : 0)
    + overlap(`${seed.title} ${seed.author}`, `${candidate.title} ${candidate.author}`)
    + Number(candidate.popularity || 0) / 1000;
};
const ruleReason = (seed: CatalogRecord, candidate: CatalogRecord): string => {
  const a = parseMetadata(seed.metadata); const b = parseMetadata(candidate.metadata);
  if (seed.material_type === "thesis") {
    if (a.thesis_program && normalized(a.thesis_program) === normalized(b.thesis_program)) return `Same program: ${a.thesis_program}`;
    if (overlap(a.thesis_keywords, b.thesis_keywords)) return "Related thesis keywords";
    return "Related thesis topic";
  }
  if (a.category && normalized(a.category) === normalized(b.category)) return `Similar category: ${a.category}`;
  if (seed.author && normalized(seed.author) === normalized(candidate.author)) return `Also by ${seed.author}`;
  return "Related catalogue title";
};

const getEmbedding = async (bookId: number): Promise<number[] | null> => {
  const row = await repository.findEmbedding(bookId);
  try {
    const vector: unknown = row ? JSON.parse(row.vector_json) : null;
    return Array.isArray(vector) && vector.every((value) => typeof value === "number") ? vector as number[] : null;
  } catch { return null; }
};
const semanticMatches = async (seed: CatalogRecord, candidates: RecommendationCandidate[], limit: number, excluded: Set<number> = new Set()): Promise<ScoredCandidate[]> => {
  const vector = await getEmbedding(seed.id); if (!vector) return [];
  const rows = await repository.findEmbeddings(candidates.map((candidate) => candidate.id));
  const byId = new Map<number, number[] | null>(rows.map((row) => {
    try {
      const vector: unknown = JSON.parse(row.vector_json);
      return [row.book_id, Array.isArray(vector) && vector.every((value) => typeof value === "number") ? vector as number[] : null];
    } catch { return [row.book_id, null]; }
  }));
  return candidates.filter((candidate) => !excluded.has(candidate.id) && byId.has(candidate.id))
    .map((candidate) => ({ ...candidate, score: cosine(vector, byId.get(candidate.id) ?? null), source: "ai" as const, reason: "Similar subject and catalogue details" }))
    .filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
};

const semanticMatchesForPage = (semantic: ScoredCandidate[], excluded: Set<number>, limit: number): ScoredCandidate[] => semantic
  .filter((item) => !excluded.has(item.id))
  .slice(0, limit);

const selectBookRecommendations = (rankedRules: ScoredCandidate[], semantic: ScoredCandidate[]): ScoredCandidate[] => {
  const rules = rankedRules.slice(0, BOOK_RULE_LIMIT);
  const selectedIds = new Set(rules.map((item) => item.id));
  const ai = semanticMatchesForPage(semantic, selectedIds, BOOK_AI_LIMIT);
  for (const item of ai) selectedIds.add(item.id);
  const fill = rankedRules.slice(BOOK_RULE_LIMIT).filter((item) => !selectedIds.has(item.id));
  return [...ai, ...rules, ...fill.slice(0, BOOK_LIMIT - rules.length - ai.length)];
};

const recommendationsForSeed = async (bookId: number) => {
  const seed = await repository.findBook(bookId);
  if (!seed) throw createServiceError("Catalogue record not found", 404);
  const candidates = await activeCandidates(seed.material_type, [seed.id]);
  const rules: ScoredCandidate[] = candidates.map((candidate) => ({ ...candidate, score: ruleScore(seed, candidate), source: "rule" as const, reason: ruleReason(seed, candidate) }))
    .sort((a, b) => b.score - a.score || Number(b.popularity) - Number(a.popularity));
  const rows = seed.material_type === "book"
    ? selectBookRecommendations(rules, await semanticMatches(seed, candidates, BOOK_AI_LIMIT, new Set(rules.slice(0, BOOK_RULE_LIMIT).map((item) => item.id))))
    : rules.slice(0, THESIS_LIMIT);
  return { material_type: seed.material_type, rows: await serialize(rows) };
};

const historySeeds = async (userId: number, materialType: MaterialType): Promise<CatalogRecord[]> => {
  return repository.findHistorySeeds(userId, materialType);
};
const personalized = async (userId: number, materialType: string) => {
  if (materialType !== "book" && materialType !== "thesis") throw createServiceError("materialType must be book or thesis", 400);
  const requestedMaterialType: MaterialType = materialType;
  const seeds = await historySeeds(userId, requestedMaterialType);
  if (!seeds.length) return { material_type: materialType, rows: [], has_history: false };
  const dismissIds = await repository.findDismissedBookIds(userId);
  const candidates = await activeCandidates(requestedMaterialType, [...seeds.map((seed) => seed.id), ...dismissIds]);
  const anchor = seeds[0];
  const rules: ScoredCandidate[] = candidates.map((candidate) => ({ ...candidate, score: seeds.reduce((total, seed, index) => total + ruleScore(seed, candidate) / (index + 1), 0), source: "rule" as const, reason: `Based on your recent ${materialType === "book" ? "library activity" : "thesis activity"}` }))
    .sort((a, b) => b.score - a.score);
  const selected = materialType === "book"
    ? selectBookRecommendations(rules, await semanticMatches(anchor, candidates, BOOK_AI_LIMIT, new Set(rules.slice(0, BOOK_RULE_LIMIT).map((item) => item.id))))
    : rules.slice(0, THESIS_LIMIT);
  const rows = await serialize(selected.map((row) => ({ ...row, reason: row.source === "ai" ? "Similar to your recent reading" : row.reason })));
  return { material_type: materialType, rows, has_history: true };
};

const dismiss = async (userId: number, bookId: number): Promise<void> => {
  const book = await repository.findBookId(bookId);
  if (!book) throw createServiceError("Catalogue record not found", 404);
  await repository.dismissBook(userId, bookId);
};

const listMetadataBooks = async ({ query = "", needsAttention = false, page = 1, limit = 25 }: MetadataListOptions = {}) => {
  const result = await repository.listBooksForMetadata({ query, needsAttention, page, limit });
  const rows = result.rows.map((row) => {
    const enrichment = parseEnrichment(row.enrichment_json);
    const hasMetadata = hasUsefulMetadata(enrichment);
    const metadataStatus = row.metadata_source === "manual" ? "manual"
      : row.metadata_status === "failed" ? "failed"
        : row.metadata_status === "ready" && hasMetadata ? "ready" : "missing";
    return {
      id: row.id, title: row.title, author: row.author, isbn: row.isbn,
      source: row.metadata_source || null, metadataStatus, embeddingStatus: row.embedding_status || "missing",
      synopsisStatus: synopsisStatus(row.isbn, row.metadata_source, enrichment),
    };
  });
  return { rows, pagination: { page, limit, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / limit)) } };
};

const getManualMetadata = async (bookId: number) => {
  const record = await repository.findBookMetadataRecord(bookId);
  if (!record) throw createServiceError("Book not found", 404);
  if (record.material_type !== "book") throw createServiceError("Manual AI details are available for books only", 400);
  const enrichment = parseEnrichment(record.enrichment_json);
  return {
    book: { id: record.id, title: record.title, author: record.author, isbn: record.isbn },
    summary: String(enrichment.description || ""),
    subjects: Array.isArray(enrichment.subjects) ? enrichment.subjects : [],
    additionalDetails: {
      publisher: enrichment.publisher || "",
      categories: Array.isArray(enrichment.categories) ? enrichment.categories : [],
      language: enrichment.language || "",
      pageCount: enrichment.pageCount ?? null,
      publishedDate: enrichment.publishedDate || "",
    },
    source: record.metadata_source || null,
    metadataStatus: record.metadata_status === "failed" ? "failed" : hasUsefulMetadata(enrichment) ? (record.metadata_source === "manual" ? "manual" : "ready") : "missing",
    metadataError: record.metadata_status === "failed" && record.metadata_error ? publicMetadataError(record.metadata_error) : null,
    synopsisStatus: synopsisStatus(record.isbn, record.metadata_source, enrichment),
    synopsisError: enrichment.synopsisLastError || enrichment.googleBooksSynopsisLastError ? publicMetadataError(enrichment.synopsisLastError || enrichment.googleBooksSynopsisLastError) : null,
    embeddingStatus: record.embedding_status || "missing",
    embeddingError: record.embedding_error ? publicEmbeddingError(record.embedding_error) : null,
  };
};

const saveManualMetadata = async (bookId: number, payload: ManualMetadataPayload = {}) => {
  const record = await repository.findBookMetadataRecord(bookId);
  if (!record) throw createServiceError("Book not found", 404);
  if (record.material_type !== "book") throw createServiceError("Manual AI details are available for books only", 400);
  const existing = parseEnrichment(record.enrichment_json);
  if (payload.summary !== undefined && typeof payload.summary !== "string") throw createServiceError("Book summary must be text", 400);
  const summary = payload.summary === undefined ? String(existing.description || "") : payload.summary.trim();
  if (summary.length > 8000) throw createServiceError("The book summary must be 8,000 characters or fewer", 400);
  if (payload.subjects !== undefined && !Array.isArray(payload.subjects)) throw createServiceError("Subjects must be sent as a list", 400);
  const incomingSubjects = payload.subjects as unknown[] | undefined;
  if ((incomingSubjects || []).length > 40 || (incomingSubjects || []).some((subject) => typeof subject !== "string")) throw createServiceError("Enter up to 40 subjects as text", 400);
  const subjects = payload.subjects === undefined
    ? (Array.isArray(existing.subjects) ? existing.subjects as string[] : [])
    : [...new Map((incomingSubjects as string[]).map((subject) => subject.trim()).filter(Boolean).map((subject) => [normalized(subject), subject])).values()];
  if (subjects.length > 40 || subjects.some((subject) => subject.length > 160)) throw createServiceError("Enter up to 40 subjects, each 160 characters or fewer", 400);
  const additional = payload.additionalDetails ?? {};
  if (!additional || typeof additional !== "object" || Array.isArray(additional)) throw createServiceError("Additional book details must be sent as an object", 400);
  const additionalDetails = additional as Record<string, unknown>;
  const cleanText = (key: string, maxLength: number, label: string): string => {
    if (additionalDetails[key] === undefined) return typeof existing[key] === "string" ? existing[key] as string : "";
    if (typeof additionalDetails[key] !== "string") throw createServiceError(`${label} must be text`, 400);
    const value = additionalDetails[key].trim();
    if (value.length > maxLength) throw createServiceError(`${label} must be ${maxLength} characters or fewer`, 400);
    return value;
  };
  const publisher = cleanText("publisher", 200, "Publisher");
  const language = cleanText("language", 80, "Language");
  const publishedDate = cleanText("publishedDate", 64, "Publication date");
  let categories = Array.isArray(existing.categories) ? existing.categories : [];
  if (additionalDetails.categories !== undefined) {
    if (!Array.isArray(additionalDetails.categories) || additionalDetails.categories.length > 40 || additionalDetails.categories.some((category) => typeof category !== "string")) throw createServiceError("Enter up to 40 categories as text", 400);
    const categoryInput = additionalDetails.categories as string[];
    categories = [...new Map(categoryInput.map((category) => category.trim()).filter(Boolean).map((category) => [normalized(category), category])).values()];
    if (categories.some((category) => category.length > 160)) throw createServiceError("Each category must be 160 characters or fewer", 400);
  }
  let pageCount = existing.pageCount ?? null;
  if (additionalDetails.pageCount !== undefined) {
    const rawPageCount = additionalDetails.pageCount;
    if (rawPageCount === null || rawPageCount === "") pageCount = null;
    else {
      const parsedPageCount = typeof rawPageCount === "number" ? rawPageCount : (typeof rawPageCount === "string" && /^\d+$/.test(rawPageCount.trim()) ? Number(rawPageCount) : NaN);
      if (!Number.isInteger(parsedPageCount) || parsedPageCount < 1 || parsedPageCount > 100000) throw createServiceError("Page count must be a whole number from 1 to 100,000", 400);
      pageCount = parsedPageCount;
    }
  }
  const enrichment = { ...existing, description: summary, subjects, publisher, categories, language, pageCount, publishedDate };
  delete enrichment.synopsisLastError;
  delete enrichment.descriptionSource;
  delete enrichment.googleBooksSynopsisLastError;
  if (!hasUsefulMetadata(enrichment)) throw createServiceError("Add at least one book detail before saving", 400);
  await repository.saveManualEnrichment(bookId, enrichment);

  try {
    await markEmbeddingStale(bookId);
    await embedBook(bookId);
    return { metadataStatus: "manual", embeddingStatus: "ready", summary, subjects, additionalDetails: { publisher, categories, language, pageCount, publishedDate }, embeddingError: null };
  } catch (error) {
    const message = publicEmbeddingError(error);
    await repository.markEmbeddingFailed(bookId, message).catch(() => {});
    return { metadataStatus: "manual", embeddingStatus: "failed", summary, subjects, additionalDetails: { publisher, categories, language, pageCount, publishedDate }, embeddingError: message };
  }
};

const enrichBookWithOutcome = async (bookId: number, { retryRateLimit = false }: { retryRateLimit?: boolean } = {}): Promise<EnrichmentOutcome> => {
  const existing = await repository.findEnrichment(bookId);
  const savedEnrichment = parseEnrichment(existing?.enrichment_json);
  if (existing?.source === "manual") {
    return { enrichment: savedEnrichment, synopsisStatus: synopsisStatus(null, "manual", savedEnrichment), synopsisCheckedNow: false, descriptionAddedNow: false, lookupFailed: false, lookupErrors: [], rateLimited: false, retryAfterMs: null };
  }
  const isbnRecord = await repository.findBookIsbn(bookId);
  if (!isbnRecord?.isbn) {
    return { enrichment: Object.keys(savedEnrichment).length ? savedEnrichment : null, synopsisStatus: "missing", synopsisCheckedNow: false, descriptionAddedNow: false, lookupFailed: false, lookupErrors: [], rateLimited: false, retryAfterMs: null };
  }
  if (existing?.status === "ready" && hasUsefulMetadata(savedEnrichment)) {
    if (hasDescription(savedEnrichment) || hasSynopsisCheck(savedEnrichment)) {
      return { enrichment: savedEnrichment, synopsisStatus: synopsisStatus(isbnRecord.isbn, existing.source, savedEnrichment), synopsisCheckedNow: false, descriptionAddedNow: false, lookupFailed: false, lookupErrors: [], rateLimited: false, retryAfterMs: null };
    }
    const lookup = await isbnMetadataLookup.lookupBookSynopsis(isbnRecord.isbn, { retryRateLimit });
    if (!lookup.checked) {
      const lookupError = publicMetadataError(lookup.errors.join("; ") || "Synopsis providers did not return a usable response");
      const enrichment: Enrichment = { ...savedEnrichment, synopsisLastError: lookupError };
      await repository.saveEnrichment(bookId, enrichment);
      return { enrichment, synopsisStatus: "lookup_failed", synopsisCheckedNow: false, descriptionAddedNow: false, lookupFailed: true, lookupErrors: lookup.errors.length ? lookup.errors.map(publicMetadataError) : [lookupError], rateLimited: lookup.rateLimited, retryAfterMs: lookup.retryAfterMs };
    }
    const enrichment: Enrichment = {
      ...savedEnrichment,
      synopsisProviderCheckVersion: SYNOPSIS_PROVIDER_CHECK_VERSION,
      googleBooksSynopsisCheckVersion: GOOGLE_BOOKS_SYNOPSIS_CHECK_VERSION,
    };
    if (lookup.source) enrichment.descriptionSource = lookup.source;
    delete enrichment.googleBooksSynopsisLastError;
    delete enrichment.synopsisLastError;
    if (lookup.description) enrichment.description = lookup.description;
    await repository.saveEnrichment(bookId, enrichment);
    return {
      enrichment,
      synopsisStatus: lookup.description ? "present" : "no_description",
      synopsisCheckedNow: true,
      descriptionAddedNow: Boolean(lookup.description),
      lookupFailed: lookup.errors.length > 0,
      lookupErrors: lookup.errors.map(publicMetadataError),
      rateLimited: lookup.rateLimited,
      retryAfterMs: lookup.retryAfterMs,
    };
  }

  const markerAlreadySet = hasSynopsisCheck(savedEnrichment);
  const metadata = await isbnMetadataLookup.lookupIsbnMetadata(isbnRecord.isbn, { retryRateLimit, skipGoogleBooks: markerAlreadySet });
  const enrichment: Enrichment = {
    ...savedEnrichment,
    description: metadata.description || String(savedEnrichment.description || ""),
    subjects: metadata.subjects.length ? metadata.subjects : savedEnrichment.subjects || [],
    categories: metadata.categories.length ? metadata.categories : savedEnrichment.categories || [],
    publisher: metadata.publisher || savedEnrichment.publisher || "",
    language: metadata.language || savedEnrichment.language || "",
    pageCount: metadata.pageCount ?? savedEnrichment.pageCount ?? null,
    publishedDate: metadata.publishedDate || savedEnrichment.publishedDate || "",
  };
  if (metadata.descriptionSource) enrichment.descriptionSource = metadata.descriptionSource;
  const synopsisCheckedNow = metadata.synopsisChecked;
  if (synopsisCheckedNow) {
    enrichment.synopsisProviderCheckVersion = SYNOPSIS_PROVIDER_CHECK_VERSION;
    enrichment.googleBooksSynopsisCheckVersion = GOOGLE_BOOKS_SYNOPSIS_CHECK_VERSION;
    delete enrichment.synopsisLastError;
    delete enrichment.googleBooksSynopsisLastError;
  } else if (metadata.synopsisErrors.length) {
    const synopsisError = publicMetadataError(metadata.synopsisErrors.join("; "));
    enrichment.synopsisLastError = synopsisError;
    enrichment.googleBooksSynopsisLastError = synopsisError;
  }
  const usefulMetadataFound = hasUsefulMetadata(enrichment);
  const lookupFailed = metadata.errors.length > 0;
  const lookupErrors = metadata.errors.map(publicMetadataError);
  if (!hasUsefulMetadata(enrichment) && metadata.errors.length) {
    const lookupError = metadata.errors.join("; ").slice(0, 500);
    await repository.markEnrichmentFailed(isbnRecord.id, lookupError, enrichment);
  } else {
    await repository.saveEnrichment(isbnRecord.id, enrichment);
  }
  return {
    enrichment,
    synopsisStatus: synopsisStatus(isbnRecord.isbn, "openlibrary_googlebooks", enrichment),
    synopsisCheckedNow,
    descriptionAddedNow: Boolean(metadata.description) && !hasDescription(savedEnrichment),
    lookupFailed,
    lookupErrors,
    rateLimited: metadata.googleBooksRateLimited,
    retryAfterMs: metadata.googleBooksRetryAfterMs,
  };
};

const enrichBook = async (bookId: number): Promise<(Enrichment & { __lookupFailed?: boolean; __lookupError?: string }) | null> => {
  const outcome = await enrichBookWithOutcome(bookId);
  if (!outcome.enrichment) return null;
  if (outcome.lookupFailed && !hasUsefulMetadata(outcome.enrichment)) {
    return { __lookupFailed: true, __lookupError: outcome.lookupErrors.join("; ") };
  }
  return outcome.enrichment;
};

const embedBook = async (bookId: number): Promise<{ bookId: number; dimensions: number } | null> => {
  const book = await repository.findBookForEmbedding(bookId);
  if (!book) return null;
  const enrichmentRow = await repository.findReadyEnrichment(bookId);
  let enrichment: Enrichment = {}; try { enrichment = enrichmentRow ? parseEnrichment(enrichmentRow.enrichment_json) : {}; } catch { enrichment = {}; }
  const hash = contentHash(book, enrichment); const model = embeddingModel();
  if (enrichmentRow?.embedding_status === "ready"
    && enrichmentRow.embedding_model === model
    && enrichmentRow.embedding_content_hash === hash) {
    return { bookId: book.id, dimensions: Number(enrichmentRow.embedding_dimensions || 0) };
  }
  if (process.env.AI_EMBEDDING_PROVIDER !== "gemini" || !process.env.GEMINI_API_KEY) throw new Error("Gemini embedding provider is not configured");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`,
    { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, body: JSON.stringify({ model: `models/${model}`, taskType: "SEMANTIC_SIMILARITY", content: { parts: [{ text: embeddingText(book, enrichment) }] } }), signal: AbortSignal.timeout(30000) }
  );
  if (!response.ok) {
    const providerMessage = await response.text();
    throw new Error(`Gemini embedding request failed (${response.status}): ${providerMessage.slice(0, 400)}`);
  }
  const payload: unknown = await response.json();
  const payloadRecord = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const embedding = payloadRecord.embedding && typeof payloadRecord.embedding === "object" ? payloadRecord.embedding as Record<string, unknown> : {};
  const vectorValue = embedding.values;
  const vector = Array.isArray(vectorValue) && vectorValue.every((value) => typeof value === "number") ? vectorValue as number[] : [];
  if (!vector.length) throw new Error("Gemini returned no embedding vector");
  await repository.saveEmbedding({ bookId: book.id, model, hash, vector });
  return { bookId: book.id, dimensions: vector.length };
};
const markEmbeddingStale = async (bookId: number): Promise<void> => repository.markEmbeddingStale(bookId, embeddingModel());
const queueEmbedding = async (bookId: number): Promise<void> => {
  await markEmbeddingStale(bookId);
  setImmediate(async () => {
    try { await embedBook(bookId); }
    catch (error: unknown) {
      await repository.markEmbeddingFailed(bookId, errorMessage(error).slice(0, 500)).catch(() => {});
      logDevelopment("[recommendations] embedding failed:", errorMessage(error));
    }
  });
};
const queueEnrichmentAndEmbedding = (bookId: number): Promise<void> => new Promise<void>((resolve) => {
  setImmediate(() => {
    enrichBook(bookId)
      .then(() => queueEmbedding(bookId))
      .catch((error) => logDevelopment("[recommendations] enrichment/embedding refresh:", error))
      .finally(resolve);
  });
});
const addLookupErrors = (messages: string[], title: string): void => {
  for (const value of messages) {
    const message = `${title}: ${publicMetadataError(value)}`.slice(0, 240);
    if (message && !activeBackfill.lookupErrors.includes(message) && activeBackfill.lookupErrors.length < 4) activeBackfill.lookupErrors.push(message);
  }
};

const runBackfill = async (books: BackfillBook[]): Promise<void> => {
  let pauseForRateLimit = false;
  for (const book of books) {
    activeBackfill.currentTitle = book.title;
    let outcome: EnrichmentOutcome | null = null;
    try {
      outcome = await enrichBookWithOutcome(book.id, { retryRateLimit: true });
      if (outcome.synopsisCheckedNow && outcome.synopsisStatus === "no_description") activeBackfill.synopsesNotFound += 1;
      if (outcome.descriptionAddedNow) activeBackfill.synopsesAdded += 1;
      if (outcome.lookupFailed) {
        activeBackfill.lookupFailed += 1;
        addLookupErrors(outcome.lookupErrors, book.title);
      }
    } catch (error: unknown) {
      activeBackfill.lookupFailed += 1;
      addLookupErrors([errorMessage(error)], book.title);
    }
    if (outcome?.rateLimited) {
      pauseForRateLimit = true;
      const waitMs = outcome.retryAfterMs;
      activeBackfill.rateLimitRetryAt = waitMs == null ? null : new Date(Date.now() + waitMs).toISOString();
    }
    try {
      const embedding = await embedBook(book.id);
      if (embedding) activeBackfill.embedded += 1;
    } catch (error: unknown) {
      activeBackfill.failed += 1;
      const message = `${book.title}: ${publicEmbeddingError(error)}`.slice(0, 240);
      if (!activeBackfill.errors.includes(message)) activeBackfill.errors.push(message);
    } finally {
      activeBackfill.completed += 1;
    }
    if (pauseForRateLimit) {
      activeBackfill.status = "paused_rate_limited";
      activeBackfill.deferred = activeBackfill.total - activeBackfill.completed;
      break;
    }
  }
  if (!pauseForRateLimit) activeBackfill.status = activeBackfill.failed || activeBackfill.lookupFailed ? "completed_with_errors" : "completed";
  activeBackfill.currentTitle = null;
  try {
    const { row } = await repository.getEmbeddingStatus();
    activeBackfill.missingSynopses = Number(row.missing_synopses || 0);
  } catch { /* Preserve the last known count if the refresh query fails. */ }
};
const startBackfill = async () => {
  if (activeBackfill.status === "running") return { ...activeBackfill, alreadyRunning: true };
  const [books, status] = await Promise.all([repository.findBooksForBackfill(), repository.getEmbeddingStatus()]);
  activeBackfill = { status: "running", total: books.length, completed: 0, missingSynopses: Number(status.row.missing_synopses || 0), embedded: 0, synopsesAdded: 0, synopsesNotFound: 0, failed: 0, lookupFailed: 0, deferred: 0, rateLimitRetryAt: null, currentTitle: null, errors: [], lookupErrors: [] };
  if (!books.length) { activeBackfill.status = "completed"; return { ...activeBackfill }; }
  setImmediate(() => runBackfill(books).catch((error: unknown) => {
    activeBackfill.status = "completed_with_errors";
    activeBackfill.errors.push(errorMessage(error || "Backfill failed").slice(0, 180));
  }));
  return { ...activeBackfill };
};
const backfillProgress = (): BackfillState => ({ ...activeBackfill, errors: [...activeBackfill.errors] });
const embeddingStatus = async () => {
  const { row, errors } = await repository.getEmbeddingStatus();
  return {
    total: Number(row.total || 0), ready: Number(row.ready || 0), stale: Number(row.stale || 0), failed: Number(row.failed || 0), missing: Number(row.missing || 0),
    missingSynopses: Number(row.missing_synopses || 0), needsAttention: Number(row.needs_attention || 0),
    errors: errors.map((entry) => ({ bookId: entry.book_id, message: String(entry.last_error).replace(/key=[^&\s]+/gi, "key=[redacted]") })),
  };
};

export = { recommendationsForSeed, personalized, dismiss, listMetadataBooks, getManualMetadata, saveManualMetadata, embedBook, enrichBook, markEmbeddingStale, queueEmbedding, queueEnrichmentAndEmbedding, startBackfill, backfillProgress, embeddingStatus };

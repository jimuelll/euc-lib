const crypto = require("crypto");
const repository = require("./recommendations.repository");
const { hydrateCatalogRecord, parseMetadata } = require("../catalog/catalog.projection");
const catalogSettings = require("../catalog/catalog.settings.service");

const BOOK_LIMIT = 8;
const THESIS_LIMIT = 5;
const BOOK_RULE_LIMIT = 3;
const BOOK_AI_LIMIT = BOOK_LIMIT - BOOK_RULE_LIMIT;
const embeddingModel = () => process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
let activeBackfill = { status: "idle", total: 0, completed: 0, embedded: 0, failed: 0, lookupFailed: 0, skipped: 0, currentTitle: null, errors: [], lookupErrors: [] };
let openLibraryQueue = Promise.resolve();
let openLibraryLastRequestAt = 0;

const normalized = (value) => String(value || "").toLowerCase().trim();
const parseEnrichment = (value) => {
  if (!value) return {};
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
};
const hasUsefulMetadata = (enrichment) => Boolean(
  String(enrichment?.description || "").trim()
  || (Array.isArray(enrichment?.subjects) && enrichment.subjects.some((subject) => String(subject || "").trim()))
  || (Array.isArray(enrichment?.categories) && enrichment.categories.some((category) => String(category || "").trim()))
  || String(enrichment?.publisher || "").trim()
  || String(enrichment?.language || "").trim()
  || String(enrichment?.pageCount || "").trim()
  || String(enrichment?.publishedDate || "").trim()
);
const publicEmbeddingError = (error) => String(error?.message || error || "Embedding failed").replace(/key=[^&\s]+/gi, "key=[redacted]").slice(0, 240);
const publicMetadataError = (error) => String(error?.message || error || "Metadata lookup failed")
  .replace(/key=[^&\s]+/gi, "key=[redacted]")
  .replace(/https?:\/\/\S+/gi, "[metadata provider]")
  .slice(0, 240);
const tokens = (value) => new Set(normalized(value).split(/[^a-z0-9]+/).filter((token) => token.length > 2));
const overlap = (a, b) => {
  const left = tokens(a); const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let count = 0; for (const token of left) if (right.has(token)) count += 1;
  return count / Math.max(left.size, right.size);
};
const cosine = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return -1;
  let dot = 0; let leftMagnitude = 0; let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) { dot += left[index] * right[index]; leftMagnitude += left[index] ** 2; rightMagnitude += right[index] ** 2; }
  return leftMagnitude && rightMagnitude ? dot / Math.sqrt(leftMagnitude * rightMagnitude) : -1;
};

const embeddingText = (book, enrichment = {}) => {
  const metadata = parseMetadata(book.metadata);
  const fields = book.material_type === "thesis"
    ? [book.title, book.author, metadata.thesis_program, metadata.thesis_keywords, metadata.thesis_abstract, metadata.thesis_adviser, metadata.academic_year]
    : [book.title, book.author, metadata.category, metadata.edition, metadata.publication_year, enrichment.description, ...(enrichment.subjects || []), ...(enrichment.categories || []), enrichment.publisher, enrichment.language, enrichment.pageCount, enrichment.publishedDate];
  return fields.filter(Boolean).join("\n");
};
const contentHash = (book, enrichment) => crypto.createHash("sha256").update(embeddingText(book, enrichment)).digest("hex");

const publicFields = async () => {
  return new Set(await repository.getPublicFieldKeys());
};
const activeCandidates = async (materialType, excludedIds = []) => {
  const settings = materialType === "book" ? await catalogSettings.getCatalogSettings() : { show_unheld_in_opac: true };
  return repository.findActiveCandidates(materialType, excludedIds, { showUnheldInOpac: settings.show_unheld_in_opac });
};
const serialize = async (records) => {
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
      ...hydrated.metadata,
      canBorrow: isBook && Number(record.available || 0) > 0,
      canReserve: isBook && hasActivePolicy && Number(record.total_copies || 0) > 0,
      needs_policy: isBook && !hasActivePolicy,
      available, total_copies: Number(record.total_copies || 0), availability_status: availabilityStatus,
      reason: record.reason, source: record.source,
    };
  });
};

const ruleScore = (seed, candidate) => {
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
const ruleReason = (seed, candidate) => {
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

const getEmbedding = async (bookId) => {
  const row = await repository.findEmbedding(bookId);
  try { return row ? JSON.parse(row.vector_json) : null; } catch { return null; }
};
const semanticMatches = async (seed, candidates, limit, excluded = new Set()) => {
  const vector = await getEmbedding(seed.id); if (!vector) return [];
  const rows = await repository.findEmbeddings(candidates.map((candidate) => candidate.id));
  const byId = new Map(rows.map((row) => { try { return [row.book_id, JSON.parse(row.vector_json)]; } catch { return [row.book_id, null]; } }));
  return candidates.filter((candidate) => !excluded.has(candidate.id) && byId.has(candidate.id))
    .map((candidate) => ({ ...candidate, score: cosine(vector, byId.get(candidate.id)), source: "ai", reason: "Similar subject and catalogue details" }))
    .filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
};

const semanticMatchesForPage = (semantic, excluded, limit) => semantic
  .filter((item) => !excluded.has(item.id))
  .slice(0, limit);

const selectBookRecommendations = (rankedRules, semantic) => {
  const rules = rankedRules.slice(0, BOOK_RULE_LIMIT);
  const selectedIds = new Set(rules.map((item) => item.id));
  const ai = semanticMatchesForPage(semantic, selectedIds, BOOK_AI_LIMIT);
  for (const item of ai) selectedIds.add(item.id);
  const fill = rankedRules.slice(BOOK_RULE_LIMIT).filter((item) => !selectedIds.has(item.id));
  return [...ai, ...rules, ...fill.slice(0, BOOK_LIMIT - rules.length - ai.length)];
};

const recommendationsForSeed = async (bookId) => {
  const seed = await repository.findBook(bookId);
  if (!seed) { const error = new Error("Catalogue record not found"); error.status = 404; throw error; }
  const candidates = await activeCandidates(seed.material_type, [seed.id]);
  const rules = candidates.map((candidate) => ({ ...candidate, score: ruleScore(seed, candidate), source: "rule", reason: ruleReason(seed, candidate) }))
    .sort((a, b) => b.score - a.score || b.popularity - a.popularity);
  const rows = seed.material_type === "book"
    ? selectBookRecommendations(rules, await semanticMatches(seed, candidates, BOOK_AI_LIMIT, new Set(rules.slice(0, BOOK_RULE_LIMIT).map((item) => item.id))))
    : rules.slice(0, THESIS_LIMIT);
  return { material_type: seed.material_type, rows: await serialize(rows) };
};

const historySeeds = async (userId, materialType) => {
  return repository.findHistorySeeds(userId, materialType);
};
const personalized = async (userId, materialType) => {
  if (!["book", "thesis"].includes(materialType)) { const error = new Error("materialType must be book or thesis"); error.status = 400; throw error; }
  const seeds = await historySeeds(userId, materialType);
  if (!seeds.length) return { material_type: materialType, rows: [], has_history: false };
  const dismissIds = await repository.findDismissedBookIds(userId);
  const candidates = await activeCandidates(materialType, [...seeds.map((seed) => seed.id), ...dismissIds]);
  const anchor = seeds[0];
  const rules = candidates.map((candidate) => ({ ...candidate, score: seeds.reduce((total, seed, index) => total + ruleScore(seed, candidate) / (index + 1), 0), source: "rule", reason: `Based on your recent ${materialType === "book" ? "library activity" : "thesis activity"}` }))
    .sort((a, b) => b.score - a.score);
  const selected = materialType === "book"
    ? selectBookRecommendations(rules, await semanticMatches(anchor, candidates, BOOK_AI_LIMIT, new Set(rules.slice(0, BOOK_RULE_LIMIT).map((item) => item.id))))
    : rules.slice(0, THESIS_LIMIT);
  const rows = await serialize(selected.map((row) => ({ ...row, reason: row.source === "ai" ? "Similar to your recent reading" : row.reason })));
  return { material_type: materialType, rows, has_history: true };
};

const dismiss = async (userId, bookId) => {
  const book = await repository.findBookId(bookId);
  if (!book) { const error = new Error("Catalogue record not found"); error.status = 404; throw error; }
  await repository.dismissBook(userId, bookId);
};

const listMetadataBooks = async ({ query = "", needsAttention = false, page = 1, limit = 25 } = {}) => {
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
    };
  });
  return { rows, pagination: { page, limit, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / limit)) } };
};

const getManualMetadata = async (bookId) => {
  const record = await repository.findBookMetadataRecord(bookId);
  if (!record) { const error = new Error("Book not found"); error.status = 404; throw error; }
  if (record.material_type !== "book") { const error = new Error("Manual AI details are available for books only"); error.status = 400; throw error; }
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
    embeddingStatus: record.embedding_status || "missing",
    embeddingError: record.embedding_error ? publicEmbeddingError(record.embedding_error) : null,
  };
};

const saveManualMetadata = async (bookId, payload = {}) => {
  const record = await repository.findBookMetadataRecord(bookId);
  if (!record) { const error = new Error("Book not found"); error.status = 404; throw error; }
  if (record.material_type !== "book") { const error = new Error("Manual AI details are available for books only"); error.status = 400; throw error; }
  const existing = parseEnrichment(record.enrichment_json);
  if (payload.summary !== undefined && typeof payload.summary !== "string") { const error = new Error("Book summary must be text"); error.status = 400; throw error; }
  const summary = payload.summary === undefined ? String(existing.description || "") : payload.summary.trim();
  if (summary.length > 8000) { const error = new Error("The book summary must be 8,000 characters or fewer"); error.status = 400; throw error; }
  if (payload.subjects !== undefined && !Array.isArray(payload.subjects)) { const error = new Error("Subjects must be sent as a list"); error.status = 400; throw error; }
  if ((payload.subjects || []).length > 40 || (payload.subjects || []).some((subject) => typeof subject !== "string")) { const error = new Error("Enter up to 40 subjects as text"); error.status = 400; throw error; }
  const subjects = payload.subjects === undefined
    ? (Array.isArray(existing.subjects) ? existing.subjects : [])
    : [...new Map(payload.subjects.map((subject) => subject.trim()).filter(Boolean).map((subject) => [normalized(subject), subject])).values()];
  if (subjects.length > 40 || subjects.some((subject) => subject.length > 160)) { const error = new Error("Enter up to 40 subjects, each 160 characters or fewer"); error.status = 400; throw error; }
  const additional = payload.additionalDetails ?? {};
  if (!additional || typeof additional !== "object" || Array.isArray(additional)) { const error = new Error("Additional book details must be sent as an object"); error.status = 400; throw error; }
  const cleanText = (key, maxLength, label) => {
    if (additional[key] === undefined) return typeof existing[key] === "string" ? existing[key] : "";
    if (typeof additional[key] !== "string") { const error = new Error(`${label} must be text`); error.status = 400; throw error; }
    const value = additional[key].trim();
    if (value.length > maxLength) { const error = new Error(`${label} must be ${maxLength} characters or fewer`); error.status = 400; throw error; }
    return value;
  };
  const publisher = cleanText("publisher", 200, "Publisher");
  const language = cleanText("language", 80, "Language");
  const publishedDate = cleanText("publishedDate", 64, "Publication date");
  let categories = Array.isArray(existing.categories) ? existing.categories : [];
  if (additional.categories !== undefined) {
    if (!Array.isArray(additional.categories) || additional.categories.length > 40 || additional.categories.some((category) => typeof category !== "string")) {
      const error = new Error("Enter up to 40 categories as text"); error.status = 400; throw error;
    }
    categories = [...new Map(additional.categories.map((category) => category.trim()).filter(Boolean).map((category) => [normalized(category), category])).values()];
    if (categories.some((category) => category.length > 160)) { const error = new Error("Each category must be 160 characters or fewer"); error.status = 400; throw error; }
  }
  let pageCount = existing.pageCount ?? null;
  if (additional.pageCount !== undefined) {
    const rawPageCount = additional.pageCount;
    if (rawPageCount === null || rawPageCount === "") pageCount = null;
    else {
      const parsedPageCount = typeof rawPageCount === "number" ? rawPageCount : (typeof rawPageCount === "string" && /^\d+$/.test(rawPageCount.trim()) ? Number(rawPageCount) : NaN);
      if (!Number.isInteger(parsedPageCount) || parsedPageCount < 1 || parsedPageCount > 100000) { const error = new Error("Page count must be a whole number from 1 to 100,000"); error.status = 400; throw error; }
      pageCount = parsedPageCount;
    }
  }
  const enrichment = { ...existing, description: summary, subjects, publisher, categories, language, pageCount, publishedDate };
  if (!hasUsefulMetadata(enrichment)) { const error = new Error("Add at least one book detail before saving"); error.status = 400; throw error; }
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

const toText = (value) => typeof value === "string" ? value : (value?.value || value?.text || "");
const unique = (values) => [...new Set(values.filter(Boolean).map((value) => String(value).trim()))];
const fetchJson = async (url, headers = {}) => { const response = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(8000) }); if (!response.ok) throw new Error(`Metadata source failed (${response.status})`); return response.json(); };
const fetchOpenLibraryJson = (url) => {
  const request = openLibraryQueue.then(async () => {
    const waitMs = Math.max(0, 1000 - (Date.now() - openLibraryLastRequestAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    openLibraryLastRequestAt = Date.now();
    const contact = String(process.env.OPEN_LIBRARY_CONTACT_EMAIL || "").replace(/[\r\n()]/g, "").trim();
    const userAgent = `ECULibraryCatalogue/1.0${contact ? ` (${contact})` : ""}`;
    return fetchJson(url, { "User-Agent": userAgent });
  });
  openLibraryQueue = request.then(() => undefined, () => undefined);
  return request;
};
const enrichBook = async (bookId) => {
  const existing = await repository.findEnrichment(bookId);
  const savedEnrichment = parseEnrichment(existing?.enrichment_json);
  if (existing?.source === "manual") return savedEnrichment;
  if (existing?.status === "ready" && hasUsefulMetadata(savedEnrichment)) return savedEnrichment;
  const book = await repository.findBookIsbn(bookId);
  if (!book?.isbn) return null;
  const isbn = encodeURIComponent(book.isbn);
  const googleKey = String(process.env.GOOGLE_BOOKS_API_KEY || "").trim();
  const requests = [
    fetchOpenLibraryJson(`https://openlibrary.org/search.json?isbn=${isbn}&fields=title,author_name,subject,publisher,language,number_of_pages_median,publish_year,first_publish_year&limit=1`),
  ];
  if (googleKey) requests.push(fetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${encodeURIComponent(googleKey)}`));
  const results = await Promise.allSettled(requests);
  const openResult = results[0];
  const googleResult = results[1];
  const errors = [];
  let open = {};
  let google = {};
  if (openResult.status === "fulfilled") open = openResult.value;
  else errors.push(`Open Library: ${String(openResult.reason?.message || openResult.reason)}`);
  if (googleResult?.status === "fulfilled") google = googleResult.value;
  else if (googleResult?.status === "rejected") errors.push(`Google Books: ${String(googleResult.reason?.message || googleResult.reason)}`);
  const openRecord = open.docs?.[0] || {};
  const googleRecord = google.items?.[0]?.volumeInfo || {};
  const enrichment = {
    description: toText(googleRecord.description),
    subjects: unique([...(Array.isArray(openRecord.subject) ? openRecord.subject : []), ...(Array.isArray(googleRecord.categories) ? googleRecord.categories : [])]),
    categories: unique(Array.isArray(googleRecord.categories) ? googleRecord.categories : []), publisher: googleRecord.publisher || openRecord.publisher?.[0] || "",
    language: googleRecord.language || openRecord.language?.[0] || "", pageCount: googleRecord.pageCount || openRecord.number_of_pages_median || null,
    publishedDate: googleRecord.publishedDate || openRecord.publish_year?.[0] || openRecord.first_publish_year || "",
  };
  if (!hasUsefulMetadata(enrichment) && errors.length) {
    const lookupError = errors.join("; ").slice(0, 500);
    await repository.markEnrichmentFailed(book.id, lookupError);
    return { __lookupFailed: true, __lookupError: lookupError };
  }
  await repository.saveEnrichment(book.id, enrichment);
  return enrichment;
};

const embedBook = async (bookId) => {
  const book = await repository.findBookForEmbedding(bookId);
  if (!book) return null;
  const enrichmentRow = await repository.findReadyEnrichment(bookId);
  let enrichment = {}; try { enrichment = enrichmentRow ? JSON.parse(enrichmentRow.enrichment_json) : {}; } catch { enrichment = {}; }
  const hash = contentHash(book, enrichment); const model = embeddingModel();
  if (process.env.AI_EMBEDDING_PROVIDER !== "gemini" || !process.env.GEMINI_API_KEY) throw new Error("Gemini embedding provider is not configured");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`,
    { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, body: JSON.stringify({ model: `models/${model}`, taskType: "SEMANTIC_SIMILARITY", content: { parts: [{ text: embeddingText(book, enrichment) }] } }), signal: AbortSignal.timeout(30000) }
  );
  if (!response.ok) {
    const providerMessage = await response.text();
    throw new Error(`Gemini embedding request failed (${response.status}): ${providerMessage.slice(0, 400)}`);
  }
  const payload = await response.json(); const vector = payload.embedding?.values;
  if (!Array.isArray(vector) || !vector.length) throw new Error("Gemini returned no embedding vector");
  await repository.saveEmbedding({ bookId: book.id, model, hash, vector });
  return { bookId: book.id, dimensions: vector.length };
};
const markEmbeddingStale = async (bookId) => repository.markEmbeddingStale(bookId, embeddingModel());
const queueEmbedding = async (bookId) => {
  await markEmbeddingStale(bookId);
  setImmediate(async () => {
    try { await embedBook(bookId); }
    catch (error) {
      await repository.markEmbeddingFailed(bookId, String(error.message || error).slice(0, 500)).catch(() => {});
      console.error("[recommendations] embedding failed:", error.message);
    }
  });
};
const queueEnrichmentAndEmbedding = (bookId) => new Promise((resolve) => {
  setImmediate(() => {
    enrichBook(bookId)
      .then(() => queueEmbedding(bookId))
      .catch((error) => console.error("[recommendations] enrichment/embedding refresh:", error))
      .finally(resolve);
  });
});
const runBackfill = async (books) => {
  for (const book of books) {
    activeBackfill.currentTitle = book.title;
    try {
      const enrichment = await enrichBook(book.id);
      if (enrichment?.__lookupFailed) {
        activeBackfill.lookupFailed += 1;
        const lookupError = publicMetadataError(enrichment.__lookupError);
        if (lookupError && !activeBackfill.lookupErrors.includes(lookupError) && activeBackfill.lookupErrors.length < 4) activeBackfill.lookupErrors.push(lookupError);
      }
      await embedBook(book.id);
      activeBackfill.embedded += 1;
    } catch (error) {
      activeBackfill.failed += 1;
      const message = `${book.title}: ${publicEmbeddingError(error)}`.slice(0, 240);
      if (!activeBackfill.errors.includes(message)) activeBackfill.errors.push(message);
    } finally {
      activeBackfill.completed += 1;
    }
  }
  activeBackfill.status = activeBackfill.failed ? "completed_with_errors" : "completed";
  activeBackfill.currentTitle = null;
};
const startBackfill = async () => {
  if (activeBackfill.status === "running") return { ...activeBackfill, alreadyRunning: true };
  const books = await repository.findBooksForBackfill();
  activeBackfill = { status: "running", total: books.length, completed: 0, embedded: 0, failed: 0, lookupFailed: 0, skipped: 0, currentTitle: null, errors: [], lookupErrors: [] };
  if (!books.length) { activeBackfill.status = "completed"; return { ...activeBackfill }; }
  setImmediate(() => runBackfill(books).catch((error) => {
    activeBackfill.status = "completed_with_errors";
    activeBackfill.errors.push(String(error?.message || error || "Backfill failed").slice(0, 180));
  }));
  return { ...activeBackfill };
};
const backfillProgress = () => ({ ...activeBackfill, errors: [...activeBackfill.errors] });
const embeddingStatus = async () => {
  const { row, errors } = await repository.getEmbeddingStatus();
  return { total: Number(row.total || 0), ready: Number(row.ready || 0), stale: Number(row.stale || 0), failed: Number(row.failed || 0), missing: Number(row.missing || 0), errors: errors.map((entry) => ({ bookId: entry.book_id, message: String(entry.last_error).replace(/key=[^&\s]+/gi, "key=[redacted]") })) };
};

module.exports = { recommendationsForSeed, personalized, dismiss, listMetadataBooks, getManualMetadata, saveManualMetadata, embedBook, enrichBook, markEmbeddingStale, queueEmbedding, queueEnrichmentAndEmbedding, startBackfill, backfillProgress, embeddingStatus };

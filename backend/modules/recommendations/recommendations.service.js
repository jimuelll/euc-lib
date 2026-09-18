const crypto = require("crypto");
const repository = require("./recommendations.repository");
const { hydrateCatalogRecord, parseMetadata } = require("../catalog/catalog.projection");

const BOOK_LIMIT = 5;
const THESIS_LIMIT = 5;
const embeddingModel = () => process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
let activeBackfill = { status: "idle", total: 0, completed: 0, embedded: 0, failed: 0, skipped: 0, currentTitle: null, errors: [] };

const normalized = (value) => String(value || "").toLowerCase().trim();
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
    : [book.title, book.author, metadata.category, metadata.edition, metadata.publication_year, enrichment.description, ...(enrichment.subjects || []), ...(enrichment.categories || []), enrichment.publisher, enrichment.language];
  return fields.filter(Boolean).join("\n");
};
const contentHash = (book, enrichment) => crypto.createHash("sha256").update(embeddingText(book, enrichment)).digest("hex");

const publicFields = async () => {
  return new Set(await repository.getPublicFieldKeys());
};
const activeCandidates = async (materialType, excludedIds = []) => {
  return repository.findActiveCandidates(materialType, excludedIds);
};
const serialize = async (records) => {
  const fields = [...await publicFields()];
  return records.map((record) => {
    const hydrated = hydrateCatalogRecord(record, { publicKeys: fields });
    return {
      id: hydrated.id, title: hydrated.title, author: hydrated.author, isbn: hydrated.isbn,
      copies: hydrated.copies, material_type: hydrated.material_type, metadata: hydrated.metadata,
      ...hydrated.metadata, canBorrow: hydrated.canBorrow, canReserve: hydrated.canReserve,
      available: Number(record.available || 0), total_copies: Number(record.total_copies || 0),
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

const recommendationsForSeed = async (bookId) => {
  const seed = await repository.findBook(bookId);
  if (!seed) { const error = new Error("Catalogue record not found"); error.status = 404; throw error; }
  const candidates = await activeCandidates(seed.material_type, [seed.id]);
  const ruleLimit = seed.material_type === "book" ? 3 : THESIS_LIMIT;
  const rules = candidates.map((candidate) => ({ ...candidate, score: ruleScore(seed, candidate), source: "rule", reason: ruleReason(seed, candidate) }))
    .sort((a, b) => b.score - a.score || b.popularity - a.popularity).slice(0, ruleLimit);
  const semantic = seed.material_type === "book" ? await semanticMatches(seed, candidates, 2, new Set(rules.map((item) => item.id))) : [];
  return { material_type: seed.material_type, rows: await serialize([...rules, ...semantic]) };
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
  const ruleLimit = materialType === "book" ? 3 : THESIS_LIMIT;
  const rules = candidates.map((candidate) => ({ ...candidate, score: seeds.reduce((total, seed, index) => total + ruleScore(seed, candidate) / (index + 1), 0), source: "rule", reason: `Based on your recent ${materialType === "book" ? "library activity" : "thesis activity"}` }))
    .sort((a, b) => b.score - a.score).slice(0, ruleLimit);
  const semantic = materialType === "book" ? await semanticMatches(anchor, candidates, 2, new Set(rules.map((item) => item.id))) : [];
  const rows = await serialize([...rules, ...semantic].map((row) => ({ ...row, reason: row.source === "ai" ? "Similar to your recent reading" : row.reason })));
  return { material_type: materialType, rows, has_history: true };
};

const dismiss = async (userId, bookId) => {
  const book = await repository.findBookId(bookId);
  if (!book) { const error = new Error("Catalogue record not found"); error.status = 404; throw error; }
  await repository.dismissBook(userId, bookId);
};

const toText = (value) => typeof value === "string" ? value : (value?.value || value?.text || "");
const unique = (values) => [...new Set(values.filter(Boolean).map((value) => String(value).trim()))];
const fetchJson = async (url) => { const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }); if (!response.ok) throw new Error(`Metadata source failed (${response.status})`); return response.json(); };
const enrichBook = async (bookId) => {
  const book = await repository.findBookIsbn(bookId);
  if (!book?.isbn) return null;
  try {
    const open = await fetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(book.isbn)}&format=json&jscmd=data`);
    const openRecord = open[`ISBN:${book.isbn}`] || {};
    let googleRecord = {};
    try {
      const key = process.env.GOOGLE_BOOKS_API_KEY ? `&key=${encodeURIComponent(process.env.GOOGLE_BOOKS_API_KEY)}` : "";
      const google = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(book.isbn)}${key}`);
      googleRecord = google.items?.[0]?.volumeInfo || {};
    } catch { /* Open Library data remains useful when Google Books is unavailable. */ }
    const enrichment = {
      description: toText(googleRecord.description) || toText(openRecord.description),
      subjects: unique([...(openRecord.subjects || []).map((item) => item.name || item), ...(googleRecord.categories || [])]),
      categories: unique(googleRecord.categories || []), publisher: googleRecord.publisher || openRecord.publishers?.[0]?.name || "",
      language: googleRecord.language || "", pageCount: googleRecord.pageCount || openRecord.number_of_pages || null,
      publishedDate: googleRecord.publishedDate || openRecord.publish_date || "",
    };
    await repository.saveEnrichment(book.id, enrichment);
    return enrichment;
  } catch (error) {
    await repository.markEnrichmentFailed(book.id, String(error.message || error).slice(0, 500));
    return {};
  }
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
    { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, body: JSON.stringify({ model: `models/${model}`, taskType: "SEMANTIC_SIMILARITY", content: { parts: [{ text: embeddingText(book, enrichment) }] } }) }
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
      await enrichBook(book.id);
      await embedBook(book.id);
      activeBackfill.embedded += 1;
    } catch (error) {
      activeBackfill.failed += 1;
      const message = String(error?.message || error || "Embedding failed").replace(/key=[^&\s]+/gi, "key=[redacted]").slice(0, 180);
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
  activeBackfill = { status: "running", total: books.length, completed: 0, embedded: 0, failed: 0, skipped: 0, currentTitle: null, errors: [] };
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
  return { total: Number(row.total || 0), ready: Number(row.ready || 0), stale: Number(row.stale || 0), failed: Number(row.failed || 0), errors: errors.map((entry) => ({ bookId: entry.book_id, message: String(entry.last_error).replace(/key=[^&\s]+/gi, "key=[redacted]") })) };
};

module.exports = { recommendationsForSeed, personalized, dismiss, embedBook, enrichBook, markEmbeddingStale, queueEmbedding, queueEnrichmentAndEmbedding, startBackfill, backfillProgress, embeddingStatus };

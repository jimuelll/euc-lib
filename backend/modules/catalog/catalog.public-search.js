const { availableToBorrow } = require("./copyEligibility");

const cleanText = (value) => String(value ?? "").trim().slice(0, 160);

function normalizePublicCatalogFilters(options = {}) {
  return {
    query: cleanText(options.query),
    title: cleanText(options.title),
    author: cleanText(options.author),
    isbn: cleanText(options.isbn),
    materialType: ["book", "thesis"].includes(options.format ?? options.materialType) ? (options.format ?? options.materialType) : "all",
    availability: ["available", "unavailable"].includes(options.availability) ? options.availability : "all",
    subject: cleanText(options.subject),
    sort: ["title_asc", "title_desc", "newest"].includes(options.sort) ? options.sort : "relevance",
    page: Math.max(1, Number.parseInt(options.page, 10) || 1),
    limit: Math.min(50, Math.max(1, Number.parseInt(options.limit, 10) || 20)),
  };
}

function buildPublicCatalogWhere(filters, { showUnheldInOpac = true, omitFacets = false } = {}) {
  const conditions = ["bk.deleted_at IS NULL"];
  const params = [];

  if (!showUnheldInOpac) {
    conditions.push(`(bk.material_type = 'thesis' OR EXISTS (
      SELECT 1 FROM book_copies held_bc JOIN copy_holdings held_h ON held_h.copy_id = held_bc.id
       WHERE held_bc.book_id = bk.id AND held_bc.deleted_at IS NULL AND held_bc.is_active = 1
         AND held_bc.condition IN ('good','damaged') AND held_h.accession_number IS NOT NULL
         AND TRIM(held_h.accession_number) <> ''
         AND NOT EXISTS (SELECT 1 FROM accession_claim_voids held_void WHERE held_void.accession_number = held_h.accession_number)
    ))`);
  }

  if (filters.query) {
    const like = `%${filters.query}%`;
    conditions.push("(bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ? OR JSON_SEARCH(bk.metadata, 'one', ?) IS NOT NULL)");
    params.push(like, like, like, like);
  }
  for (const [key, column] of [["title", "bk.title"], ["author", "bk.author"], ["isbn", "bk.isbn"]]) {
    if (filters[key]) {
      conditions.push(`${column} LIKE ?`);
      params.push(`%${filters[key]}%`);
    }
  }

  if (!omitFacets && filters.materialType !== "all") {
    conditions.push("bk.material_type = ?");
    params.push(filters.materialType);
  }
  if (!omitFacets && filters.availability !== "all") {
    const available = `EXISTS (SELECT 1 FROM book_copies filter_copy WHERE filter_copy.book_id = bk.id AND ${availableToBorrow("filter_copy")})`;
    conditions.push(`bk.material_type = 'book' AND ${filters.availability === "available" ? available : `NOT ${available}`}`);
  }
  if (!omitFacets && filters.subject) {
    conditions.push(`(
      LOWER(JSON_UNQUOTE(JSON_EXTRACT(bk.metadata, '$.category'))) = LOWER(?)
      OR JSON_SEARCH(bk.metadata, 'one', ?, CHAR(92), '$.subjects[*]') IS NOT NULL
    )`);
    params.push(filters.subject, filters.subject);
  }

  return { clause: `WHERE ${conditions.join(" AND ")}`, params };
}

function publicCatalogOrder(filters) {
  if (filters.sort === "title_asc") return "bk.title ASC, bk.id ASC";
  if (filters.sort === "title_desc") return "bk.title DESC, bk.id DESC";
  if (filters.sort === "newest") return "bk.created_at DESC, bk.title ASC";
  if (!filters.query) return "bk.title ASC, bk.id ASC";
  return "CASE WHEN bk.title = ? THEN 0 WHEN bk.title LIKE ? THEN 1 WHEN bk.author LIKE ? THEN 2 WHEN bk.isbn LIKE ? THEN 3 ELSE 4 END, bk.title ASC, bk.id ASC";
}

function extractPublicSubjects(rows) {
  const subjects = new Map();
  for (const row of rows) {
    let metadata = row.metadata;
    if (typeof metadata === "string") {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }
    if (!metadata || typeof metadata !== "object") continue;
    const values = [metadata.category, ...(Array.isArray(metadata.subjects) ? metadata.subjects : typeof metadata.subjects === "string" ? [metadata.subjects] : [])];
    const seen = new Set();
    for (const rawValue of values) {
      const value = String(rawValue ?? "").trim();
      const key = value.toLocaleLowerCase();
      if (!value || seen.has(key)) continue;
      seen.add(key);
      const current = subjects.get(key) ?? { value, count: 0 };
      current.count += 1;
      subjects.set(key, current);
    }
  }
  return [...subjects.values()]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, 50);
}

module.exports = { normalizePublicCatalogFilters, buildPublicCatalogWhere, publicCatalogOrder, extractPublicSubjects };

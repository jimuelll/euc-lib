import copyEligibility = require("./copyEligibility");
const { normalizePagination } = require("../../middlewares/numericInput");

const { availableToBorrow } = copyEligibility;

interface PublicCatalogOptions extends Record<string, any> {
  query?: unknown;
  title?: unknown;
  author?: unknown;
  isbn?: unknown;
  format?: unknown;
  materialType?: unknown;
  availability?: unknown;
  category?: unknown;
  sort?: unknown;
  page?: unknown;
  limit?: unknown;
}
interface PublicCatalogFilters {
  query: string;
  title: string;
  author: string;
  isbn: string;
  materialType: "book" | "thesis" | "all";
  availability: "available" | "unavailable" | "all";
  category: string;
  sort: "title_asc" | "title_desc" | "newest" | "relevance";
  page: number;
  limit: number;
}
interface PublicCatalogRow extends Record<string, any> {
  metadata?: unknown;
}

const cleanText = (value: unknown): string => String(value ?? "").trim().slice(0, 160);

function normalizePublicCatalogFilters(options: PublicCatalogOptions = {}): PublicCatalogFilters {
  const materialType = options.format ?? options.materialType;
  const availability = options.availability;
  const sort = options.sort;
  const pagination = normalizePagination(options.page, options.limit, 20, 50);
  return {
    query: cleanText(options.query),
    title: cleanText(options.title),
    author: cleanText(options.author),
    isbn: cleanText(options.isbn),
    materialType: materialType === "book" || materialType === "thesis" ? materialType : "all",
    availability: availability === "available" || availability === "unavailable" ? availability : "all",
    category: cleanText(options.category),
    sort: sort === "title_asc" || sort === "title_desc" || sort === "newest" ? sort : "relevance",
    page: pagination.safePage,
    limit: pagination.safeLimit,
  };
}

function buildPublicCatalogWhere(filters: PublicCatalogFilters, { showUnheldInOpac = true, omitFacets = false }: { showUnheldInOpac?: boolean; omitFacets?: boolean } = {}): { clause: string; params: any[] } {
  const conditions = ["bk.deleted_at IS NULL"];
  const params: any[] = [];

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
  for (const [key, column] of [["title", "bk.title"], ["author", "bk.author"], ["isbn", "bk.isbn"]] as const) {
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
  if (!omitFacets && filters.category) {
    conditions.push("LOWER(JSON_UNQUOTE(JSON_EXTRACT(bk.metadata, '$.category'))) = LOWER(?)");
    params.push(filters.category);
  }

  return { clause: `WHERE ${conditions.join(" AND ")}`, params };
}

function publicCatalogOrder(filters: PublicCatalogFilters): string {
  if (filters.sort === "title_asc") return "bk.title ASC, bk.id ASC";
  if (filters.sort === "title_desc") return "bk.title DESC, bk.id DESC";
  if (filters.sort === "newest") return "bk.created_at DESC, bk.title ASC";
  if (!filters.query) return "bk.title ASC, bk.id ASC";
  return "CASE WHEN bk.title = ? THEN 0 WHEN bk.title LIKE ? THEN 1 WHEN bk.author LIKE ? THEN 2 WHEN bk.isbn LIKE ? THEN 3 ELSE 4 END, bk.title ASC, bk.id ASC";
}

function extractPublicCategories(rows: PublicCatalogRow[]): Array<{ value: string; count: number }> {
  const categories = new Map<string, { value: string; count: number }>();
  for (const row of rows) {
    let metadata = row.metadata;
    if (typeof metadata === "string") {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }
    if (!metadata || typeof metadata !== "object") continue;
    const value = String((metadata as Record<string, any>).category ?? "").trim();
    const key = value.toLocaleLowerCase();
    if (!value) continue;
    const current = categories.get(key) ?? { value, count: 0 };
    current.count += 1;
    categories.set(key, current);
  }
  return [...categories.values()]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, 50);
}

export = { normalizePublicCatalogFilters, buildPublicCatalogWhere, publicCatalogOrder, extractPublicCategories };

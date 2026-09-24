const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const repository = require("../modules/catalog/catalog.repository");
const {
  buildPublicCatalogWhere,
  extractPublicSubjects,
  normalizePublicCatalogFilters,
  publicCatalogOrder,
} = require("../modules/catalog/catalog.public-search");

test("public catalogue filter builder combines search, format, availability, and subject safely", () => {
  const filters = normalizePublicCatalogFilters({
    query: "history", title: "atlas", author: "lee", isbn: "9780", format: "book",
    availability: "available", subject: "World History", sort: "title_desc", page: "3", limit: "200",
  });
  const where = buildPublicCatalogWhere(filters);
  assert.match(where.clause, /bk\.title LIKE \?/);
  assert.match(where.clause, /bk\.author LIKE \?/);
  assert.match(where.clause, /bk\.isbn LIKE \?/);
  assert.match(where.clause, /bk\.material_type = \?/);
  assert.match(where.clause, /book_copies filter_copy/);
  assert.match(where.clause, /JSON_SEARCH\(bk\.metadata, 'one', \?, CHAR\(92\), '\$\.subjects\[\*\]'\)/);
  assert.deepEqual(where.params, ["%history%", "%history%", "%history%", "%history%", "%atlas%", "%lee%", "%9780%", "book", "World History", "World History"]);
  assert.equal(filters.page, 3);
  assert.equal(filters.limit, 50);
  assert.equal(normalizePublicCatalogFilters({ format: "thesis" }).materialType, "thesis");
  assert.equal(normalizePublicCatalogFilters({ materialType: "book" }).materialType, "book");
  assert.equal(publicCatalogOrder(filters), "bk.title DESC, bk.id DESC");
  assert.equal(publicCatalogOrder(normalizePublicCatalogFilters({ sort: "newest" })), "bk.created_at DESC, bk.title ASC");
  assert.equal(publicCatalogOrder(normalizePublicCatalogFilters({ query: "atlas" })), "CASE WHEN bk.title = ? THEN 0 WHEN bk.title LIKE ? THEN 1 WHEN bk.author LIKE ? THEN 2 WHEN bk.isbn LIKE ? THEN 3 ELSE 4 END, bk.title ASC, bk.id ASC");
});

test("public subject facet counts categories and subject entries once per catalog record", () => {
  const subjects = extractPublicSubjects([
    { metadata: JSON.stringify({ category: "History", subjects: ["Oral History", "History"] }) },
    { metadata: { category: "History", subjects: ["Oral History", "Archives"] } },
    { metadata: "invalid json" },
  ]);
  assert.deepEqual(subjects, [
    { value: "History", count: 2 },
    { value: "Oral History", count: 2 },
    { value: "Archives", count: 1 },
  ]);
});

test("public search returns server pagination, filter counts, cover URL, and empty pages", async () => {
  const savedQuery = db.query;
  const calls = [];
  const record = { id: 14, title: "Atlas", material_type: "book", image_url: "https://res.cloudinary.com/euc/image/upload/atlas.jpg", metadata: JSON.stringify({ category: "Geography", subjects: ["Maps"] }) };
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes("SELECT COUNT(*) AS total FROM books bk")) return [[{ total: 31 }], []];
    if (sql.includes("GROUP BY bk.material_type")) return [[
      { material_type: "book", total: 9, available: 6 },
      { material_type: "thesis", total: 2, available: 0 },
    ], []];
    if (sql.includes("SELECT bk.metadata FROM books bk")) return [[{ metadata: record.metadata }], []];
    if (sql.includes("SELECT bk.id, bk.title")) return [[record], []];
    throw new Error(`Unexpected catalog query: ${sql}`);
  };
  try {
    const result = await repository.searchPublicCatalogue({ query: "atlas", materialType: "book", subject: "Geography", sort: "relevance", page: 2, limit: 10 });
    assert.equal(result.pagination.page, 2);
    assert.equal(result.pagination.limit, 10);
    assert.equal(result.pagination.total, 31);
    assert.equal(result.pagination.totalPages, 4);
    assert.equal(result.rows[0].image_url, record.image_url);
    assert.deepEqual(result.facets.format, { all: 11, book: 9, thesis: 2 });
    assert.deepEqual(result.facets.availability, { all: 11, available: 6, unavailable: 3 });
    assert.deepEqual(result.facets.subjects, [{ value: "Geography", count: 1 }, { value: "Maps", count: 1 }]);
    const countQuery = calls.find((call) => call.sql.includes("SELECT COUNT(*) AS total FROM books bk"));
    assert.match(countQuery.sql, /JSON_SEARCH\(bk\.metadata/);
    assert.equal(countQuery.params.at(-1), "Geography");
    assert.match(calls.find((call) => call.sql.includes("SELECT bk.id, bk.title")).sql, /bk\.image_url/);

    db.query = async (sql) => {
      if (sql.includes("SELECT COUNT(*) AS total FROM books bk")) return [[{ total: 0 }], []];
      if (sql.includes("GROUP BY bk.material_type")) return [[], []];
      if (sql.includes("SELECT bk.metadata FROM books bk")) return [[], []];
      if (sql.includes("SELECT bk.id, bk.title")) return [[], []];
      throw new Error(`Unexpected catalog query: ${sql}`);
    };
    const empty = await repository.searchPublicCatalogue({ query: "no match", page: 5 });
    assert.deepEqual(empty.rows, []);
    assert.equal(empty.pagination.total, 0);
    assert.equal(empty.pagination.totalPages, 1);
  } finally {
    db.query = savedQuery;
  }
});

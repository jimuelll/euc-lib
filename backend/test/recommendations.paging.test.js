const test = require("node:test");
const assert = require("node:assert/strict");
const repository = require("../modules/recommendations/recommendations.repository");
const catalogSettings = require("../modules/catalog/catalog.settings.service");
const service = require("../modules/recommendations/recommendations.service");

const candidate = (id, materialType = "book") => ({
  id,
  title: `Candidate ${id}`,
  author: "Test Author",
  isbn: null,
  image_url: null,
  copies: 1,
  material_type: materialType,
  metadata: JSON.stringify(materialType === "book" ? { category: "Literature" } : { thesis_program: "Education" }),
  available: 1,
  total_copies: 1,
  has_active_policy: 1,
  popularity: id,
});

test("book recommendation endpoints return eight unique picks and fill short AI sets with ranked rules", async () => {
  const originals = {
    findBook: repository.findBook,
    findActiveCandidates: repository.findActiveCandidates,
    getPublicFieldKeys: repository.getPublicFieldKeys,
    findEmbedding: repository.findEmbedding,
    findEmbeddings: repository.findEmbeddings,
    findHistorySeeds: repository.findHistorySeeds,
    findDismissedBookIds: repository.findDismissedBookIds,
    getCatalogSettings: catalogSettings.getCatalogSettings,
  };
  const seed = candidate(100);
  const candidates = Array.from({ length: 12 }, (_, index) => candidate(index + 1));
  try {
    repository.findBook = async () => seed;
    repository.findActiveCandidates = async () => candidates;
    repository.getPublicFieldKeys = async () => [];
    repository.findEmbedding = async (id) => id === seed.id ? { vector_json: "[1,0]" } : null;
    repository.findEmbeddings = async (ids) => ids
      .filter((id) => id !== 10 && id !== 11 && id !== 12)
      .map((book_id) => ({ book_id, vector_json: "[1,0]" }));
    repository.findHistorySeeds = async () => [seed];
    repository.findDismissedBookIds = async () => [];
    catalogSettings.getCatalogSettings = async () => ({ show_unheld_in_opac: true });

    const seeded = await service.recommendationsForSeed(seed.id);
    assert.equal(seeded.rows.length, 8);
    assert.equal(new Set(seeded.rows.map((row) => row.id)).size, 8);
    assert.deepEqual(seeded.rows.slice(0, 5).map((row) => row.source), ["ai", "ai", "ai", "ai", "ai"]);
    assert.deepEqual(seeded.rows.slice(5).map((row) => row.source), ["rule", "rule", "rule"]);

    repository.findEmbeddings = async (ids) => ids
      .filter((id) => id === 1 || id === 2)
      .map((book_id) => ({ book_id, vector_json: "[1,0]" }));
    const shortAiSet = await service.recommendationsForSeed(seed.id);
    assert.equal(shortAiSet.rows.length, 8);
    assert.equal(new Set(shortAiSet.rows.map((row) => row.id)).size, 8);
    assert.deepEqual(shortAiSet.rows.slice(0, 2).map((row) => row.source), ["ai", "ai"]);
    assert.deepEqual(shortAiSet.rows.slice(2, 5).map((row) => row.source), ["rule", "rule", "rule"]);
    assert.deepEqual(shortAiSet.rows.slice(5).map((row) => row.source), ["rule", "rule", "rule"]);

    const personal = await service.personalized(77, "book");
    assert.equal(personal.rows.length, 8);
    assert.equal(new Set(personal.rows.map((row) => row.id)).size, 8);
    assert.deepEqual(personal.rows.slice(0, 2).map((row) => row.source), ["ai", "ai"]);
  } finally {
    Object.assign(repository, {
      findBook: originals.findBook,
      findActiveCandidates: originals.findActiveCandidates,
      getPublicFieldKeys: originals.getPublicFieldKeys,
      findEmbedding: originals.findEmbedding,
      findEmbeddings: originals.findEmbeddings,
      findHistorySeeds: originals.findHistorySeeds,
      findDismissedBookIds: originals.findDismissedBookIds,
    });
    catalogSettings.getCatalogSettings = originals.getCatalogSettings;
  }
});

test("thesis recommendations stay capped at five", async () => {
  const originals = {
    findBook: repository.findBook,
    findActiveCandidates: repository.findActiveCandidates,
    getPublicFieldKeys: repository.getPublicFieldKeys,
  };
  const seed = candidate(200, "thesis");
  try {
    repository.findBook = async () => seed;
    repository.findActiveCandidates = async () => Array.from({ length: 8 }, (_, index) => candidate(index + 201, "thesis"));
    repository.getPublicFieldKeys = async () => [];
    const response = await service.recommendationsForSeed(seed.id);
    assert.equal(response.rows.length, 5);
    assert.ok(response.rows.every((row) => row.material_type === "thesis" && row.source === "rule"));
  } finally {
    Object.assign(repository, originals);
  }
});

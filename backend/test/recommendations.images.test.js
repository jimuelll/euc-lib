const test = require("node:test");
const assert = require("node:assert/strict");
const repository = require("../modules/recommendations/recommendations.repository");
const catalogSettings = require("../modules/catalog/catalog.settings.service");
const service = require("../modules/recommendations/recommendations.service");

const candidate = ({ id, title, materialType = "book", imageUrl = null, available = 1, checked_out = 0, reserved_copies = 0 }) => ({
  id,
  title,
  author: "Test Author",
  isbn: null,
  image_url: imageUrl,
  copies: 1,
  material_type: materialType,
  metadata: JSON.stringify(materialType === "book" ? { category: "Literature" } : { thesis_program: "Education" }),
  available,
  checked_out,
  reserved_copies,
  total_copies: 1,
  has_active_policy: 1,
  popularity: 0,
});

test("seed and personal recommendations return book image URLs and null for missing covers", async () => {
  const originals = {
    findBook: repository.findBook,
    findActiveCandidates: repository.findActiveCandidates,
    getPublicFieldKeys: repository.getPublicFieldKeys,
    findEmbedding: repository.findEmbedding,
    findHistorySeeds: repository.findHistorySeeds,
    findDismissedBookIds: repository.findDismissedBookIds,
    getCatalogSettings: catalogSettings.getCatalogSettings,
  };

  const seed = candidate({ id: 9001, title: "Seed", imageUrl: "https://covers.example/seed.jpg" });
  const withCover = candidate({ id: 9002, title: "Covered book", imageUrl: "https://covers.example/covered.jpg" });
  const withoutCover = candidate({ id: 9003, title: "Uncovered book" });
  try {
    repository.findBook = async () => seed;
    repository.findActiveCandidates = async (materialType) => materialType === "book" ? [withCover, withoutCover] : [];
    repository.getPublicFieldKeys = async () => [];
    repository.findEmbedding = async () => null;
    catalogSettings.getCatalogSettings = async () => ({ show_unheld_in_opac: true });

    const seeded = await service.recommendationsForSeed(seed.id);
    assert.deepEqual(seeded.rows.map((row) => row.image_url), ["https://covers.example/covered.jpg", null]);
    assert.ok(seeded.rows.every((row) => row.availability_status === "available"));

    repository.findHistorySeeds = async () => [seed];
    repository.findDismissedBookIds = async () => [];
    const personal = await service.personalized(77, "book");
    assert.deepEqual(personal.rows.map((row) => row.image_url), ["https://covers.example/covered.jpg", null]);
    assert.ok(personal.rows.every((row) => row.availability_status === "available"));
  } finally {
    Object.assign(repository, {
      findBook: originals.findBook,
      findActiveCandidates: originals.findActiveCandidates,
      getPublicFieldKeys: originals.getPublicFieldKeys,
      findEmbedding: originals.findEmbedding,
      findHistorySeeds: originals.findHistorySeeds,
      findDismissedBookIds: originals.findDismissedBookIds,
    });
    catalogSettings.getCatalogSettings = originals.getCatalogSettings;
  }
});

test("thesis recommendations serialize their image value for the thesis fallback", async () => {
  const originals = {
    findBook: repository.findBook,
    findActiveCandidates: repository.findActiveCandidates,
    getPublicFieldKeys: repository.getPublicFieldKeys,
  };
  const seed = candidate({ id: 9101, title: "Thesis seed", materialType: "thesis" });
  const related = candidate({ id: 9102, title: "Related thesis", materialType: "thesis" });
  try {
    repository.findBook = async () => seed;
    repository.findActiveCandidates = async () => [related];
    repository.getPublicFieldKeys = async () => [];
    const response = await service.recommendationsForSeed(seed.id);
    assert.equal(response.rows[0].material_type, "thesis");
    assert.equal(response.rows[0].image_url, null);
    assert.equal(response.rows[0].availability_status, "reference_only");
  } finally {
    Object.assign(repository, originals);
  }
});

test("recommendation responses expose current available, checked out, reserved, and unavailable book statuses", async () => {
  const originals = {
    findBook: repository.findBook,
    findActiveCandidates: repository.findActiveCandidates,
    getPublicFieldKeys: repository.getPublicFieldKeys,
    findEmbedding: repository.findEmbedding,
    getCatalogSettings: catalogSettings.getCatalogSettings,
  };
  const seed = candidate({ id: 9201, title: "Status seed" });
  const candidates = [
    candidate({ id: 9202, title: "Available copy", available: 1 }),
    candidate({ id: 9203, title: "Checked out copy", available: 0, checked_out: 1 }),
    candidate({ id: 9204, title: "Reserved copy", available: 0, reserved_copies: 1 }),
    candidate({ id: 9205, title: "Unavailable copy", available: 0, checked_out: 0, reserved: 0 }),
  ];
  try {
    repository.findBook = async () => seed;
    repository.findActiveCandidates = async () => candidates;
    repository.getPublicFieldKeys = async () => [];
    repository.findEmbedding = async () => null;
    catalogSettings.getCatalogSettings = async () => ({ show_unheld_in_opac: true });

    const response = await service.recommendationsForSeed(seed.id);
    assert.deepEqual(Object.fromEntries(response.rows.map((row) => [row.title, row.availability_status])), {
      "Available copy": "available",
      "Checked out copy": "checked_out",
      "Reserved copy": "reserved",
      "Unavailable copy": "unavailable",
    });
  } finally {
    Object.assign(repository, {
      findBook: originals.findBook,
      findActiveCandidates: originals.findActiveCandidates,
      getPublicFieldKeys: originals.getPublicFieldKeys,
      findEmbedding: originals.findEmbedding,
    });
    catalogSettings.getCatalogSettings = originals.getCatalogSettings;
  }
});

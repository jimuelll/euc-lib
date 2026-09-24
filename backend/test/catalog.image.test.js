const test = require("node:test");
const assert = require("node:assert/strict");
const cloudinary = require("cloudinary").v2;
const repository = require("../modules/catalog/catalog.repository");
const transactionalAudit = require("../modules/analytics/transactional-audit");
const { requireCatalogRole } = require("../modules/catalog/catalog.middleware");
const catalogRoutes = require("../modules/catalog/catalog.routes");
const { MAX_IMAGE_BYTES, validateCatalogImage, uploadBookImage, removeBookImage } = require("../modules/catalog/catalog.image.service");

const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const validPng = () => ({ buffer: pngBuffer, size: pngBuffer.length, mimetype: "image/png" });

test("catalog image validation enforces supported image signatures and the 5 MB limit", () => {
  assert.doesNotThrow(() => validateCatalogImage(validPng()));
  assert.throws(() => validateCatalogImage({ ...validPng(), size: MAX_IMAGE_BYTES + 1 }), { status: 413 });
  assert.throws(() => validateCatalogImage({ ...validPng(), mimetype: "image/jpeg" }), { status: 415 });
  assert.throws(() => validateCatalogImage({ ...validPng(), buffer: Buffer.from("not an image") }), { status: 415 });
});

test("book image routes require catalog staff authorization before upload handling", () => {
  const denied = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(body) { this.body = body; return this; } };
  requireCatalogRole({ user: { role: "student" } }, denied, () => assert.fail("student must not enter catalog image route"));
  assert.equal(denied.statusCode, 403);
  const accepted = { status(value) { this.statusCode = value; return this; }, json(body) { this.body = body; return this; } };
  let continued = false;
  requireCatalogRole({ user: { role: "staff" } }, accepted, () => { continued = true; });
  assert.equal(continued, true);
  for (const method of ["post", "delete"]) {
    const route = catalogRoutes.stack.find((layer) => layer.route?.path === "/books/:id/image" && layer.route.methods[method])?.route;
    assert.ok(route);
    assert.equal(route.stack[0].handle.name, "requireCatalogRole");
  }
});

test("cover replacement saves the new Cloudinary image before deleting the old image", async () => {
  const savedGetConnection = repository.getConnection;
  const savedAudit = transactionalAudit.enqueueTransactionalAudit;
  const savedUploadStream = cloudinary.uploader.upload_stream;
  const savedDestroy = cloudinary.uploader.destroy;
  const env = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].map((key) => [key, process.env[key]]);
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  const events = [];
  const book = { id: 12, title: "Atlas", material_type: "book", image_url: "https://old/cover.jpg", image_public_id: "library/catalog/books/old" };
  const connection = {
    async beginTransaction() { events.push("begin"); },
    async commit() { events.push("commit"); },
    async rollback() { events.push("rollback"); },
    release() { events.push("release"); },
    async query(sql, params) {
      events.push(sql.startsWith("UPDATE") ? "update" : "select");
      if (sql.startsWith("SELECT")) return [[{ ...book }], []];
      book.image_url = params[0]; book.image_public_id = params[1];
      return [{ affectedRows: 1 }, []];
    },
  };
  repository.getConnection = async () => connection;
  transactionalAudit.enqueueTransactionalAudit = async () => {};
  cloudinary.uploader.upload_stream = (options, callback) => ({ end() { events.push("upload"); callback(null, { secure_url: "https://new/cover.jpg", public_id: "library/catalog/books/new" }); } });
  cloudinary.uploader.destroy = async (publicId) => { events.push(`destroy:${publicId}`); return { result: "ok" }; };
  try {
    const image = await uploadBookImage(12, validPng(), 4);
    assert.deepEqual(image, { image_url: "https://new/cover.jpg", image_public_id: "library/catalog/books/new" });
    assert.ok(events.indexOf("commit") < events.indexOf("destroy:library/catalog/books/old"));
    assert.ok(events.includes("update"));
  } finally {
    repository.getConnection = savedGetConnection;
    transactionalAudit.enqueueTransactionalAudit = savedAudit;
    cloudinary.uploader.upload_stream = savedUploadStream;
    cloudinary.uploader.destroy = savedDestroy;
    for (const [key, value] of env) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});

test("thesis image upload is rejected and removing a book image clears storage and Cloudinary", async () => {
  const savedGetConnection = repository.getConnection;
  const savedAudit = transactionalAudit.enqueueTransactionalAudit;
  const savedUploadStream = cloudinary.uploader.upload_stream;
  const savedDestroy = cloudinary.uploader.destroy;
  const env = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].map((key) => [key, process.env[key]]);
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  let materialType = "thesis";
  const events = [];
  const connection = {
    async beginTransaction() {}, async commit() { events.push("commit"); }, async rollback() { events.push("rollback"); }, release() {},
    async query(sql) {
      if (sql.startsWith("SELECT")) return [[{ id: 13, title: "Research", material_type: materialType, image_url: "https://old/cover.jpg", image_public_id: "library/catalog/books/to-remove" }], []];
      events.push("clear");
      return [{ affectedRows: 1 }, []];
    },
  };
  repository.getConnection = async () => connection;
  transactionalAudit.enqueueTransactionalAudit = async () => {};
  let uploadCalled = false;
  cloudinary.uploader.upload_stream = () => { uploadCalled = true; return { end() {} }; };
  cloudinary.uploader.destroy = async (publicId) => { events.push(`destroy:${publicId}`); return { result: "ok" }; };
  try {
    for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) delete process.env[key];
    await assert.rejects(uploadBookImage(13, validPng()), { status: 400 });
    assert.equal(uploadCalled, false);
    assert.ok(events.includes("rollback"));
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    materialType = "book";
    await removeBookImage(13, 4);
    assert.ok(events.includes("clear"));
    assert.ok(events.includes("commit"));
    assert.ok(events.includes("destroy:library/catalog/books/to-remove"));
    assert.ok(events.indexOf("commit") < events.indexOf("destroy:library/catalog/books/to-remove"));
  } finally {
    repository.getConnection = savedGetConnection;
    transactionalAudit.enqueueTransactionalAudit = savedAudit;
    cloudinary.uploader.upload_stream = savedUploadStream;
    cloudinary.uploader.destroy = savedDestroy;
    for (const [key, value] of env) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});

const { randomUUID } = require("node:crypto");
const { v2: cloudinary } = require("cloudinary");
const repository = require("./catalog.repository");
const snapshotRepository = require("../backup/backup.repository");
const transactionalAudit = require("../analytics/transactional-audit");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_SIGNATURES = {
  "image/jpeg": (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  "image/png": (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (buffer) => buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP",
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const httpError = (message, status) => Object.assign(new Error(message), { status });

function validateCatalogImage(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) throw httpError("Choose an image to upload", 400);
  if (file.size > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) throw httpError("Images must be 5 MB or smaller", 413);
  const signatureMatches = IMAGE_SIGNATURES[file.mimetype]?.(file.buffer);
  if (!signatureMatches) throw httpError("Upload a valid JPG, PNG, or WebP image", 415);
}

function requireCloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw httpError("Cloudinary image storage is not configured", 503);
  }
}

function uploadBuffer(buffer, bookId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: "library/catalog/books",
      resource_type: "image",
      public_id: `book-${bookId}-${randomUUID()}`,
      overwrite: false,
      tags: ["catalog-book-cover"],
    }, (error, result) => {
      if (error) reject(error);
      else if (!result?.secure_url || !result?.public_id) reject(new Error("Cloudinary did not return an image URL"));
      else resolve({ image_url: result.secure_url, image_public_id: result.public_id });
    });
    stream.end(buffer);
  });
}

async function destroyImage(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (error) {
    console.warn("[catalog] Cloudinary image cleanup failed:", error.message);
  }
}

async function destroyImageIfUnreferenced(publicId) {
  if (!publicId) return;
  try {
    if (await snapshotRepository.isBookImageReferenced(publicId)) return;
    await destroyImage(publicId);
  } catch (error) {
    // A failed reference check must never make a restorable snapshot lose its image.
    console.warn("[catalog] Could not check snapshot references; preserving Cloudinary image:", error.message);
  }
}

async function uploadBookImage(bookId, file, actorId = null) {
  validateCatalogImage(file);
  const conn = await repository.getConnection();
  let uploaded = null;
  let oldPublicId = null;
  try {
    await conn.beginTransaction();
    const [[book]] = await conn.query(
      "SELECT id, title, material_type, image_url, image_public_id FROM books WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
      [bookId],
    );
    if (!book) throw httpError("Catalog record not found", 404);
    if (book.material_type !== "book") throw httpError("Theses always use the generic thesis image", 400);
    requireCloudinary();

    uploaded = await uploadBuffer(file.buffer, bookId);
    oldPublicId = book.image_public_id;
    await conn.query("UPDATE books SET image_url = ?, image_public_id = ? WHERE id = ? AND deleted_at IS NULL", [uploaded.image_url, uploaded.image_public_id, bookId]);
    await transactionalAudit.enqueueTransactionalAudit(conn, {
      actorId,
      route: `/api/admin/books/${bookId}/image`,
      description: `Updated cover image for “${book.title}”`,
      before: { cover_image: book.image_url ? "set" : "not set" },
      after: { cover_image: "set" },
    });
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    if (uploaded) await destroyImage(uploaded.image_public_id);
    throw error;
  } finally {
    conn.release();
  }
  if (oldPublicId && oldPublicId !== uploaded.image_public_id) await destroyImageIfUnreferenced(oldPublicId);
  return uploaded;
}

async function removeBookImage(bookId, actorId = null) {
  const conn = await repository.getConnection();
  let oldPublicId = null;
  try {
    await conn.beginTransaction();
    const [[book]] = await conn.query(
      "SELECT id, title, material_type, image_url, image_public_id FROM books WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
      [bookId],
    );
    if (!book) throw httpError("Catalog record not found", 404);
    if (book.material_type !== "book") throw httpError("Theses always use the generic thesis image", 400);
    oldPublicId = book.image_public_id;
    if (oldPublicId) requireCloudinary();
    if (oldPublicId || book.image_url) {
      await conn.query("UPDATE books SET image_url = NULL, image_public_id = NULL WHERE id = ? AND deleted_at IS NULL", [bookId]);
      await transactionalAudit.enqueueTransactionalAudit(conn, {
        actorId,
        route: `/api/admin/books/${bookId}/image`,
        action: "updated",
        description: `Removed cover image for “${book.title}”`,
        before: { cover_image: "set" },
        after: { cover_image: "not set" },
      });
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  await destroyImageIfUnreferenced(oldPublicId);
}

module.exports = { MAX_IMAGE_BYTES, validateCatalogImage, uploadBookImage, removeBookImage };

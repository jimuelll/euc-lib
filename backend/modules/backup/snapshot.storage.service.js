const { Readable } = require("stream");
const { gzip, gunzip } = require("zlib");
const { promisify } = require("util");
const cloudinary = require("cloudinary").v2;
const repository = require("./backup.repository");

const MAX_SNAPSHOTS = 30;
const DEFAULT_SNAPSHOT_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_SNAPSHOT_UPLOAD_TIMEOUT_MS = 2 * 60 * 1000;
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function requireCloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw Object.assign(new Error("Cloudinary storage is not configured."), { status: 503 });
  }
}

function configuredPositiveNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function snapshotMaxBytes() {
  return configuredPositiveNumber("SNAPSHOT_MAX_BYTES", DEFAULT_SNAPSHOT_MAX_BYTES);
}

function snapshotUploadTimeoutMs() {
  return configuredPositiveNumber("SNAPSHOT_UPLOAD_TIMEOUT_MS", DEFAULT_SNAPSHOT_UPLOAD_TIMEOUT_MS);
}

function serializeSnapshot(payload) {
  const contents = JSON.stringify(payload);
  const sizeBytes = Buffer.byteLength(contents);
  const maxBytes = snapshotMaxBytes();
  if (sizeBytes > maxBytes) {
    throw Object.assign(
      new Error(`The snapshot is ${sizeBytes} bytes, which exceeds the configured limit of ${maxBytes} bytes.`),
      { status: 413 }
    );
  }
  return { contents, sizeBytes };
}

async function uploadToCloudinary(contents, snapshotId) {
  const compressed = await gzipAsync(contents);
  const uploadTimeoutMs = snapshotUploadTimeoutMs();

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const stream = cloudinary.uploader.upload_stream({
      resource_type: "raw",
      type: "authenticated",
      folder: "euc-library-backups",
      public_id: snapshotId,
      format: "json",
      overwrite: false,
    }, (error, result) => error
      ? finish(reject, error)
      : finish(resolve, { result, compressedSizeBytes: compressed.byteLength }));

    stream.on("error", (error) => finish(reject, error));
    timer = setTimeout(() => {
      const error = Object.assign(new Error("Snapshot upload timed out."), { status: 504 });
      stream.destroy(error);
      finish(reject, error);
    }, uploadTimeoutMs);
    Readable.from([compressed]).pipe(stream);
  });
}

async function uploadSnapshot(payload, createdBy, kind = "manual") {
  requireCloudinary();
  const snapshotId = `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const { contents, sizeBytes } = serializeSnapshot(payload);
  const { result: upload, compressedSizeBytes } = await uploadToCloudinary(contents, snapshotId);
  const bookImagePublicIds = getBookImagePublicIds(payload);

  const filename = `euc-library-snapshot-${payload.createdAt.replace(/[:.]/g, "-")}.json`;
  const result = await repository.createSnapshotRecord({
    publicId: upload.public_id,
    filename,
    sizeBytes: compressedSizeBytes,
    bookImagePublicIds,
    kind,
    createdBy,
  });

  const preserveSnapshotIds = [];
  const snapshotsWithoutImageRefs = await repository.getSnapshotsMissingBookImagePublicIds();
  for (const snapshot of snapshotsWithoutImageRefs) {
    try {
      const oldPayload = await getSnapshotPayload(snapshot);
      const publicIds = getBookImagePublicIds(oldPayload);
      await repository.setSnapshotBookImagePublicIds(snapshot.id, publicIds);
      snapshot.book_image_public_ids = publicIds;
    } catch (error) {
      preserveSnapshotIds.push(snapshot.id);
      console.warn("[backup] Could not index catalog image references in a saved snapshot; retaining snapshots and images until a later cleanup attempt:", error.message);
    }
  }

  const pruneCandidates = await repository.getSnapshotsToPrune(MAX_SNAPSHOTS);
  const excludedSnapshotIds = preserveSnapshotIds.length
    ? pruneCandidates.map((snapshot) => snapshot.id)
    : [];
  const expired = await repository.pruneSnapshots(MAX_SNAPSHOTS, excludedSnapshotIds);
  if (expired.length) {
    await Promise.allSettled(expired.map((snapshot) => cloudinary.uploader.destroy(snapshot.cloudinary_public_id, { resource_type: "raw", type: "authenticated" })));
    const expiredImageIds = new Set(expired.flatMap((snapshot) => parseBookImagePublicIds(snapshot.book_image_public_ids)));
    await Promise.allSettled([...expiredImageIds].map(async (publicId) => {
      try {
        if (await repository.isBookImageReferenced(publicId)) return;
        await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
      } catch (error) {
        console.warn("[backup] Cloudinary catalog image cleanup failed:", error.message);
      }
    }));
  }

  return { id: result.insertId, filename, sizeBytes: compressedSizeBytes, uncompressedSizeBytes: sizeBytes, createdAt: payload.createdAt, kind };
}

function parseBookImagePublicIds(value) {
  if (Array.isArray(value)) return value.filter((id) => typeof id === "string" && id.trim());
  if (typeof value === "string") {
    try { return parseBookImagePublicIds(JSON.parse(value)); } catch { return []; }
  }
  return [];
}

function getBookImagePublicIds(payload) {
  return [...new Set((payload?.tables?.books ?? [])
    .map((book) => book?.image_public_id)
    .filter((id) => typeof id === "string" && id.trim()))];
}

async function getSnapshotPayload(snapshot) {
  requireCloudinary();
  const url = cloudinary.utils.private_download_url(snapshot.cloudinary_public_id, "json", {
    resource_type: "raw",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 60,
    attachment: false,
  });
  const response = await fetch(url);
  if (!response.ok) throw Object.assign(new Error("The snapshot file could not be retrieved from storage."), { status: 502 });
  const stored = Buffer.from(await response.arrayBuffer());
  const contents = stored[0] === 0x1f && stored[1] === 0x8b
    ? await gunzipAsync(stored)
    : stored;
  return JSON.parse(contents.toString("utf8"));
}

module.exports = { uploadSnapshot, getSnapshotPayload, serializeSnapshot, getBookImagePublicIds, parseBookImagePublicIds };

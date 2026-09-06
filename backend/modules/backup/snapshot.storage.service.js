const { Readable } = require("stream");
const cloudinary = require("cloudinary").v2;
const db = require("../../db");
const { SNAPSHOT_TABLE } = require("./snapshot.registry");

const MAX_SNAPSHOTS = 30;

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

async function uploadSnapshot(payload, createdBy, kind = "manual") {
  requireCloudinary();
  const snapshotId = `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const contents = JSON.stringify(payload);
  const upload = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      resource_type: "raw",
      type: "authenticated",
      folder: "euc-library-backups",
      public_id: snapshotId,
      format: "json",
      overwrite: false,
    }, (error, result) => error ? reject(error) : resolve(result));
    Readable.from([contents]).pipe(stream);
  });

  const filename = `euc-library-snapshot-${payload.createdAt.replace(/[:.]/g, "-")}.json`;
  const [result] = await db.query(
    `INSERT INTO ${SNAPSHOT_TABLE} (cloudinary_public_id, filename, size_bytes, kind, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [upload.public_id, filename, Buffer.byteLength(contents), kind, createdBy || null]
  );

  const [expired] = await db.query(
    `SELECT id, cloudinary_public_id FROM ${SNAPSHOT_TABLE} ORDER BY created_at DESC, id DESC LIMIT 18446744073709551615 OFFSET ?`,
    [MAX_SNAPSHOTS]
  );
  if (expired.length) {
    await db.query(`DELETE FROM ${SNAPSHOT_TABLE} WHERE id IN (?)`, [expired.map((snapshot) => snapshot.id)]);
    await Promise.allSettled(expired.map((snapshot) => cloudinary.uploader.destroy(snapshot.cloudinary_public_id, { resource_type: "raw", type: "authenticated" })));
  }

  return { id: result.insertId, filename, sizeBytes: Buffer.byteLength(contents), createdAt: payload.createdAt, kind };
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
  return response.json();
}

module.exports = { uploadSnapshot, getSnapshotPayload };

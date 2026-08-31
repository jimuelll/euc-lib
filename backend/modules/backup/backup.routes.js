const express = require("express");
const { Readable } = require("stream");
const cloudinary = require("cloudinary").v2;
const db = require("../../db");
const { authMiddleware } = require("../auth/auth.middleware");

const router = express.Router();
const superAdminOnly = authMiddleware(["super_admin"]);
const SNAPSHOT_TABLE = "backup_snapshots";
const MAX_SNAPSHOTS = 30;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function encodeValue(value) {
  if (Buffer.isBuffer(value)) return { __backupType: "buffer", data: value.toString("base64") };
  if (value instanceof Date) return { __backupType: "date", data: value.toISOString() };
  return value;
}

function decodeValue(value) {
  if (value && typeof value === "object" && value.__backupType === "buffer") {
    return Buffer.from(value.data, "base64");
  }
  if (value && typeof value === "object" && value.__backupType === "date") return value.data;
  return value;
}

async function getTableNames() {
  const [rows] = await db.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME != ? ORDER BY TABLE_NAME",
    [SNAPSHOT_TABLE]
  );
  return rows.map((row) => row.TABLE_NAME);
}

async function createBackupPayload() {
  const tables = await getTableNames();
  const data = {};
  for (const table of tables) {
    const [rows] = await db.query(`SELECT * FROM \`${table}\``);
    data[table] = rows.map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, encodeValue(value)])
    ));
  }
  const [bookColumns] = await db.query(
    `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable, EXTRA AS extra
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books'
     ORDER BY ORDINAL_POSITION`
  );
  return {
    format: "euc-library-backup",
    version: 2,
    createdAt: new Date().toISOString(),
    tables: data,
    schema: { booksColumns: bookColumns },
  };
}

function validateBackup(backup) {
  return backup?.format === "euc-library-backup" && [1, 2].includes(backup.version) && backup.tables && typeof backup.tables === "object";
}

async function restoreMissingBookColumns(backup) {
  const columns = backup.schema?.booksColumns;
  if (!Array.isArray(columns)) return;
  const [current] = await db.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books'`
  );
  const currentNames = new Set(current.map((column) => column.name));
  for (const column of columns) {
    if (!column?.name || !column?.columnType || currentNames.has(column.name) || column.extra) continue;
    // Column details originate from MySQL's information_schema at snapshot time, never from the client.
    await db.query(`ALTER TABLE \`books\` ADD COLUMN \`${column.name}\` ${column.columnType} ${column.isNullable === "NO" ? "NOT NULL" : "NULL"} DEFAULT NULL`);
  }
}

async function uploadSnapshot(payload, createdBy, kind = "manual") {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw Object.assign(new Error("Cloudinary storage is not configured."), { status: 503 });
  }
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

  const [result] = await db.query(
    `INSERT INTO ${SNAPSHOT_TABLE} (cloudinary_public_id, filename, size_bytes, kind, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [upload.public_id, `euc-library-snapshot-${payload.createdAt.replace(/[:.]/g, "-")}.json`, Buffer.byteLength(contents), kind, createdBy || null]
  );

  const [expired] = await db.query(
    `SELECT id, cloudinary_public_id FROM ${SNAPSHOT_TABLE} ORDER BY created_at DESC, id DESC LIMIT 18446744073709551615 OFFSET ?`,
    [MAX_SNAPSHOTS]
  );
  if (expired.length) {
    await db.query(`DELETE FROM ${SNAPSHOT_TABLE} WHERE id IN (?)`, [expired.map((snapshot) => snapshot.id)]);
    await Promise.allSettled(expired.map((snapshot) => cloudinary.uploader.destroy(snapshot.cloudinary_public_id, { resource_type: "raw", type: "authenticated" })));
  }

  return { id: result.insertId, filename: `euc-library-snapshot-${payload.createdAt.replace(/[:.]/g, "-")}.json`, sizeBytes: Buffer.byteLength(contents), createdAt: payload.createdAt, kind };
}

async function getSnapshotPayload(snapshot) {
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

async function restoreBackup(backup) {
  const tables = await getTableNames();
  const backupTables = Object.keys(backup.tables).sort();
  const missingTables = backupTables.filter((table) => !tables.includes(table));
  if (missingTables.length) {
    throw Object.assign(new Error(`This backup needs database tables that are no longer available: ${missingTables.join(", ")}.`), { status: 400 });
  }
  if (backupTables.some((table) => !Array.isArray(backup.tables[table]))) {
    throw Object.assign(new Error("The backup contains invalid table data."), { status: 400 });
  }

  await restoreMissingBookColumns(backup);

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of backupTables) await connection.query(`DELETE FROM \`${table}\``);
    for (const table of backupTables) {
      for (const row of backup.tables[table]) {
        const columns = Object.keys(row);
        if (!columns.length) continue;
        const values = columns.map((column) => decodeValue(row[column]));
        const names = columns.map((column) => `\`${column}\``).join(", ");
        await connection.query(`INSERT INTO \`${table}\` (${names}) VALUES (${columns.map(() => "?").join(", ")})`, values);
      }
    }
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    await connection.commit();
  } catch (err) {
    if (connection) await connection.rollback();
    throw err;
  } finally {
    if (connection) {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
      connection.release();
    }
  }
}

router.get("/backup/export", superAdminOnly, async (_req, res) => {
  try {
    const backup = await createBackupPayload();
    const filename = `euc-library-backup-${backup.createdAt.replace(/[:.]/g, "-")}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    res.send(JSON.stringify(backup));
  } catch (err) {
    console.error("[backup] export:", err);
    res.status(500).json({ message: "Could not create the database backup." });
  }
});

router.get("/backup/snapshots", superAdminOnly, async (_req, res) => {
  try {
    const [snapshots] = await db.query(
      `SELECT bs.id, bs.filename, bs.size_bytes AS sizeBytes, bs.kind, bs.created_at AS createdAt, u.name AS createdBy
       FROM ${SNAPSHOT_TABLE} bs LEFT JOIN users u ON u.id = bs.created_by
       ORDER BY bs.created_at DESC, bs.id DESC`
    );
    res.json({ snapshots });
  } catch (err) {
    console.error("[backup] list snapshots:", err);
    res.status(500).json({ message: "Could not load saved snapshots. Apply the backup snapshot database update first." });
  }
});

router.post("/backup/snapshots", superAdminOnly, async (req, res) => {
  try {
    const snapshot = await uploadSnapshot(await createBackupPayload(), req.user.id, "manual");
    res.status(201).json({ snapshot, message: "Snapshot saved securely." });
  } catch (err) {
    console.error("[backup] create snapshot:", err);
    res.status(err.status || 500).json({ message: err.message || "Could not save the snapshot." });
  }
});

router.get("/backup/snapshots/:id/download", superAdminOnly, async (req, res) => {
  try {
    const [[snapshot]] = await db.query(`SELECT * FROM ${SNAPSHOT_TABLE} WHERE id = ?`, [req.params.id]);
    if (!snapshot) return res.status(404).json({ message: "Snapshot not found." });
    const payload = await getSnapshotPayload(snapshot);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=\"${snapshot.filename}\"`);
    res.send(JSON.stringify(payload));
  } catch (err) {
    console.error("[backup] download snapshot:", err);
    res.status(err.status || 500).json({ message: err.message || "Could not download the snapshot." });
  }
});

router.post("/backup/snapshots/:id/restore", superAdminOnly, async (req, res) => {
  try {
    const [[snapshot]] = await db.query(`SELECT * FROM ${SNAPSHOT_TABLE} WHERE id = ?`, [req.params.id]);
    if (!snapshot) return res.status(404).json({ message: "Snapshot not found." });
    const preRestoreSnapshot = await uploadSnapshot(await createBackupPayload(), req.user.id, "pre_restore");
    const backup = await getSnapshotPayload(snapshot);
    if (!validateBackup(backup)) throw Object.assign(new Error("The saved snapshot is invalid."), { status: 400 });
    await restoreBackup(backup);
    res.json({ message: "Database restored successfully.", preRestoreSnapshot });
  } catch (err) {
    console.error("[backup] restore snapshot:", err);
    res.status(err.status || 500).json({ message: err.message || "Restore failed. The current database was left unchanged." });
  }
});

router.post("/backup/restore", superAdminOnly, async (req, res) => {
  const backup = req.body;
  if (!validateBackup(backup)) {
    return res.status(400).json({ message: "This file is not a valid EUC Library backup." });
  }

  try {
    await restoreBackup(backup);
    res.json({ message: "Database restored successfully.", restoredAt: new Date().toISOString() });
  } catch (err) {
    console.error("[backup] restore:", err);
    res.status(err.status || 500).json({ message: err.message || "Restore failed. The current database was left unchanged." });
  }
});

module.exports = router;

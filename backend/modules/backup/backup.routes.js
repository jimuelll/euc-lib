const express = require("express");
const { Readable } = require("stream");
const { createHash } = require("crypto");
const cloudinary = require("cloudinary").v2;
const db = require("../../db");
const { authMiddleware } = require("../auth/auth.middleware");
const { invalidateAllSessionsAfterRestore } = require("../auth/authSession.service");
const notificationHub = require("../../realtime/notificationHub");

const router = express.Router();
const superAdminOnly = authMiddleware(["super_admin"]);
const SNAPSHOT_TABLE = "backup_snapshots";
const MAX_SNAPSHOTS = 30;
const SYSTEM_TABLES = [SNAPSHOT_TABLE, "auth_restore_state", "restore_audit_events"];
const FORM_FIELD_SQL_TYPES = { text: "TEXT", textarea: "TEXT", number: "DECIMAL(15,4)", date: "DATE", select: "VARCHAR(255)" };

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

const pad = (value, length = 2) => String(value).padStart(length, "0");

function formatDateForMySql(isoValue, columnType = "") {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error("The backup contains an invalid date value."), { status: 400 });
  }

  const type = String(columnType).toLowerCase();
  const datePart = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const timePart = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  if (type === "date") return datePart;
  if (/^time(?:\(|$)/.test(type)) return timePart;
  if (type.startsWith("year")) return String(date.getUTCFullYear());

  const precision = Number(type.match(/\((\d+)\)/)?.[1] ?? 0);
  const fraction = precision > 0
    ? `.${pad(date.getUTCMilliseconds(), 3).padEnd(Math.min(precision, 6), "0").slice(0, Math.min(precision, 6))}`
    : "";
  return `${datePart} ${timePart}${fraction}`;
}

function decodeValue(value, columnType) {
  if (value && typeof value === "object" && value.__backupType === "buffer") {
    return Buffer.from(value.data, "base64");
  }
  if (value && typeof value === "object" && value.__backupType === "date") {
    return formatDateForMySql(value.data, columnType);
  }
  return value;
}

async function getTableNames(connection = db) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
       AND TABLE_NAME NOT IN (${SYSTEM_TABLES.map(() => "?").join(", ")}) ORDER BY TABLE_NAME`,
    SYSTEM_TABLES
  );
  return rows.map((row) => row.TABLE_NAME);
}

async function getSchemaManifest(connection = db) {
  const [columns] = await connection.query(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLUMN_TYPE AS columnType,
            IS_NULLABLE AS isNullable, EXTRA AS extra
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME NOT IN (${SYSTEM_TABLES.map(() => "?").join(", ")})
      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    SYSTEM_TABLES
  );
  const tables = {};
  for (const column of columns) {
    (tables[column.tableName] ??= { columns: [] }).columns.push({
      name: column.name,
      columnType: column.columnType,
      isNullable: column.isNullable,
      extra: column.extra,
    });
  }
  // Column metadata alone misses indexes and foreign keys. Keep a normalized
  // CREATE TABLE definition so a restore only runs against the same constraints.
  for (const table of Object.keys(tables)) {
    const [definitionRows] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
    const definition = Object.values(definitionRows[0])[1];
    tables[table].definition = String(definition).replace(/ AUTO_INCREMENT=\d+/g, " AUTO_INCREMENT=?");
  }
  return tables;
}

function schemaFingerprint(tables) {
  return createHash("sha256").update(JSON.stringify(tables)).digest("hex");
}

async function createBackupPayload() {
  const connection = await db.getConnection();
  try {
    // One read-only, repeatable-read transaction makes every table represent the same instant.
    await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
    const tables = await getTableNames(connection);
    const data = {};
    for (const table of tables) {
      const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
      data[table] = rows.map((row) => Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, encodeValue(value)])
      ));
    }
    const schemaTables = await getSchemaManifest(connection);
    await connection.commit();
    return {
      format: "euc-library-backup",
      version: 3,
      createdAt: new Date().toISOString(),
      tables: data,
      schema: { tables: schemaTables, fingerprint: schemaFingerprint(schemaTables) },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function validateBackup(backup) {
  return backup?.format === "euc-library-backup"
    && backup.version === 3
    && backup.tables && typeof backup.tables === "object"
    && backup.schema?.tables && typeof backup.schema.tables === "object"
    && typeof backup.schema.fingerprint === "string";
}

async function assertSchemaCompatible(backup) {
  const currentTables = await getSchemaManifest();
  if (backup.schema.fingerprint !== schemaFingerprint(backup.schema.tables)) {
    throw Object.assign(new Error("The backup schema fingerprint is invalid."), { status: 400 });
  }
  const backupTableNames = Object.keys(backup.schema.tables).sort();
  const currentTableNames = Object.keys(currentTables).sort();
  if (JSON.stringify(backupTableNames) !== JSON.stringify(currentTableNames)) {
    throw Object.assign(new Error("This backup has different core database tables and cannot be restored safely."), { status: 409 });
  }
  for (const table of currentTableNames) {
    if (table === "books") continue;
    if (backup.schema.tables[table].definition !== currentTables[table].definition) {
      throw Object.assign(new Error(`The ${table} table has changed since this snapshot and cannot be restored safely.`), { status: 409 });
    }
  }
  return currentTables;
}

function requireRestoreSignOutAcknowledgement(req) {
  if (req.get("x-restore-confirmation") !== "global-sign-out") {
    throw Object.assign(new Error("Restore confirmation is required: this operation signs out every user, including the restorer."), { status: 400 });
  }
}

function getSnapshotFormFields(backup) {
  return new Map((backup.tables.catalog_schema ?? [])
    .filter((field) => field && !Boolean(field.locked) && FORM_FIELD_SQL_TYPES[field.type])
    .map((field) => [String(field.key), field.type]));
}

async function reconcileFormBuilderSchema(backup) {
  const snapshotFields = getSnapshotFormFields(backup);
  const snapshotColumns = new Map((backup.schema.tables.books?.columns ?? []).map((column) => [column.name, column]));
  const currentTables = await getSchemaManifest();
  const currentColumns = new Map((currentTables.books?.columns ?? []).map((column) => [column.name, column]));

  for (const [key, type] of snapshotFields) {
    const snapshotColumn = snapshotColumns.get(key);
    if (!snapshotColumn) throw Object.assign(new Error(`The snapshot form field "${key}" has no matching book column.`), { status: 400 });
    const currentColumn = currentColumns.get(key);
    if (!currentColumn) {
      await db.query(`ALTER TABLE books ADD COLUMN \`${key}\` ${FORM_FIELD_SQL_TYPES[type]} DEFAULT NULL`);
      continue;
    }
    if (String(currentColumn.columnType).toLowerCase() !== String(snapshotColumn.columnType).toLowerCase()) {
      throw Object.assign(new Error(`Form field "${key}" has an incompatible stored type and cannot be restored automatically.`), { status: 409 });
    }
  }

  const refreshedTables = await getSchemaManifest();
  const refreshedColumns = new Map((refreshedTables.books?.columns ?? []).map((column) => [column.name, column]));
  const currentFormFields = new Set((await db.query("SELECT `key` FROM catalog_schema WHERE locked = 0"))[0].map((field) => String(field.key)));
  const flexibleBookColumns = new Set([...snapshotFields.keys(), ...currentFormFields]);
  for (const snapshotColumn of backup.schema.tables.books?.columns ?? []) {
    const currentColumn = refreshedColumns.get(snapshotColumn.name);
    if (!currentColumn) throw Object.assign(new Error(`The ${snapshotColumn.name} book column is missing and is not a form-builder field.`), { status: 409 });
    if (!flexibleBookColumns.has(snapshotColumn.name) && JSON.stringify(snapshotColumn) !== JSON.stringify(currentColumn)) {
      throw Object.assign(new Error(`The core books column "${snapshotColumn.name}" has changed and cannot be restored safely.`), { status: 409 });
    }
  }
  return refreshedTables;
}

function validateSnapshotUniqueStudentIds(backup) {
  const seen = new Set();
  const duplicates = new Set();
  for (const user of backup.tables.users ?? []) {
    if (!user || user.deleted_at || !user.student_employee_id) continue;
    const sid = String(user.student_employee_id).trim();
    if (!sid) continue;
    if (seen.has(sid)) duplicates.add(sid); else seen.add(sid);
  }
  if (duplicates.size) {
    throw Object.assign(new Error(`The snapshot has duplicate active student/employee IDs: ${Array.from(duplicates).slice(0, 5).join(", ")}. Resolve them in the source data before restoring.`), { status: 400 });
  }
}

async function ensureRestoreAuditTable() {
  await db.query(`CREATE TABLE IF NOT EXISTS restore_audit_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    snapshot_id BIGINT UNSIGNED NULL,
    snapshot_kind VARCHAR(32) NULL,
    restored_by BIGINT UNSIGNED NULL,
    pre_restore_snapshot_id BIGINT UNSIGNED NULL,
    restored_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), KEY idx_restore_audit_time (restored_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
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

async function createPreRestoreSnapshot(createdBy) {
  return uploadSnapshot(await createBackupPayload(), createdBy, "pre_restore");
}

async function restoreBackup(backup) {
  const tables = await getTableNames();
  const backupTables = Object.keys(backup.tables).sort();
  if (backupTables.length !== tables.length || backupTables.some((table, index) => table !== tables[index])) {
    throw Object.assign(new Error("This backup does not contain exactly the current database tables and cannot be restored safely."), { status: 409 });
  }
  if (backupTables.some((table) => !Array.isArray(backup.tables[table]))) {
    throw Object.assign(new Error("The backup contains invalid table data."), { status: 400 });
  }
  validateSnapshotUniqueStudentIds(backup);

  await reconcileFormBuilderSchema(backup);
  const schemaTables = await assertSchemaCompatible(backup);

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of backupTables) await connection.query(`DELETE FROM \`${table}\``);
    for (const table of backupTables) {
      for (const row of backup.tables[table]) {
        if (!row || typeof row !== "object" || Array.isArray(row)) {
          throw Object.assign(new Error(`The backup contains an invalid row for ${table}.`), { status: 400 });
        }
        const columns = Object.keys(row);
        const columnDefinitions = new Map((schemaTables[table]?.columns ?? []).map((column) => [column.name, column]));
        if (columns.some((column) => !columnDefinitions.has(column))) {
          throw Object.assign(new Error(`The backup contains unsupported columns for ${table}.`), { status: 400 });
        }
        const insertColumns = columns.filter((column) => !/generated/i.test(String(columnDefinitions.get(column)?.extra ?? "")));
        if (!insertColumns.length) continue;
        const values = insertColumns.map((column) => decodeValue(row[column], columnDefinitions.get(column)?.columnType));
        const names = insertColumns.map((column) => `\`${column}\``).join(", ");
        await connection.query(`INSERT INTO \`${table}\` (${names}) VALUES (${insertColumns.map(() => "?").join(", ")})`, values);
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

async function performRestore(backup, { restoredBy, snapshotId = null, snapshotKind = "uploaded" }) {
  await ensureRestoreAuditTable();
  const preRestoreSnapshot = await createPreRestoreSnapshot(restoredBy);
  await restoreBackup(backup);
  await invalidateAllSessionsAfterRestore();
  await db.query(
    `INSERT INTO restore_audit_events (snapshot_id, snapshot_kind, restored_by, pre_restore_snapshot_id)
     VALUES (?, ?, ?, ?)`,
    [snapshotId, snapshotKind, restoredBy || null, preRestoreSnapshot.id]
  );
  notificationHub.closeAllConnections({ type: "system.restored", message: "The library system was restored. Please sign in again." });
  return preRestoreSnapshot;
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
    requireRestoreSignOutAcknowledgement(req);
    const [[snapshot]] = await db.query(`SELECT * FROM ${SNAPSHOT_TABLE} WHERE id = ?`, [req.params.id]);
    if (!snapshot) return res.status(404).json({ message: "Snapshot not found." });
    const backup = await getSnapshotPayload(snapshot);
    if (!validateBackup(backup)) throw Object.assign(new Error("The saved snapshot is invalid."), { status: 400 });
    const preRestoreSnapshot = await performRestore(backup, { restoredBy: req.user.id, snapshotId: snapshot.id, snapshotKind: snapshot.kind });
    res.json({ message: "Database restored successfully.", preRestoreSnapshot });
  } catch (err) {
    console.error("[backup] restore snapshot:", err);
    res.status(err.status || 500).json({ message: err.message || "Restore failed before any database records were changed." });
  }
});

router.post("/backup/restore", superAdminOnly, async (req, res) => {
  const backup = req.body;
  try {
    requireRestoreSignOutAcknowledgement(req);
  } catch (err) {
    return res.status(err.status || 400).json({ message: err.message });
  }
  if (!validateBackup(backup)) {
    return res.status(400).json({ message: "This file is not a valid EUC Library backup." });
  }

  try {
    const preRestoreSnapshot = await performRestore(backup, { restoredBy: req.user.id });
    res.json({ message: "Database restored successfully.", restoredAt: new Date().toISOString(), preRestoreSnapshot });
  } catch (err) {
    console.error("[backup] restore:", err);
    res.status(err.status || 500).json({ message: err.message || "Restore failed before any database records were changed." });
  }
});

module.exports = router;

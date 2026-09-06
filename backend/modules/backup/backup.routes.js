const express = require("express");
const { gzipSync } = require("zlib");
const db = require("../../db");
const { authMiddleware } = require("../auth/auth.middleware");
const { SNAPSHOT_TABLE } = require("./snapshot.registry");
const { SNAPSHOT_VERSION, validateBackup } = require("./snapshot.transforms");
const { createBackupPayload, compatibilityFor } = require("./snapshot.service");
const { uploadSnapshot, getSnapshotPayload } = require("./snapshot.storage.service");
const { performRestore } = require("./snapshot.restore.service");

const router = express.Router();
const superAdminOnly = authMiddleware(["super_admin"]);
const importLimit = () => Number(process.env.BACKUP_MAX_BYTES || 50 * 1024 * 1024);

function requireRestoreSignOutAcknowledgement(req) {
  if (req.get("x-restore-confirmation") !== "global-sign-out") {
    throw Object.assign(new Error("Restore confirmation is required: this operation signs out every user, including the restorer."), { status: 400 });
  }
}

async function findSnapshot(id) {
  const [[snapshot]] = await db.query(`SELECT * FROM ${SNAPSHOT_TABLE} WHERE id = ?`, [id]);
  if (!snapshot) throw Object.assign(new Error("Snapshot not found."), { status: 404 });
  return snapshot;
}

function sendError(res, error, fallback) {
  console.error("[backup]", error);
  res.status(error.status || 500).json({ message: error.message || fallback });
}

router.get("/backup/export", superAdminOnly, async (_req, res) => {
  try {
    const backup = await createBackupPayload();
    const filename = `euc-library-backup-${backup.createdAt.replace(/[:.]/g, "-")}.json.gz`;
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    res.send(gzipSync(JSON.stringify(backup)));
  } catch (error) {
    sendError(res, error, "Could not create the database backup.");
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
  } catch (error) {
    sendError(res, error, "Could not load saved snapshots.");
  }
});

router.get("/backup/status", superAdminOnly, async (_req, res) => {
  try {
    const [[state]] = await db.query("SELECT mode, started_at AS startedAt FROM system_maintenance_state WHERE id = 1");
    res.json({ mode: state?.mode ?? "normal", startedAt: state?.startedAt ?? null, snapshotVersion: SNAPSHOT_VERSION, maxImportBytes: importLimit() });
  } catch (error) {
    sendError(res, error, "Backup maintenance state is unavailable.");
  }
});

router.post("/backup/compatibility", superAdminOnly, async (req, res) => {
  res.json(await compatibilityFor(req.body));
});

router.get("/backup/snapshots/:id/compatibility", superAdminOnly, async (req, res) => {
  try {
    const snapshot = await findSnapshot(req.params.id);
    res.json(await compatibilityFor(await getSnapshotPayload(snapshot)));
  } catch (error) {
    res.status(error.status || 500).json({ compatible: false, message: error.message || "Could not verify snapshot compatibility." });
  }
});

router.post("/backup/snapshots", superAdminOnly, async (req, res) => {
  try {
    const snapshot = await uploadSnapshot(await createBackupPayload(), req.user.id, "manual");
    res.status(201).json({ snapshot, message: "Snapshot saved securely." });
  } catch (error) {
    sendError(res, error, "Could not save the snapshot.");
  }
});

router.get("/backup/snapshots/:id/download", superAdminOnly, async (req, res) => {
  try {
    const snapshot = await findSnapshot(req.params.id);
    const payload = await getSnapshotPayload(snapshot);
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename=\"${snapshot.filename.replace(/\.json$/i, ".json.gz")}\"`);
    res.send(gzipSync(JSON.stringify(payload)));
  } catch (error) {
    sendError(res, error, "Could not download the snapshot.");
  }
});

router.post("/backup/snapshots/:id/restore", superAdminOnly, async (req, res) => {
  try {
    requireRestoreSignOutAcknowledgement(req);
    const snapshot = await findSnapshot(req.params.id);
    const backup = await getSnapshotPayload(snapshot);
    if (!validateBackup(backup)) throw Object.assign(new Error("The saved snapshot is invalid."), { status: 400 });
    const preRestoreSnapshot = await performRestore(backup, { restoredBy: req.user.id, snapshotId: snapshot.id, snapshotKind: snapshot.kind });
    res.json({ message: "Database restored successfully.", preRestoreSnapshot });
  } catch (error) {
    sendError(res, error, "Restore failed before any database records were changed.");
  }
});

router.post("/backup/restore", superAdminOnly, async (req, res) => {
  try {
    requireRestoreSignOutAcknowledgement(req);
    if (!validateBackup(req.body)) throw Object.assign(new Error("This file is not a valid EUC Library backup."), { status: 400 });
    const preRestoreSnapshot = await performRestore(req.body, { restoredBy: req.user.id });
    res.json({ message: "Database restored successfully.", restoredAt: new Date().toISOString(), preRestoreSnapshot });
  } catch (error) {
    sendError(res, error, "Restore failed before any database records were changed.");
  }
});

module.exports = router;

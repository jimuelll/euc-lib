const { gzipSync } = require("zlib");
const repository = require("./backup.repository");
const { SNAPSHOT_VERSION, validateBackup } = require("./snapshot.transforms");
const { createBackupPayload, compatibilityFor } = require("./snapshot.service");
const { uploadSnapshot, getSnapshotPayload, serializeSnapshot } = require("./snapshot.storage.service");
const { performRestore } = require("./snapshot.restore.service");
const { logError } = require("../../logger");

const importLimit = () => Number(process.env.BACKUP_MAX_BYTES || 50 * 1024 * 1024);

function requireRestoreSignOutAcknowledgement(req) {
  if (req.get("x-restore-confirmation") !== "global-sign-out") throw Object.assign(new Error("Restore confirmation is required: this operation signs out every user, including the restorer."), { status: 400 });
}

function sendError(res, error, fallback) {
  logError("[backup]", error);
  res.status(error.status || 500).json({ message: error.message || fallback });
}

async function exportBackup(_req, res) {
  try {
    const backup = await createBackupPayload();
    const { contents } = serializeSnapshot(backup);
    const filename = `euc-library-backup-${backup.createdAt.replace(/[:.]/g, "-")}.json.gz`;
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    res.send(gzipSync(contents));
  } catch (error) { sendError(res, error, "Could not create the database backup."); }
}

async function listSavedSnapshots(_req, res) {
  try { res.json({ snapshots: await repository.listSnapshots() }); }
  catch (error) { sendError(res, error, "Could not load saved snapshots."); }
}

async function backupStatus(_req, res) {
  try {
    const state = await repository.getMaintenanceStatus();
    res.json({ mode: state.mode ?? "normal", startedAt: state.startedAt ?? null, snapshotVersion: SNAPSHOT_VERSION, maxImportBytes: importLimit() });
  } catch (error) { sendError(res, error, "Backup maintenance state is unavailable."); }
}

async function checkCompatibility(req, res) {
  try { res.json(await compatibilityFor(req.body)); }
  catch (error) { sendError(res, error, "Could not verify snapshot compatibility."); }
}

async function checkSavedCompatibility(req, res) {
  try {
    const snapshot = await repository.findSnapshot(req.params.id);
    res.json(await compatibilityFor(await getSnapshotPayload(snapshot)));
  } catch (error) { res.status(error.status || 500).json({ compatible: false, message: error.message || "Could not verify snapshot compatibility." }); }
}

async function saveSnapshot(req, res) {
  try { res.status(201).json({ snapshot: await uploadSnapshot(await createBackupPayload(), req.user.id, "manual"), message: "Snapshot saved securely." }); }
  catch (error) { sendError(res, error, "Could not save the snapshot."); }
}

async function downloadSnapshot(req, res) {
  try {
    const snapshot = await repository.findSnapshot(req.params.id);
    const payload = await getSnapshotPayload(snapshot);
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename=\"${snapshot.filename.replace(/\.json$/i, ".json.gz")}\"`);
    res.send(gzipSync(JSON.stringify(payload)));
  } catch (error) { sendError(res, error, "Could not download the snapshot."); }
}

async function restoreSavedSnapshot(req, res) {
  try {
    requireRestoreSignOutAcknowledgement(req);
    const snapshot = await repository.findSnapshot(req.params.id);
    const backup = await getSnapshotPayload(snapshot);
    if (!validateBackup(backup)) throw Object.assign(new Error("The saved snapshot is invalid."), { status: 400 });
    const preRestoreSnapshot = await performRestore(backup, { restoredBy: req.user.id, restoredByName: req.user.name, restoredByRole: req.user.role, snapshotId: snapshot.id, snapshotKind: snapshot.kind, snapshotLabel: `saved snapshot “${snapshot.filename}”` });
    // The restore transaction inserts its audit event before commit. Tell the
    // generic response logger not to append a second, post-restore event.
    res.locals.auditEnqueued = true;
    res.json({ message: "Database restored successfully.", preRestoreSnapshot });
  } catch (error) { sendError(res, error, "Restore failed before any database records were changed."); }
}

async function restoreUploadedSnapshot(req, res) {
  try {
    requireRestoreSignOutAcknowledgement(req);
    if (!validateBackup(req.body)) throw Object.assign(new Error("This file is not a valid EUC Library backup."), { status: 400 });
    const preRestoreSnapshot = await performRestore(req.body, { restoredBy: req.user.id, restoredByName: req.user.name, restoredByRole: req.user.role, snapshotLabel: "uploaded snapshot" });
    // performRestore commits a durable audit row as part of the data restore.
    res.locals.auditEnqueued = true;
    res.json({ message: "Database restored successfully.", restoredAt: new Date().toISOString(), preRestoreSnapshot });
  } catch (error) { sendError(res, error, "Restore failed before any database records were changed."); }
}

module.exports = { exportBackup, listSavedSnapshots, backupStatus, checkCompatibility, checkSavedCompatibility, saveSnapshot, downloadSnapshot, restoreSavedSnapshot, restoreUploadedSnapshot };

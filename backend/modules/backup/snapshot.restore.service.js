const { invalidateAllSessionsAfterRestore } = require("../auth/authSession.service");
const notificationHub = require("../../realtime/notificationHub");
const repository = require("./restore.repository");
const { createBackupPayload, preflightRestore } = require("./snapshot.service");
const { upgradeBackup } = require("./snapshot.transforms");
const { uploadSnapshot } = require("./snapshot.storage.service");

async function performRestore(backup, { restoredBy, restoredByName = null, restoredByRole = null, snapshotId = null, snapshotKind = "uploaded", snapshotLabel = "uploaded snapshot" }) {
  const lockConnection = await repository.acquireRestoreLock();
  try {
    const prepared = upgradeBackup(backup);
    await preflightRestore(prepared);
    await repository.setMaintenance("restoring", restoredBy);
    await repository.preflightAccessionRestore(prepared);
    const preRestoreSnapshot = await uploadSnapshot(await createBackupPayload(), restoredBy, "pre_restore");
    const restoreDetails = await repository.replaceApplicationData(prepared, {
      restoredBy,
      restoredByName,
      restoredByRole,
      snapshotId,
      snapshotKind,
      snapshotLabel,
      preRestoreSnapshotId: preRestoreSnapshot.id,
      invalidateSessions: (connection) => invalidateAllSessionsAfterRestore(connection),
    });
    notificationHub.closeAllConnections({ type: "system.restored", message: "The library system was restored. Please sign in again." });
    return { ...preRestoreSnapshot, ...restoreDetails };
  } finally {
    await repository.setMaintenance("normal").catch(() => {});
    await lockConnection.query("SELECT RELEASE_LOCK('euc-library-restore')").catch(() => {});
    lockConnection.release();
  }
}

module.exports = { performRestore };

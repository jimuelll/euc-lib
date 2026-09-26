import type { PoolConnection } from "mysql2/promise";
import authSessions = require("../auth/authSession.service");
import notificationHub = require("../../realtime/notificationHub");
import repository = require("./restore.repository");
import snapshot = require("./snapshot.service");
import transforms = require("./snapshot.transforms");
import storage = require("./snapshot.storage.service");
import type { SnapshotPayload } from "./snapshot.types";

interface RestoreOptions {
  restoredBy: number;
  restoredByName?: string | null;
  restoredByRole?: string | null;
  snapshotId?: number | string | null;
  snapshotKind?: string;
  snapshotLabel?: string;
}
interface ApplicationRestoreOptions extends RestoreOptions {
  preRestoreSnapshotId: number;
  invalidateSessions: (connection: PoolConnection) => Promise<void>;
}

const setMaintenance = repository.setMaintenance as (state: string, updatedBy?: number | null) => Promise<void>;
const replaceApplicationData = repository.replaceApplicationData as unknown as (
  backup: unknown,
  options: ApplicationRestoreOptions,
) => Promise<Record<string, unknown>>;

async function performRestore(backup: SnapshotPayload, {
  restoredBy,
  restoredByName = null,
  restoredByRole = null,
  snapshotId = null,
  snapshotKind = "uploaded",
  snapshotLabel = "uploaded snapshot",
}: RestoreOptions) {
  const lockConnection = await repository.acquireRestoreLock();
  try {
    const prepared = transforms.upgradeBackup(backup);
    await snapshot.preflightRestore(prepared);
    await setMaintenance("restoring", restoredBy);
    await repository.preflightAccessionRestore(prepared);
    const preRestoreSnapshot = await storage.uploadSnapshot(await snapshot.createBackupPayload(), restoredBy, "pre_restore");
    const restoreDetails = await replaceApplicationData(prepared, {
      restoredBy,
      restoredByName,
      restoredByRole,
      snapshotId,
      snapshotKind,
      snapshotLabel,
      preRestoreSnapshotId: preRestoreSnapshot.id,
      invalidateSessions: (connection: PoolConnection) => authSessions.invalidateAllSessionsAfterRestore(connection),
    });
    notificationHub.closeAllConnections({ type: "system.restored", message: "The library system was restored. Please sign in again." });
    return { ...preRestoreSnapshot, ...restoreDetails };
  } finally {
    await setMaintenance("normal").catch(() => {});
    await lockConnection.query("SELECT RELEASE_LOCK('euc-library-restore')").catch(() => {});
    lockConnection.release();
  }
}

export = { performRestore };

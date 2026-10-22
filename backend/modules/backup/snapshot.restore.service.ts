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
  let safetyId:number|undefined, committed=false;
  try {
    require('./backup.safety').setProgress('verifying',snapshotLabel);
    if(backup.integrity?.algorithm!=='sha256'||backup.integrity.checksum!==transforms.payloadChecksum(backup))throw Object.assign(new Error('A verified backup checksum is required before restoring. Live data was not replaced.'),{status:409});
    const prepared = transforms.upgradeBackup(backup);
    await snapshot.preflightRestore(prepared);
    await setMaintenance("restoring", restoredBy);
    await repository.preflightAccessionRestore(prepared);
    require('./backup.safety').setProgress('saving_safety_snapshot');
    const preRestoreSnapshot = await storage.uploadSnapshot(await snapshot.createBackupPayload(), restoredBy, "pre_restore");
    safetyId=preRestoreSnapshot.id;
    require('./backup.safety').setProgress('verifying_safety_snapshot');
    const savedSafety=await require('./backup.repository').findSnapshot(safetyId);
    const verified=await require('./backup.verification').verifyStoredSnapshot(savedSafety,true);
    Object.assign(preRestoreSnapshot,{verification:'verified',verifiedAt:verified.verifiedAt});
    require('./backup.safety').setProgress('restoring');
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
    committed=true;
    require('./backup.safety').setProgress('finishing');
    notificationHub.closeAllConnections({ type: "system.restored", message: "The library system was restored. Please sign in again." });
    require('./backup.safety').setProgress('complete',snapshotLabel,{...preRestoreSnapshot,...restoreDetails});
    return { ...preRestoreSnapshot, ...restoreDetails };
  } catch(error) {
    require('./backup.safety').setProgress('failed',snapshotLabel,{safetySnapshotId:safetyId,committed});
    throw Object.assign(error as Error,{safetySnapshotId:safetyId,restoreCommitted:committed});
  } finally {
    try { await setMaintenance("normal"); }
    catch { console.error("[restore] Maintenance cleanup failed; recovery will retry after the restore lock is released."); }
    try {
      await lockConnection.query("SELECT RELEASE_LOCK('euc-library-restore')");
      lockConnection.release();
    } catch {
      console.error("[restore] Lock cleanup failed; discarding the restore connection.");
      lockConnection.destroy();
    }
  }
}

export = { performRestore };

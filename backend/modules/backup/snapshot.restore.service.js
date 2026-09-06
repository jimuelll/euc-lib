const db = require("../../db");
const { invalidateAllSessionsAfterRestore } = require("../auth/authSession.service");
const notificationHub = require("../../realtime/notificationHub");
const { createBackupPayload, getSchemaManifest, getTableNames, preflightRestore, validateSnapshotUniqueStudentIds } = require("./snapshot.service");
const { decodeValue, upgradeBackup } = require("./snapshot.transforms");
const { uploadSnapshot } = require("./snapshot.storage.service");

async function setMaintenance(mode, userId = null) {
  await db.query("UPDATE system_maintenance_state SET mode = ?, started_at = CASE WHEN ? = 'restoring' THEN UTC_TIMESTAMP() ELSE NULL END, started_by = CASE WHEN ? = 'restoring' THEN ? ELSE NULL END WHERE id = 1", [mode, mode, mode, userId]);
}

async function acquireRestoreLock() {
  const connection = await db.getConnection();
  const [[row]] = await connection.query("SELECT GET_LOCK('euc-library-restore', 5) AS acquired");
  if (!row?.acquired) {
    connection.release();
    throw Object.assign(new Error("Another restore is already in progress."), { status: 409 });
  }
  return connection;
}

async function assertForeignKeys(connection) {
  const [relations] = await connection.query(
    `SELECT TABLE_NAME AS childTable, COLUMN_NAME AS childColumn,
            REFERENCED_TABLE_NAME AS parentTable, REFERENCED_COLUMN_NAME AS parentColumn
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`
  );
  for (const relation of relations) {
    const [[orphan]] = await connection.query(
      `SELECT 1 FROM \`${relation.childTable}\` child
       LEFT JOIN \`${relation.parentTable}\` parent ON parent.\`${relation.parentColumn}\` = child.\`${relation.childColumn}\`
       WHERE child.\`${relation.childColumn}\` IS NOT NULL AND parent.\`${relation.parentColumn}\` IS NULL LIMIT 1`
    );
    if (orphan) throw Object.assign(new Error(`The snapshot has a broken foreign key: ${relation.childTable}.${relation.childColumn}.`), { status: 400 });
  }
}

async function replaceApplicationData(backup, { restoredBy = null, restoredByName = null, restoredByRole = null, snapshotId = null, snapshotKind = "uploaded", snapshotLabel = "uploaded snapshot", preRestoreSnapshotId = null } = {}) {
  const tables = await getTableNames();
  const backupTables = Object.keys(backup.tables).sort();
  if (JSON.stringify(backupTables) !== JSON.stringify(tables)) {
    throw Object.assign(new Error("This backup does not contain exactly the current application tables and cannot be restored safely."), { status: 409 });
  }
  validateSnapshotUniqueStudentIds(backup);
  const schemaTables = await getSchemaManifest();
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of backupTables) await connection.query(`DELETE FROM \`${table}\``);
    for (const table of backupTables) {
      const definitions = new Map((schemaTables[table]?.columns ?? []).map((column) => [column.name, column]));
      for (const row of backup.tables[table]) {
        const columns = Object.keys(row);
        if (columns.some((column) => !definitions.has(column))) {
          throw Object.assign(new Error(`The backup contains unsupported columns for ${table}.`), { status: 400 });
        }
        const insertColumns = columns.filter((column) => !/generated/i.test(String(definitions.get(column)?.extra ?? "")));
        if (!insertColumns.length) continue;
        const names = insertColumns.map((column) => `\`${column}\``).join(", ");
        const values = insertColumns.map((column) => decodeValue(row[column], definitions.get(column)?.columnType));
        await connection.query(`INSERT INTO \`${table}\` (${names}) VALUES (${insertColumns.map(() => "?").join(", ")})`, values);
      }
    }
    await assertForeignKeys(connection);
    await invalidateAllSessionsAfterRestore(connection);
    const [restoreAudit] = await connection.query(
      `INSERT INTO restore_audit_events (snapshot_id, snapshot_kind, restored_by, pre_restore_snapshot_id)
       VALUES (?, ?, ?, ?)`,
      [snapshotId, snapshotKind, restoredBy || null, preRestoreSnapshotId]
    );
    const restoreAuditId = restoreAudit.insertId;
    // Do not erase the ledger. Events after the snapshot cutoff describe data
    // that is no longer present after this restore, so mark them transparently.
    const [reversed] = await connection.query(
      `UPDATE audit_events
       SET restore_status = 'reversed', reversed_at = UTC_TIMESTAMP(), reversed_by_restore_id = ?
       WHERE occurred_at > ?
         AND restore_status = 'retained'
         AND category NOT IN ('auth', 'backup', 'system')`,
      [restoreAuditId, backup.createdAt]
    );
    // audit_events is restored with the snapshot, then this event is appended
    // inside the same transaction so the restore itself is never invisible.
    await connection.query(
      `INSERT INTO audit_events
         (actor_id, actor_name, actor_role, category, action, description, route, metadata)
       VALUES (?, ?, ?, 'backup', 'restored', ?, '/api/admin/backup/restore', ?)`,
      [
        restoredBy || null,
        restoredByName,
        restoredByRole,
        `Restored ${snapshotLabel}; ${reversed.affectedRows} post-snapshot data change${reversed.affectedRows === 1 ? "" : "s"} reversed`,
        JSON.stringify({ snapshot_id: snapshotId, snapshot_kind: snapshotKind, pre_restore_snapshot_id: preRestoreSnapshotId, reversed_event_count: reversed.affectedRows }),
      ]
    );
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    await connection.commit();
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
      connection.release();
    }
  }
}

async function performRestore(backup, { restoredBy, restoredByName = null, restoredByRole = null, snapshotId = null, snapshotKind = "uploaded", snapshotLabel = "uploaded snapshot" }) {
  const lockConnection = await acquireRestoreLock();
  try {
    const prepared = upgradeBackup(backup);
    await preflightRestore(prepared);
    await setMaintenance("restoring", restoredBy);
    const preRestoreSnapshot = await uploadSnapshot(await createBackupPayload(), restoredBy, "pre_restore");
    await replaceApplicationData(prepared, {
      restoredBy,
      restoredByName,
      restoredByRole,
      snapshotId,
      snapshotKind,
      snapshotLabel,
      preRestoreSnapshotId: preRestoreSnapshot.id,
    });
    notificationHub.closeAllConnections({ type: "system.restored", message: "The library system was restored. Please sign in again." });
    return preRestoreSnapshot;
  } finally {
    await setMaintenance("normal").catch(() => {});
    await lockConnection.query("SELECT RELEASE_LOCK('euc-library-restore')").catch(() => {});
    lockConnection.release();
  }
}

module.exports = { performRestore };

const db = require("../../db");
const { decodeValue } = require("./snapshot.transforms");
const { getSchemaManifest, getTableNames, validateSnapshotUniqueStudentIds } = require("./snapshot.service");
const { prepareAccessionRestore } = require("./accession.restore");

async function setMaintenance(mode, userId = null) {
  await db.query(
    "UPDATE system_maintenance_state SET mode = ?, started_at = CASE WHEN ? = 'restoring' THEN UTC_TIMESTAMP() ELSE NULL END, started_by = CASE WHEN ? = 'restoring' THEN ? ELSE NULL END WHERE id = 1",
    [mode, mode, mode, userId]
  );
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

async function getLiveAccessionState(connection) {
  const [claims] = await connection.query("SELECT * FROM accession_claims");
  const [corrections] = await connection.query("SELECT * FROM accession_claim_corrections");
  const [voids] = await connection.query("SELECT * FROM accession_claim_voids");
  const [holdings] = await connection.query(
    `SELECT h.*, bc.barcode AS copy_barcode, bc.book_id, bk.title
       FROM copy_holdings h JOIN book_copies bc ON bc.id = h.copy_id
       JOIN books bk ON bk.id = bc.book_id`
  );
  return { claims, corrections, voids, holdings };
}

async function preflightAccessionRestore(backup) {
  const live = await getLiveAccessionState(db);
  return prepareAccessionRestore(backup.tables, live);
}

async function preservePendingAuditEvents(connection) {
  const [rows] = await connection.query(
    `SELECT id, payload, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s.%f') AS created_at
       FROM delivery_outbox
      WHERE event_type = 'audit' AND status = 'pending'
      ORDER BY created_at ASC, id ASC FOR UPDATE`,
  );
  for (const row of rows) {
    const event = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
    const actorId = event.actorId ?? null;
    let actorName = event.actorName ?? null;
    let actorRole = event.actorRole ?? null;
    if (actorId) {
      const [[actor]] = await connection.query("SELECT name, role FROM users WHERE id = ? LIMIT 1", [actorId]);
      actorName ||= actor?.name ?? null;
      actorRole ||= actor?.role ?? null;
    }
    // The outbox row may not have reached audit_events before an older
    // application snapshot is restored. Materialize it before the outbox is
    // replaced so the usual restore reversal pass can classify it correctly.
    await connection.query(
      `INSERT IGNORE INTO audit_events
         (actor_id, actor_name, actor_role, category, action, description, route, metadata, event_key, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [actorId, actorName, actorRole, event.category, event.action, event.description, event.route ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null, row.id, row.created_at],
    );
  }
  return rows.length;
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

async function replaceApplicationData(backup, {
  restoredBy = null,
  restoredByName = null,
  restoredByRole = null,
  snapshotId = null,
  snapshotKind = "uploaded",
  snapshotLabel = "uploaded snapshot",
  preRestoreSnapshotId = null,
  invalidateSessions,
} = {}) {
  const tables = await getTableNames();
  const backupTables = Object.keys(backup.tables).sort();
  if (JSON.stringify(backupTables) !== JSON.stringify(tables)) {
    throw Object.assign(new Error("This backup does not contain exactly the current application tables and cannot be restored safely."), { status: 409 });
  }
  validateSnapshotUniqueStudentIds(backup);
  const schemaTables = await getSchemaManifest();
  let connection;
  let orphanedAccessionClaimCount = 0;
  let retainedAccessionAudit = [];
  let preservedPendingAuditEventCount = 0;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    await connection.query("SET @allow_accession_restore = 1");
    const liveAccessionState = await getLiveAccessionState(connection);
    const accessionRestore = prepareAccessionRestore(backup.tables, liveAccessionState);
    backup.tables = accessionRestore.tables;
    orphanedAccessionClaimCount = accessionRestore.orphanedClaimCount;
    preservedPendingAuditEventCount = await preservePendingAuditEvents(connection);
    const [auditRows] = await connection.query(
      `SELECT actor_id, actor_name, actor_role, category, action, description, route, metadata,
              event_key, restore_status, reversed_at, reversed_by_restore_id, occurred_at
         FROM audit_events
        WHERE category = 'catalog'
          AND event_key IS NOT NULL
          AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.permanent_accession_event')) = 'true'`,
    );
    retainedAccessionAudit = auditRows;
    const registryTables = new Set(["accession_claims", "accession_claim_corrections", "accession_claim_voids"]);
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of backupTables) if (!registryTables.has(table)) await connection.query(`DELETE FROM \`${table}\``);
    for (const table of ["accession_claims", "accession_claim_voids", "accession_claim_corrections"]) {
      const definitions = new Map((schemaTables[table]?.columns ?? []).map((column) => [column.name, column]));
      for (const row of backup.tables[table]) {
        const columns = Object.keys(row).filter((column) => !/generated/i.test(String(definitions.get(column)?.extra ?? "")));
        if (!columns.length) continue;
        const values = columns.map((column) => decodeValue(row[column], definitions.get(column)?.columnType));
        await connection.query(
          `INSERT IGNORE INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
          values,
        );
      }
    }
    for (const table of backupTables) {
      if (registryTables.has(table)) continue;
      const definitions = new Map((schemaTables[table]?.columns ?? []).map((column) => [column.name, column]));
      for (const [rowIndex, row] of backup.tables[table].entries()) {
        const columns = Object.keys(row);
        if (columns.some((column) => !definitions.has(column))) {
          throw Object.assign(new Error(`The backup contains unsupported columns for ${table}.`), { status: 400 });
        }
        const insertColumns = columns.filter((column) => !/generated/i.test(String(definitions.get(column)?.extra ?? "")));
        if (!insertColumns.length) continue;
        const names = insertColumns.map((column) => `\`${column}\``).join(", ");
        const values = insertColumns.map((column) => {
          try {
            return decodeValue(row[column], definitions.get(column)?.columnType);
          } catch (error) {
            throw Object.assign(
              new Error(`Snapshot value for ${table}.${column} (row ${rowIndex + 1}) is invalid: ${error.message}`),
              { status: error.status || 400 }
            );
          }
        });
        await connection.query(`INSERT INTO \`${table}\` (${names}) VALUES (${insertColumns.map(() => "?").join(", ")})`, values);
      }
    }
    // Permanent accession events have already been materialized from both the
    // audit table and pending audit outbox rows; the latter are classified by
    // the same post-snapshot reversal update below.
    for (const row of retainedAccessionAudit) {
      const metadata = typeof row.metadata === "string" ? row.metadata : JSON.stringify(row.metadata);
      await connection.query(
        `INSERT IGNORE INTO audit_events
           (actor_id, actor_name, actor_role, category, action, description, route, metadata, event_key,
            restore_status, reversed_at, reversed_by_restore_id, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.actor_id, row.actor_name, row.actor_role, row.category, row.action, row.description, row.route,
          metadata, row.event_key, row.restore_status, row.reversed_at, row.reversed_by_restore_id, row.occurred_at],
      );
    }
    await assertForeignKeys(connection);
    await invalidateSessions(connection);
    const [restoreAudit] = await connection.query(
      `INSERT INTO restore_audit_events (snapshot_id, snapshot_kind, restored_by, pre_restore_snapshot_id)
       VALUES (?, ?, ?, ?)`,
      [snapshotId, snapshotKind, restoredBy || null, preRestoreSnapshotId]
    );
    const restoreAuditId = restoreAudit.insertId;
    const snapshotCutoff = decodeValue(backup.createdAt, "datetime");
    const [reversed] = await connection.query(
      `UPDATE audit_events
       SET restore_status = 'reversed', reversed_at = UTC_TIMESTAMP(), reversed_by_restore_id = ?
       WHERE occurred_at > DATE_ADD(?, INTERVAL TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), CURRENT_TIMESTAMP()) SECOND)
       AND restore_status = 'retained'
       AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.permanent_accession_event')), 'false') <> 'true'
       AND category NOT IN ('auth', 'backup', 'system')`,
      [restoreAuditId, snapshotCutoff]
    );
    await connection.query(
      `INSERT INTO audit_events
         (actor_id, actor_name, actor_role, category, action, description, route, metadata)
       VALUES (?, ?, ?, 'backup', 'restored', ?, '/api/admin/backup/restore', ?)`,
      [
        restoredBy || null,
        restoredByName,
        restoredByRole,
        `Restored ${snapshotLabel}; ${reversed.affectedRows} post-snapshot data change${reversed.affectedRows === 1 ? "" : "s"} reversed; ${preservedPendingAuditEventCount} pending audit event${preservedPendingAuditEventCount === 1 ? "" : "s"} preserved; ${orphanedAccessionClaimCount} accession claim${orphanedAccessionClaimCount === 1 ? "" : "s"} retained without a restored copy; ${retainedAccessionAudit.length} permanent accession audit event${retainedAccessionAudit.length === 1 ? "" : "s"} retained`,
        JSON.stringify({ snapshot_id: snapshotId, snapshot_kind: snapshotKind, pre_restore_snapshot_id: preRestoreSnapshotId, reversed_event_count: reversed.affectedRows, pending_audit_events_preserved: preservedPendingAuditEventCount, accession_claims_retained: true, orphaned_accession_claim_count: orphanedAccessionClaimCount, permanent_accession_audit_events_retained: retainedAccessionAudit.length }),
      ]
    );
    await connection.query("SET @allow_accession_restore = 0");
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    await connection.commit();
    return { orphanedAccessionClaimCount };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
      await connection.query("SET @allow_accession_restore = 0").catch(() => {});
      connection.release();
    }
  }
}

module.exports = { setMaintenance, acquireRestoreLock, preflightAccessionRestore, preservePendingAuditEvents, assertForeignKeys, replaceApplicationData };

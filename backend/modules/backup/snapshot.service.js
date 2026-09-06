const db = require("../../db");
const { SYSTEM_TABLES, APPLICATION_TABLES } = require("./snapshot.registry");
const {
  SNAPSHOT_VERSION,
  encodeValue,
  payloadChecksum,
  validateBackup,
  upgradeBackup,
} = require("./snapshot.transforms");

async function getTableNames(connection = db) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
       AND TABLE_NAME NOT IN (${SYSTEM_TABLES.map(() => "?").join(", ")}) ORDER BY TABLE_NAME`,
    SYSTEM_TABLES
  );
  const discovered = rows.map((row) => row.TABLE_NAME);
  const expected = [...APPLICATION_TABLES].sort();
  if (JSON.stringify(discovered) !== JSON.stringify(expected)) {
    throw Object.assign(new Error("Application table registry is out of date. Add the new table and its snapshot default before deployment."), { status: 500 });
  }
  return expected;
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
  return tables;
}

async function createBackupPayload() {
  const connection = await db.getConnection();
  try {
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
    await connection.commit();
    const payload = {
      format: "euc-library-backup",
      version: SNAPSHOT_VERSION,
      createdAt: new Date().toISOString(),
      tableManifest: tables,
      tables: data,
    };
    payload.integrity = { algorithm: "sha256", checksum: payloadChecksum(payload) };
    return payload;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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

async function preflightRestore(backup) {
  const tables = await getTableNames();
  const backupTables = Object.keys(backup.tables).sort();
  if (backupTables.some((table) => !APPLICATION_TABLES.includes(table))) throw Object.assign(new Error("The backup contains an unknown application table."), { status: 400 });
  if (JSON.stringify(backupTables) !== JSON.stringify(tables)) throw Object.assign(new Error("This snapshot is missing an application table. Add an explicit snapshot upgrade default before restoring it."), { status: 409 });
  if (backupTables.some((table) => !Array.isArray(backup.tables[table]))) throw Object.assign(new Error("The backup contains invalid table data."), { status: 400 });
  validateSnapshotUniqueStudentIds(backup);
  const schemaTables = await getSchemaManifest();
  for (const table of backupTables) {
    const columns = new Set((schemaTables[table]?.columns ?? []).map((column) => column.name));
    for (const row of backup.tables[table]) {
      if (!row || typeof row !== "object" || Array.isArray(row)) throw Object.assign(new Error(`The backup contains an invalid row for ${table}.`), { status: 400 });
      if (Object.keys(row).some((column) => !columns.has(column))) {
        throw Object.assign(new Error(`The snapshot has unsupported ${table} columns. Export from a supported release or add a snapshot transformer.`), { status: 409 });
      }
    }
  }
}

async function compatibilityFor(backup) {
  if (!validateBackup(backup)) return { compatible: false, message: "This file is not a valid EUC Library backup." };
  try {
    const prepared = upgradeBackup(JSON.parse(JSON.stringify(backup)));
    await preflightRestore(prepared);
    return { compatible: true, version: prepared.version, message: "Compatible with the current catalog and application data model." };
  } catch (error) {
    return { compatible: false, version: backup.version, message: error.message || "This snapshot is not compatible." };
  }
}

module.exports = {
  createBackupPayload,
  getSchemaManifest,
  getTableNames,
  preflightRestore,
  compatibilityFor,
  validateSnapshotUniqueStudentIds,
};

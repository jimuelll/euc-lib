const db = require("../../db");
const { SNAPSHOT_TABLE } = require("./snapshot.registry");

function getConnection() {
  return db.getConnection();
}

async function listApplicationTables(connection = db, systemTables = []) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
       AND TABLE_NAME NOT IN (${systemTables.map(() => "?").join(", ")}) ORDER BY TABLE_NAME`,
    systemTables
  );
  return rows.map((row) => row.TABLE_NAME);
}

async function getSchemaManifest(systemTables = [], connection = db) {
  const [columns] = await connection.query(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLUMN_TYPE AS columnType,
            IS_NULLABLE AS isNullable, EXTRA AS extra
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME NOT IN (${systemTables.map(() => "?").join(", ")})
      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    systemTables
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

async function readTable(table, connection = db) {
  const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
  return rows;
}

async function createSnapshotRecord({ publicId, filename, sizeBytes, kind, createdBy }) {
  const [result] = await db.query(
    `INSERT INTO ${SNAPSHOT_TABLE} (cloudinary_public_id, filename, size_bytes, kind, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [publicId, filename, sizeBytes, kind, createdBy || null]
  );
  return result;
}

async function pruneSnapshots(maxSnapshots) {
  const [expired] = await db.query(
    `SELECT id, cloudinary_public_id FROM ${SNAPSHOT_TABLE}
     ORDER BY created_at DESC, id DESC LIMIT 18446744073709551615 OFFSET ?`,
    [maxSnapshots]
  );
  if (expired.length) {
    await db.query(`DELETE FROM ${SNAPSHOT_TABLE} WHERE id IN (?)`, [expired.map((snapshot) => snapshot.id)]);
  }
  return expired;
}

async function findSnapshot(id) {
  const [[snapshot]] = await db.query(`SELECT * FROM ${SNAPSHOT_TABLE} WHERE id = ?`, [id]);
  if (!snapshot) throw Object.assign(new Error("Snapshot not found."), { status: 404 });
  return snapshot;
}

async function listSnapshots() {
  const [snapshots] = await db.query(
    `SELECT bs.id, bs.filename, bs.size_bytes AS sizeBytes, bs.kind, bs.created_at AS createdAt, u.name AS createdBy
     FROM ${SNAPSHOT_TABLE} bs LEFT JOIN users u ON u.id = bs.created_by
     ORDER BY bs.created_at DESC, bs.id DESC`
  );
  return snapshots;
}

async function getMaintenanceStatus() {
  const [[state]] = await db.query("SELECT mode, started_at AS startedAt FROM system_maintenance_state WHERE id = 1");
  return state || {};
}

module.exports = {
  getConnection,
  listApplicationTables,
  getSchemaManifest,
  readTable,
  createSnapshotRecord,
  pruneSnapshots,
  findSnapshot,
  listSnapshots,
  getMaintenanceStatus,
};

import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import registry = require("./snapshot.registry");

const db = require("../../db") as Pool;
type QueryConnection = Pool | PoolConnection;

interface SchemaColumn extends RowDataPacket {
  tableName: string;
  name: string;
  columnType: string;
  isNullable: string;
  extra: string;
}
interface TableManifest {
  columns: Array<{ name: string; columnType: string; isNullable: string; extra: string }>;
}
interface SavedSnapshot extends RowDataPacket {
  id: number;
  filename: string;
  sizeBytes?: number;
  size_bytes?: number;
  kind?: string;
  createdAt?: Date | string;
  createdBy?: string | null;
  cloudinary_public_id: string;
  book_image_public_ids: string | string[] | null;
}
interface MaintenanceState extends RowDataPacket {
  mode?: string;
  startedAt?: Date | string;
}

function getConnection(): Promise<PoolConnection> {
  return db.getConnection();
}

async function listApplicationTables(connection: QueryConnection = db, systemTables: string[] = []): Promise<string[]> {
  const [rows] = await connection.query<Array<RowDataPacket & { TABLE_NAME: string }>>(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
       AND TABLE_NAME NOT IN (${systemTables.map(() => "?").join(", ")}) ORDER BY TABLE_NAME`,
    systemTables,
  );
  return rows.map((row) => row.TABLE_NAME);
}

async function getSchemaManifest(systemTables: string[] = [], connection: QueryConnection = db): Promise<Record<string, TableManifest>> {
  const [columns] = await connection.query<SchemaColumn[]>(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLUMN_TYPE AS columnType,
            IS_NULLABLE AS isNullable, EXTRA AS extra
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME NOT IN (${systemTables.map(() => "?").join(", ")})
      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    systemTables,
  );
  const tables: Record<string, TableManifest> = {};
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

async function readTable(table: string, connection: QueryConnection = db): Promise<RowDataPacket[]> {
  const [rows] = await connection.query<RowDataPacket[]>(`SELECT * FROM \`${table}\``);
  return rows;
}

async function createSnapshotRecord({
  publicId,
  filename,
  sizeBytes,
  bookImagePublicIds = [],
  kind,
  createdBy,
}: {
  publicId: string;
  filename: string;
  sizeBytes: number;
  bookImagePublicIds?: string[];
  kind: string;
  createdBy: number | null | undefined;
}): Promise<ResultSetHeader> {
  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO ${registry.SNAPSHOT_TABLE} (cloudinary_public_id, filename, size_bytes, book_image_public_ids, kind, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [publicId, filename, sizeBytes, JSON.stringify(bookImagePublicIds), kind, createdBy || null],
  );
  return result;
}

async function getSnapshotsToPrune(maxSnapshots: number): Promise<SavedSnapshot[]> {
  const [snapshots] = await db.query<SavedSnapshot[]>(
    `SELECT id, cloudinary_public_id, book_image_public_ids
     FROM ${registry.SNAPSHOT_TABLE}
     ORDER BY created_at DESC, id DESC LIMIT 18446744073709551615 OFFSET ?`,
    [maxSnapshots],
  );
  return snapshots;
}

async function getSnapshotsMissingBookImagePublicIds(): Promise<SavedSnapshot[]> {
  const [snapshots] = await db.query<SavedSnapshot[]>(
    `SELECT id, cloudinary_public_id, book_image_public_ids
     FROM ${registry.SNAPSHOT_TABLE}
     WHERE book_image_public_ids IS NULL
     ORDER BY created_at DESC, id DESC`,
  );
  return snapshots;
}

async function setSnapshotBookImagePublicIds(id: number, publicIds: string[]): Promise<void> {
  await db.query(`UPDATE ${registry.SNAPSHOT_TABLE} SET book_image_public_ids = ? WHERE id = ?`, [JSON.stringify(publicIds), id]);
}

async function pruneSnapshots(maxSnapshots: number, excludedIds: number[] = []): Promise<SavedSnapshot[]> {
  const excluded = new Set(excludedIds.map(Number));
  const expired = (await getSnapshotsToPrune(maxSnapshots)).filter((snapshot) => !excluded.has(Number(snapshot.id)));
  if (expired.length) {
    await db.query(`DELETE FROM ${registry.SNAPSHOT_TABLE} WHERE id IN (?)`, [expired.map((snapshot) => snapshot.id)]);
  }
  return expired;
}

async function isBookImageReferenced(publicId: string): Promise<boolean> {
  const [[references]] = await db.query<Array<RowDataPacket & { used_by_book: number; used_by_snapshot: number }>>(
    `SELECT
       EXISTS(SELECT 1 FROM books WHERE image_public_id = ?) AS used_by_book,
       EXISTS(SELECT 1 FROM ${registry.SNAPSHOT_TABLE}
               WHERE book_image_public_ids IS NULL
                  OR JSON_CONTAINS(book_image_public_ids, JSON_QUOTE(?), '$')) AS used_by_snapshot`,
    [publicId, publicId],
  );
  return Boolean(references?.used_by_book || references?.used_by_snapshot);
}

async function findSnapshot(id: number | string): Promise<SavedSnapshot> {
  const [[snapshot]] = await db.query<SavedSnapshot[]>(`SELECT * FROM ${registry.SNAPSHOT_TABLE} WHERE id = ?`, [id]);
  if (!snapshot) throw Object.assign(new Error("Snapshot not found."), { status: 404 });
  return snapshot;
}

async function listSnapshots(): Promise<SavedSnapshot[]> {
  const [snapshots] = await db.query<SavedSnapshot[]>(
    `SELECT bs.id, bs.filename, bs.size_bytes AS sizeBytes, bs.kind, bs.created_at AS createdAt, u.name AS createdBy
     FROM ${registry.SNAPSHOT_TABLE} bs LEFT JOIN users u ON u.id = bs.created_by
     ORDER BY bs.created_at DESC, bs.id DESC`,
  );
  return snapshots;
}

async function getMaintenanceStatus(): Promise<MaintenanceState> {
  const [[state]] = await db.query<MaintenanceState[]>("SELECT mode, started_at AS startedAt FROM system_maintenance_state WHERE id = 1");
  return state || {} as MaintenanceState;
}

export = {
  getConnection,
  listApplicationTables,
  getSchemaManifest,
  readTable,
  createSnapshotRecord,
  getSnapshotsToPrune,
  getSnapshotsMissingBookImagePublicIds,
  setSnapshotBookImagePublicIds,
  pruneSnapshots,
  isBookImageReferenced,
  findSnapshot,
  listSnapshots,
  getMaintenanceStatus,
};

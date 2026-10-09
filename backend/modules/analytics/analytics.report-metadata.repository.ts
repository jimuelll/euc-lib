import type { Pool, RowDataPacket } from 'mysql2/promise';
const db = require('../../db') as Pool;
export async function reportMetadata(actorId?: number) {
  const [[library]] = await db.query<Array<RowDataPacket & { library_name: string }>>('SELECT library_name FROM about_settings LIMIT 1');
  const [[actor]] = actorId ? await db.query<Array<RowDataPacket & { name: string }>>('SELECT name FROM users WHERE id = ?', [actorId]) : [[]];
  return { libraryName: library?.library_name || 'Library', generatedBy: actor?.name || null };
}

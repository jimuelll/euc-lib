import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {RowDataPacket} from 'mysql2/promise';
import db = require('../db');
async function main() {
  const [[column]] = await db.query<RowDataPacket[]>("SHOW COLUMNS FROM notifications LIKE 'audience_type'");
  const [tables] = await db.query<RowDataPacket[]>("SHOW TABLES LIKE 'notification_recipients'");
  if (String(column.Type).includes("'users'") && tables.length) { console.log('Notification recipient schema ready.'); return; }
  if (!process.argv.includes('--apply')) throw new Error('Migration required. Run npm run migrate-notification-recipients -- --apply before deploying the new audience support.');
  const source = readFileSync(resolve(__dirname,'../../db/migrations/2026-10-27-notification-recipients.sql'),'utf8');
  for (const sql of source.split(';').map(value=>value.trim()).filter(Boolean)) await db.query(sql);
  console.log('Notification recipient schema ready. Existing audiences are preserved.');
}
main().catch(error=>{console.error(error.code || error.message);process.exitCode=1;}).finally(()=>db.end());

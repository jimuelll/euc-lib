import type { Pool, RowDataPacket } from 'mysql2/promise';
const db = require('../../db') as Pool;

export async function accountByIdentifier(identifier: string) {
  const [rows] = await db.query<RowDataPacket[]>('SELECT id,role FROM users WHERE student_employee_id=? AND deleted_at IS NULL LIMIT 1', [identifier]);
  return rows[0];
}
export async function available(field: 'email' | 'username', value: string, excludeId: number) {
  const [rows] = field === 'email'
    ? await db.query<RowDataPacket[]>('SELECT user_id FROM email_address_claims WHERE email=? AND user_id<>? LIMIT 1', [value, excludeId])
    : await db.query<RowDataPacket[]>('SELECT id FROM users WHERE (username=? OR student_employee_id=?) AND deleted_at IS NULL AND id<>? LIMIT 1', [value, value, excludeId]);
  return rows.length === 0;
}
export async function accountEmailStatus(userId: number) {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT purpose,status,
    DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') AS requested_at,
    DATE_FORMAT(accepted_at,'%Y-%m-%dT%H:%i:%sZ') AS accepted_at
    FROM email_deliveries d WHERE user_id=? AND purpose IN ('setup','verify_email','recovery')
    AND NOT EXISTS (SELECT 1 FROM email_deliveries newer WHERE newer.user_id=d.user_id AND newer.purpose=d.purpose
      AND (newer.created_at>d.created_at OR (newer.created_at=d.created_at AND newer.id>d.id)))`, [userId]);
  return rows;
}

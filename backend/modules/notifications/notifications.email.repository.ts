import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { CreateNotificationInput } from './notifications.types';
const db = require('../../db') as Pool;

export interface ManualPublication extends CreateNotificationInput { sendEmail: boolean }
export function audienceWhere(input: CreateNotificationInput) {
  const params: unknown[] = [];
  let sql = 'u.deleted_at IS NULL AND u.is_active=1';
  if (input.audienceType === 'role') { sql += ' AND u.role=?'; params.push(input.audienceRole); }
  if (input.audienceType === 'user') { sql += ' AND u.id=?'; params.push(input.audienceUserId); }
  return { sql, params };
}
const emailEligible = "u.setup_pending=0 AND u.email_verified_at IS NOT NULL AND u.email IS NOT NULL AND TRIM(u.email)<>''";
export async function preview(input: CreateNotificationInput, day: string) {
  const audience = audienceWhere(input);
  const [[counts]] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS total,COALESCE(SUM(${emailEligible}),0) AS eligible FROM users u WHERE ${audience.sql}`, audience.params);
  const [[usage]] = await db.query<RowDataPacket[]>('SELECT COALESCE(MAX(requests_used),0) AS used FROM email_quota_usage WHERE period_start=?', [day]);
  const [[pending]] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS queued FROM email_deliveries WHERE priority=0 AND status='queued' AND expires_at>UTC_TIMESTAMP()");
  return { total: Number(counts.total), eligible: Number(counts.eligible), used: Number(usage.used), queued: Number(pending.queued) };
}

// One transaction publishes the notification, freezes recipients and creates all handoffs.
// No external delivery or template rendering runs on this path.
export async function publish(input: ManualPublication, confirmed?: { total: number; email: number }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const deliveryKey = input.deliveryKey || `manual:${randomUUID()}`;
    const [[existing]] = await conn.query<RowDataPacket[]>('SELECT * FROM notifications WHERE delivery_key=? FOR UPDATE',[deliveryKey]);
    if (existing) { await conn.commit(); return { record:existing,created:false }; }
    const batch = input.sendEmail ? randomUUID() : null;
    const emailExpiry = input.expiresAt ? new Date(input.expiresAt).toISOString().slice(0,19).replace('T',' ') : null;
    const [insert] = await conn.query<ResultSetHeader>(`INSERT INTO notifications
      (type,title,body,href,audience_type,audience_user_id,audience_role,expires_at,created_by,delivery_key,email_requested,email_batch_id,email_expires_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,IF(?=1,LEAST(COALESCE(?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY)),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY)),NULL))
      `, [input.type,input.title,input.body,input.href || null,input.audienceType || 'all',input.audienceUserId || null,input.audienceRole || null,input.expiresAt || null,input.createdBy || null,deliveryKey,input.sendEmail?1:0,batch,input.sendEmail?1:0,emailExpiry]);
    const [[record]] = await conn.query<RowDataPacket[]>('SELECT * FROM notifications WHERE id=? FOR UPDATE', [insert.insertId]);
    const audience = audienceWhere(input);
    if (confirmed) {
      const [[count]] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM users u WHERE ${audience.sql}`, audience.params);
      if (Number(count.total) !== confirmed.total) throw Object.assign(new Error('The recipient count changed. Review the audience and confirm again.'), { status:409 });
    }
    if (input.sendEmail) {
      const [snapshot] = await conn.query<ResultSetHeader>(`INSERT INTO email_deliveries
        (id,user_id,recipient,purpose,dedupe_key,priority,notification_id,context_json,expires_at,next_attempt_at,created_at)
        SELECT UUID(),u.id,LOWER(TRIM(u.email)),'manual_notification',CONCAT('manual:',?,':',u.id),0,?,JSON_OBJECT('manualBatch',?),n.email_expires_at,UTC_TIMESTAMP(),UTC_TIMESTAMP()
        FROM users u JOIN notifications n ON n.id=? WHERE ${audience.sql} AND ${emailEligible}
        AND n.is_active=1 AND n.email_expires_at>UTC_TIMESTAMP()`, [batch,record.id,batch,record.id,...audience.params]);
      if (confirmed && snapshot.affectedRows !== confirmed.email) throw Object.assign(new Error('The verified email recipient count changed. Review and confirm again.'), { status:409 });
      await conn.query(`INSERT INTO delivery_outbox (id,event_type,payload)
        SELECT d.id,'email',JSON_OBJECT('deliveryId',d.id) FROM email_deliveries d
        WHERE d.notification_id=? AND JSON_UNQUOTE(JSON_EXTRACT(d.context_json,'$.manualBatch'))=?`, [record.id,batch]);
    }
    await conn.commit();
    return { record, created: true };
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
}
export async function summary(notificationId: number, batch: string) {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT status,COUNT(*) AS total FROM email_deliveries WHERE notification_id=?
    AND JSON_UNQUOTE(JSON_EXTRACT(context_json,'$.manualBatch'))=? GROUP BY status`, [notificationId,batch]);
  const counts = { queued:0,processing:0,accepted:0,failed:0,unknown:0,cancelled:0 };
  for (const row of rows) if (row.status in counts) counts[row.status as keyof typeof counts] = Number(row.total);
  return counts;
}
export async function cancelUnsent(conn: PoolConnection, id: number) {
  await conn.query("UPDATE email_deliveries SET status='cancelled',content_encrypted=NULL,last_error='Notification expired by administrator' WHERE notification_id=? AND status IN ('queued','failed')", [id]);
}

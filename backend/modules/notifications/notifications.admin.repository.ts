import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
const db = require("../../db") as Pool;
const json = (key: string) => `CONVERT(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(o.payload, '$.${key}')), 'null') USING utf8mb4) COLLATE utf8mb4_unicode_ci`;
// Delivered queue events already have a notification row; include only pending
// and explicitly cancelled queue records to avoid duplicate feed entries.
const feed = `SELECT CONCAT('notification:',n.id) AS record_key, n.id, NULL AS queue_id,
 n.type,n.title,n.body,n.href,n.audience_type,n.audience_user_id,n.audience_role,
 n.created_at,n.expires_at,NULL AS scheduled_at,n.created_by,n.source_type,
 CASE WHEN n.source_type IS NOT NULL OR n.created_by IS NULL THEN 'automatic' ELSE 'manual' END AS origin,
 CASE WHEN n.is_active=0 OR n.expires_at<=NOW() THEN 'expired' ELSE 'available' END AS delivery_status,
 NULL AS last_error,(SELECT COUNT(*) FROM notification_reads r WHERE r.notification_id=n.id) AS read_count,
 n.email_requested,n.email_batch_id,DATE_FORMAT(n.email_expires_at,'%Y-%m-%dT%H:%i:%sZ') AS email_expires_at
 FROM notifications n
 UNION ALL SELECT CONCAT('queue:',o.id),NULL,o.id,
 ${json('type')},${json('title')},${json('body')},${json('href')},${json('audienceType')},
 ${json('audienceUserId')},${json('audienceRole')},o.created_at,${json('expiresAt')},${json('scheduledAt')},
 ${json('createdBy')},${json('sourceType')},
 CASE WHEN ${json('sourceType')} IS NOT NULL OR ${json('createdBy')} IS NULL THEN 'automatic' ELSE 'manual' END,
 CASE WHEN ${json('cancelledAt')} IS NOT NULL THEN 'expired' WHEN o.last_error IS NOT NULL THEN 'failed'
 WHEN o.available_at>NOW() THEN 'scheduled' ELSE 'queued' END,o.last_error,0,
 CASE WHEN ${json('sendEmail')}='true' THEN 1 ELSE 0 END,NULL,NULL
 FROM delivery_outbox o WHERE o.event_type='notification' AND (o.status='pending' OR ${json('cancelledAt')} IS NOT NULL)`;
const grouped = `SELECT f.*,CASE WHEN origin='automatic' THEN CONCAT(type,':',DATE(created_at),':',delivery_status) ELSE record_key END COLLATE utf8mb4_unicode_ci AS group_key FROM (${feed}) f`;
const ranked = `SELECT f.*,ROW_NUMBER() OVER(PARTITION BY group_key ORDER BY created_at DESC,record_key DESC) AS row_rank,
 COUNT(*) OVER(PARTITION BY group_key) AS group_count,SUM(read_count) OVER(PARTITION BY group_key) AS group_reads FROM (${grouped}) f`;
export interface FeedOptions {
    tab: string;
    filter: string;
    search: string;
    page: number;
    limit: number;
}
function where(options: FeedOptions, filter = true) {
    const params: unknown[] = [];
    let sql = " WHERE row_rank=1";
    if (options.tab !== "all")
        sql += options.tab === 'system' ? " AND type NOT IN ('announcement','reminder')" : " AND type IN ('announcement','reminder')";
    if (filter && options.filter !== "all") {
        sql += options.filter === "failed" ? " AND delivery_status='failed'" : " AND origin=?";
        if (options.filter !== "failed")
            params.push(options.filter);
    }
    if (options.search) {
        sql += ` AND EXISTS(SELECT 1 FROM (${grouped}) matched WHERE matched.group_key=f.group_key AND (matched.title LIKE ? OR matched.body LIKE ? OR matched.type LIKE ? OR EXISTS(SELECT 1 FROM users u WHERE u.id=matched.audience_user_id AND u.name LIKE ?)))`;
        params.push(...Array(4).fill(`%${options.search}%`));
    }
    return { sql, params };
}
export async function list(options: FeedOptions) {
    const match = where(options), base = where(options, false);
    const [rows] = await db.query<RowDataPacket[]>(`SELECT f.*,creator.name AS creator_name,recipient.name AS audience_user_name,
 COALESCE(recipient.username,recipient.student_employee_id) AS audience_user_identifier,recipient.student_employee_id AS audience_user_patron_id
 FROM (${ranked}) f LEFT JOIN users creator ON creator.id=f.created_by LEFT JOIN users recipient ON recipient.id=f.audience_user_id
 ${match.sql} ORDER BY f.created_at DESC,f.record_key DESC LIMIT ? OFFSET ?`, [...match.params, options.limit, (options.page - 1) * options.limit]);
    const [[count]] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) total FROM (${ranked}) f ${match.sql}`, match.params);
    const [[counts]] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS all_count,SUM(origin='manual') AS manual,SUM(origin='automatic') AS automatic,SUM(delivery_status='failed') AS failed FROM (${ranked}) f ${base.sql}`, base.params);
    return { rows, total: Number(count.total), counts: { manual: Number(counts.manual || 0), automatic: Number(counts.automatic || 0), failed: Number(counts.failed || 0), all: Number(counts.all_count || 0) } };
}
export async function audienceCount(type: string, role: string | null, userId: number | null) {
    const params: unknown[] = [];
    let sql = "SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL AND is_active=1";
    if (type === 'role') {
        sql += ' AND role=?';
        params.push(role);
    }
    if (type === 'user') {
        sql += ' AND id=?';
        params.push(userId);
    }
    const [[row]] = await db.query<RowDataPacket[]>(sql, params);
    return Number(row.total);
}
export async function get(recordKey: string) { const [[row]] = await db.query<RowDataPacket[]>(`SELECT f.*,u.name AS audience_user_name,u.student_employee_id AS audience_user_patron_id,COALESCE(u.username,u.student_employee_id) AS audience_user_identifier FROM (${feed}) f LEFT JOIN users u ON u.id=f.audience_user_id WHERE record_key=?`, [recordKey]); return row || null; }
export async function group(type: string, day: string, status: string) { const [rows] = await db.query<RowDataPacket[]>(`SELECT f.*,u.name AS audience_user_name,u.student_employee_id AS audience_user_patron_id FROM (${feed}) f LEFT JOIN users u ON u.id=f.audience_user_id WHERE origin='automatic' AND type=? AND DATE(created_at)=? AND delivery_status=? ORDER BY created_at DESC LIMIT 100`, [type, day, status]); return rows; }
export async function enqueue(payload: Record<string, unknown>, when: Date) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const outbox = require('../delivery-outbox/outbox.repository');
        const id = await outbox.enqueue('notification', payload, conn);
        await conn.query('UPDATE delivery_outbox SET available_at=? WHERE id=?', [when, id]);
        await conn.commit();
        return id;
    }
    catch (error) {
        await conn.rollback();
        throw error;
    }
    finally {
        conn.release();
    }
}
export async function expire(recordKey: string) {
    const row = await get(recordKey);
    if (!row)
        return false;
    if (row.queue_id) {
        const [result] = await db.query<ResultSetHeader>(`UPDATE delivery_outbox SET status='delivered',payload=JSON_SET(payload,'$.cancelledAt',DATE_FORMAT(NOW(),'%Y-%m-%dT%H:%i:%s')),locked_at=NULL WHERE id=? AND status='pending' AND locked_at IS NULL`, [row.queue_id]);
        return result.affectedRows===1;
    }
    const conn=await db.getConnection();let locked=false;
    try {
        const [[lock]]=await conn.query<RowDataPacket[]>("SELECT GET_LOCK('euc-library-email-dispatch',20) AS acquired");
        if (!lock.acquired) throw Object.assign(new Error('Email delivery is busy. Try expiring this notification again.'),{status:409});
        locked=true;await conn.beginTransaction();
        const [result]=await conn.query<ResultSetHeader>('UPDATE notifications SET is_active=0,expires_at=NOW() WHERE id=? AND is_active=1',[row.id]);
        await require('./notifications.email.repository').cancelUnsent(conn,row.id);
        await conn.commit();return result.affectedRows===1;
    } catch(error) {await conn.rollback();throw error;} finally {if(locked)await conn.query("SELECT RELEASE_LOCK('euc-library-email-dispatch')");conn.release();}
}
export async function retry(queueId: string) { const [result] = await db.query<ResultSetHeader>("UPDATE delivery_outbox SET available_at=NOW(),last_error=NULL,locked_at=NULL WHERE id=? AND event_type='notification' AND status='pending' AND locked_at IS NULL", [queueId]); return result.affectedRows === 1; }

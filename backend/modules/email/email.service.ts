import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { config, protect, unprotect, sqlDate } from './email.config';
import { provider, prepareEmailRequest, SendFailure, type EmailMessage } from './email.provider';
import outbox = require('../delivery-outbox/outbox.repository');
const db = require('../../db') as Pool;
type Connection = Pool | PoolConnection;
interface Delivery extends RowDataPacket { id: string; user_id: number; recipient: string; purpose: string; priority: number; challenge_id: string | null; content_encrypted: string | null; context_json: string | Record<string, unknown> | null; attempts: number; status: string; notification_id?:number|null }
export interface QueueEmail { userId: number; recipient: string; purpose: string; dedupeKey: string; challengeId?: string; security?: boolean; expiresAt: Date; message?: EmailMessage; context?: Record<string, unknown> }
export async function enqueue(conn: PoolConnection, input: QueueEmail): Promise<string | null> {
  if (!config().enabled) return null;
  const id = randomUUID();
  await conn.query(`INSERT INTO email_deliveries (id,user_id,recipient,purpose,dedupe_key,challenge_id,priority,content_encrypted,context_json,expires_at,next_attempt_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE id=id`, [id,input.userId,input.recipient,input.purpose,input.dedupeKey,input.challengeId || null,input.security ? 1 : 0,input.message ? protect(input.message) : null, JSON.stringify(input.context || {}),sqlDate(input.expiresAt)]);
  const [[row]] = await conn.query<RowDataPacket[]>('SELECT id FROM email_deliveries WHERE dedupe_key=?',[input.dedupeKey]);
  if (row.id !== id) return row.id;
  await outbox.enqueue('email', { deliveryId: row.id }, conn, row.id);
  return row.id;
}
export function localClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: config().timezone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(now);
  const value = (key: string) => parts.find(p => p.type === key)!.value;
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}` };
}
export async function overdueLoans(userId: number, conn: Connection = db): Promise<{title:string;due:string;balance:string}[]> {
  if (conn===db) {
    const connection=await db.getConnection();
    try {await connection.beginTransaction();const loans=await overdueLoans(userId,connection);await connection.commit();return loans;}
    catch(error){await connection.rollback();throw error;}finally{connection.release();}
  }
  const [rows] = await conn.query<RowDataPacket[]>(`SELECT b.id,b.due_date,b.returned_at,b.fine_per_hour,b.fine_interval,b.initial_fine,bk.title FROM borrowings b JOIN books bk ON bk.id=b.book_id AND bk.deleted_at IS NULL
    WHERE b.user_id=? AND b.deleted_at IS NULL AND b.status IN ('borrowed','overdue') AND b.due_date < NOW() ORDER BY b.due_date,b.id FOR UPDATE`,[userId]);
  const ledger = require('../borrowing/fine-ledger.service');
  const settings = await require('../library-settings/library-settings.service').getSettings(conn);
  const assessedAt=new Date();
  for (const row of rows) await ledger.assessBorrowing({...row,fine_per_hour:row.fine_per_hour ?? settings.overdue_fine_per_hour,fine_interval:row.fine_interval || 'hour',initial_fine:row.initial_fine || 0},conn,assessedAt);
  const balances = await ledger.balancesForBorrowings(rows.map(r => Number(r.id)),conn);
  return rows.map(r => ({ title:String(r.title).slice(0,300), due: new Date(r.due_date).toISOString(), balance: Number(balances.get(Number(r.id))?.balance || 0).toFixed(2) }));
}
export async function queueDailySummaries() {
  if (!config().enabled || !config().routineEnabled) return;
  const clock = localClock();
  if (clock.time < config().time) return;
  const [users] = await db.query<RowDataPacket[]>(`SELECT DISTINCT u.id,u.email FROM users u JOIN borrowings b ON b.user_id=u.id
    WHERE u.is_active=1 AND u.deleted_at IS NULL AND u.setup_pending=0 AND u.email_verified_at IS NOT NULL
      AND b.deleted_at IS NULL AND b.status IN ('borrowed','overdue') AND b.due_date<NOW()`);
  for (const user of users) {
    const conn = await db.getConnection();
    try { await conn.beginTransaction(); await enqueue(conn, { userId:user.id,recipient:user.email,purpose:'overdue_summary',dedupeKey:`overdue:${user.id}:${clock.date}`,expiresAt:new Date(Date.now()+86400_000),context:{date:clock.date} }); await conn.commit(); }
    catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
  }
}
const personalTypes = new Set(['reservation_created','reservation_ready','reservation_cancelled','borrowing_created','borrowing_returned','borrowing_renewed','transaction_corrected','payment_settled']);
export async function queueNotification(payload: Record<string, unknown>, eventId: string, createdAt?: Date | string) {
  const purpose = String(payload.emailPurpose || payload.type);
  if (payload.suppressEmail || !config().enabled || !config().routineEnabled || payload.audienceType !== 'user' || !personalTypes.has(purpose)) return;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[user]] = await conn.query<RowDataPacket[]>('SELECT id,email,name FROM users WHERE id=? AND deleted_at IS NULL AND is_active=1 AND setup_pending=0 AND email_verified_at IS NOT NULL',[payload.audienceUserId]);
    if (user) await enqueue(conn,{ userId:user.id,recipient:user.email,purpose,dedupeKey:`notification:${eventId}`,expiresAt:new Date((createdAt ? new Date(createdAt).getTime() : Date.now())+86400_000),context:{ sourceType:payload.sourceType || null,sourceId:payload.sourceId || null, dueDate:payload.emailDueDate || null },message:{recipient:user.email,name:user.name,subject:String(payload.title),message:String(payload.body),action_url:new URL('/my-library',config().url).href,action_label:'Open My Library'} });
    await conn.commit();
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
}
async function eligible(row: Delivery, conn: Connection): Promise<EmailMessage | null> {
  const [[user]] = await conn.query<RowDataPacket[]>('SELECT id,email,pending_email,email_verified_at,name,is_active,deleted_at,setup_pending,role FROM users WHERE id=?',[row.user_id]);
  if (!user || !user.is_active || user.deleted_at) return null;
  const context = (typeof row.context_json === 'string' ? JSON.parse(row.context_json) : row.context_json) || {};
  if (row.challenge_id) {
    const [[challenge]] = await conn.query<RowDataPacket[]>('SELECT id,purpose,email FROM account_challenges WHERE id=? AND user_id=? AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP()',[row.challenge_id,row.user_id]);
    if (!challenge || challenge.email !== row.recipient || ![user.email,user.pending_email].filter(Boolean).map(value=>String(value).trim().toLowerCase()).includes(row.recipient)) return null;
    if (challenge.purpose === 'recovery' && (!user.email_verified_at || String(user.email).trim().toLowerCase() !== row.recipient || user.setup_pending)) return null;
  } else if (!context.oldVerifiedAddress && (!user.email_verified_at || user.setup_pending || String(user.email).trim().toLowerCase() !== row.recipient)) return null;
  if (row.purpose==='manual_notification') {
    if (!row.notification_id || !context.manualBatch) return null;
    const [[notice]]=await conn.query<RowDataPacket[]>(`SELECT * FROM notifications WHERE id=? AND email_batch_id=? AND email_requested=1
      AND is_active=1 AND (expires_at IS NULL OR expires_at>NOW()) AND email_expires_at>UTC_TIMESTAMP()`,[row.notification_id,context.manualBatch]);
    if (!notice || (notice.audience_type==='role' && notice.audience_role!==user.role) || (notice.audience_type==='user' && Number(notice.audience_user_id)!==Number(user.id))) return null;
    const destinations=['/my-library','/bulletin','/services/borrowing','/catalogue'];
    if (notice.href && !destinations.includes(notice.href)) throw new SendFailure('permanent','Invalid notification email destination');
    return {recipient:row.recipient,name:user.name,subject:notice.title,message:notice.body,
      ...(notice.href ? {action_url:new URL(notice.href,config().url).href,action_label:'Open library'} : {})};
  }
  if (!row.priority && context.sourceId) {
    if (context.sourceType === 'reservation') {
      const [[reservation]] = await conn.query<RowDataPacket[]>('SELECT status,expires_at,deleted_at FROM reservations WHERE id=? AND user_id=?',[context.sourceId,row.user_id]);
      if (!reservation || reservation.deleted_at || (row.purpose==='reservation_created' && reservation.status!=='pending') || (row.purpose==='reservation_cancelled' && reservation.status!=='cancelled') || (row.purpose === 'reservation_ready' && (reservation.status !== 'ready' || (reservation.expires_at && new Date(reservation.expires_at) <= new Date())))) return null;
    }
    if (context.sourceType === 'borrowing' && ['borrowing_created','borrowing_renewed','borrowing_returned'].includes(row.purpose)) {
      const [[loan]] = await conn.query<RowDataPacket[]>('SELECT status,deleted_at,due_date FROM borrowings WHERE id=? AND user_id=?',[context.sourceId,row.user_id]);
      if (!loan || loan.deleted_at || (row.purpose==='borrowing_returned' ? loan.status !== 'returned' : loan.status === 'returned')) return null;
      if (context.dueDate && new Date(loan.due_date).getTime() !== new Date(String(context.dueDate)).getTime()) return null;
    }
  }
  if (row.purpose === 'overdue_summary') {
    if (context.date !== localClock().date) return null;
    const loans = await overdueLoans(row.user_id,conn);
    if (!loans.length) return null;
    return { recipient:row.recipient,name:user.name,subject:'Your overdue library books',message:`You have ${loans.length} overdue book(s). Open My Library for the complete current balance.`,loans:loans.slice(0,30),as_of:new Date().toISOString(),action_url:new URL('/my-library',config().url).href,action_label:'Open My Library' };
  }
  if (!row.content_encrypted) return null;
  try { return unprotect<EmailMessage>(row.content_encrypted); }
  catch { throw new SendFailure('permanent','Stored email content cannot be read; request a fresh email'); }
}
async function finish(id: string, status: string, error: string | null = null, providerMessageId?:string | void) {
  await db.query("UPDATE email_deliveries SET status=?,last_error=?,content_encrypted=CASE WHEN priority=1 OR ?<>'failed' THEN NULL ELSE content_encrypted END,accepted_at=CASE WHEN ?='accepted' THEN UTC_TIMESTAMP() ELSE accepted_at END,context_json=CASE WHEN ?='accepted' THEN JSON_SET(COALESCE(context_json,JSON_OBJECT()),'$.providerMessageId',?,'$.providerMode',?) ELSE context_json END WHERE id=?",[status,error,status,status,status,providerMessageId || null,config().mode,id]);
}
/** Lock shared with restore: no network send may overlap application replacement. */
export async function dispatchOne(): Promise<boolean> {
  const c = config();
  if (!c.enabled) return false;
  const conn = await db.getConnection();
  let locked = false, claimed: Delivery | undefined;
  try {
    const [[lock]] = await conn.query<RowDataPacket[]>("SELECT GET_LOCK('euc-library-email-dispatch',0) AS acquired");
    if (!lock.acquired) return false;
    locked = true;
    const [[maintenance]] = await conn.query<RowDataPacket[]>('SELECT mode FROM system_maintenance_state WHERE id=1');
    if (maintenance?.mode === 'restoring') return false;
    await conn.query("UPDATE email_deliveries SET status='unknown',content_encrypted=NULL,last_error='Worker stopped before confirming provider result' WHERE status='processing'");
    await conn.query("UPDATE email_deliveries SET status='cancelled',content_encrypted=NULL,last_error='Expired' WHERE status IN ('queued','failed') AND expires_at<=UTC_TIMESTAMP()");
    await conn.beginTransaction();
    const [[state]] = await conn.query<RowDataPacket[]>('SELECT next_send_at>UTC_TIMESTAMP(3) AS waiting FROM email_dispatch_state WHERE id=1 FOR UPDATE');
    if (state.waiting) { await conn.commit(); return false; }
    const [rows] = await conn.query<Delivery[]>(`SELECT d.* FROM email_deliveries d WHERE d.status='queued' AND (d.priority=1 OR ?=1) AND d.next_attempt_at<=UTC_TIMESTAMP() AND d.expires_at>UTC_TIMESTAMP()
      AND EXISTS (SELECT 1 FROM delivery_outbox o WHERE BINARY o.id=BINARY d.id AND o.event_type='email' AND o.status='delivered')
      ORDER BY d.priority DESC,d.created_at,d.id LIMIT 1 FOR UPDATE`,[c.routineEnabled?1:0]);
    const row = rows[0];
    if (!row) { await conn.commit(); return false; }
    let message: EmailMessage | null;
    try {
      message = await eligible(row,conn);
      if (message) prepareEmailRequest(message,Boolean(row.priority));
    } catch (error) {
      if (!(error instanceof SendFailure)) throw error;
      await conn.query("UPDATE email_deliveries SET status='failed',content_encrypted=NULL,last_error=? WHERE id=?",[error.safeMessage,row.id]);
      await conn.commit();
      return true;
    }
    if (!message) { await conn.query("UPDATE email_deliveries SET status='cancelled',content_encrypted=NULL,last_error='No longer eligible' WHERE id=?",[row.id]); await conn.commit(); return true; }
    if (c.mode === 'brevo') {
      await conn.query('INSERT INTO email_quota_usage(period_start,period_end) VALUES (?,?) ON DUPLICATE KEY UPDATE period_start=period_start',[c.periodStart,c.periodEnd]);
      const [[quota]] = await conn.query<RowDataPacket[]>('SELECT requests_used FROM email_quota_usage WHERE period_start=? FOR UPDATE',[c.periodStart]);
      if (Number(quota.requests_used) >= (row.priority ? c.limit : c.limit-c.reserve)) {
        await conn.query("UPDATE email_deliveries SET next_attempt_at=?,last_error='Paused by daily email quota' WHERE id=?",[`${c.periodEnd} 00:00:00`,row.id]); await conn.commit(); return false;
      }
      await conn.query('UPDATE email_quota_usage SET requests_used=requests_used+1 WHERE period_start=?',[c.periodStart]);
    }
    await conn.query("UPDATE email_deliveries SET status='processing',attempts=attempts+1,started_at=UTC_TIMESTAMP(),last_error=NULL WHERE id=?",[row.id]);
    await conn.query('UPDATE email_dispatch_state SET next_send_at=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1100000 MICROSECOND) WHERE id=1');
    await conn.commit();
    claimed = row;
    try {
      const messageId=await provider.send(message,Boolean(row.priority));
      await finish(row.id,'accepted',null,messageId);
      // Provider references are safe to log; recipients, tokens and message bodies are not.
      if(messageId)console.info(`[email] Brevo accepted delivery ${row.id}; message ID: ${messageId}`);
    }
    catch (error) {
      if (error instanceof SendFailure && error.kind === 'retry' && row.attempts + 1 < 5) {
        const seconds = Math.ceil(Math.max(error.retryAfterSeconds,5*2**row.attempts));
        await db.query("UPDATE email_deliveries SET status='queued',next_attempt_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? SECOND),last_error=? WHERE id=?",[seconds,error.safeMessage,row.id]);
      } else await finish(row.id,error instanceof SendFailure && error.kind !== 'unknown' ? 'failed' : 'unknown',error instanceof SendFailure ? error.safeMessage : 'Unconfirmed send outcome');
    }
    return true;
  } catch (error) {
    await conn.rollback();
    if (claimed) await finish(claimed.id,'unknown','Dispatch interrupted').catch(()=>{});
    throw error;
  } finally { if (locked) await conn.query("SELECT RELEASE_LOCK('euc-library-email-dispatch')"); conn.release(); }
}
let busy = false;
let lastDigestCheck = 0;
/** Only identifiers are logged: provider payloads, SQL, addresses and secrets stay private. */
export function workerFailureCode(error:unknown):string {
  const code=(error as {code?:unknown}|null)?.code;
  return typeof code==='string' && /^(ER_[A-Z0-9_]+|E[A-Z0-9_]+)$/.test(code) ? code : 'INTERNAL_ERROR';
}
export function startEmailJob() {
  let failures=0,nextRun=0,lastLog=0,lastCode='';
  const run = async () => {
    if (busy || !config().enabled || Date.now()<nextRun) return;
    busy=true;
    try {
      if (Date.now()-lastDigestCheck>60_000) { await queueDailySummaries(); lastDigestCheck=Date.now(); }
      await dispatchOne();
      if(failures)console.info('[email] Worker recovered');
      failures=0;nextRun=0;lastCode='';
    } catch(error) {
      failures++;
      const delay=Math.min(60_000,5_000*2**Math.min(failures-1,4));
      nextRun=Date.now()+delay;
      const code=workerFailureCode(error);
      if(failures===1 || code!==lastCode || Date.now()-lastLog>=60_000){
        console.error(`[email] Worker failed (${code}); retrying in ${delay/1000}s. Check database configuration and delivery status.`);
        lastLog=Date.now();lastCode=code;
      }
    } finally { busy=false; }
  };
  const timer = setInterval(()=>void run(),1200); timer.unref(); void run(); return timer;
}
export async function adminStatus() {
  const c=config();
  const [usage] = await db.query<RowDataPacket[]>('SELECT * FROM email_quota_usage WHERE period_start=?',[c.periodStart || '1970-01-01']);
  const [rows] = await db.query<RowDataPacket[]>(`SELECT id,user_id,recipient,purpose,status,attempts,last_error,created_at,accepted_at,
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(context_json,'$.providerMessageId')),'null') AS provider_message_id,
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(context_json,'$.providerMode')),'null') AS provider_mode
    FROM email_deliveries ORDER BY created_at DESC LIMIT 100`);
  return { enabled:c.enabled,routineEnabled:c.routineEnabled,mode:c.mode,limit:c.limit,reserve:c.reserve,used:Number(usage[0]?.requests_used || 0),periodStart:c.periodStart,periodEnd:c.periodEnd,periodValid:true,rows };
}
export async function retryDelivery(id: string) {
  const conn=await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[row]]=await conn.query<Delivery[]>('SELECT * FROM email_deliveries WHERE id=? FOR UPDATE',[id]);
    if (!row || row.priority || row.status !== 'failed' || !await eligible(row,conn)) throw Object.assign(new Error('This message cannot be retried. Request a fresh account email or wait for the next summary.'),{status:409});
    await conn.query("UPDATE email_deliveries SET status='queued',attempts=0,next_attempt_at=UTC_TIMESTAMP(),last_error=NULL WHERE id=? AND expires_at>UTC_TIMESTAMP()",[id]);
    await conn.commit();
  } catch(error) { await conn.rollback();throw error; } finally {conn.release();}
}

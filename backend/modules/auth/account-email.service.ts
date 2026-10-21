import { randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt = require('bcryptjs');
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { normalizeEmail, requireEmail, secretHash, sqlDate, config } from '../email/email.config';
import * as email from '../email/email.service';
const db = require('../../db') as Pool;
const { enqueueTransactionalAudit } = require('../analytics/transactional-audit');
const generic = { message: 'If this account is eligible, an email will be queued. Check your inbox or contact the library.' };
const fail = () => Object.assign(new Error('This code or link is invalid or expired. Request a new email.'),{status:400});
export async function transaction<T>(fn: (conn:PoolConnection)=>Promise<T>):Promise<T> {
  const conn=await db.getConnection();
  try { await conn.beginTransaction();const result=await fn(conn);await conn.commit();return result; }
  catch(error){await conn.rollback();throw error;} finally{conn.release();}
}
export async function claimAddress(conn:PoolConnection,userId:number,address:string) {
  const normalized=normalizeEmail(address);
  const [[claim]]=await conn.query<RowDataPacket[]>('SELECT user_id FROM email_address_claims WHERE email=? FOR UPDATE',[normalized]);
  if (claim && Number(claim.user_id)!==Number(userId)) throw Object.assign(new Error('That email address is already in use'),{status:409});
  try { await conn.query('INSERT INTO email_address_claims(email,user_id) VALUES (?,?) ON DUPLICATE KEY UPDATE email=email',[normalized,userId]); }
  catch {throw Object.assign(new Error('That email address is already in use'),{status:409});}
  const [[owned]]=await conn.query<RowDataPacket[]>('SELECT user_id FROM email_address_claims WHERE email=?',[normalized]);
  if (Number(owned.user_id)!==Number(userId)) throw Object.assign(new Error('That email address is already in use'),{status:409});
}
async function throttle(conn:PoolConnection,key:string):Promise<boolean> {
  const requestKey=secretHash('request',key);
  await conn.query('INSERT IGNORE INTO email_request_limits(request_key,window_start,last_request_at,requests) VALUES (?,UTC_TIMESTAMP(),DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY),0)',[requestKey]);
  const [[row]]=await conn.query<RowDataPacket[]>('SELECT requests,TIMESTAMPDIFF(SECOND,window_start,UTC_TIMESTAMP()) AS elapsed,TIMESTAMPDIFF(SECOND,last_request_at,UTC_TIMESTAMP()) AS since FROM email_request_limits WHERE request_key=? FOR UPDATE',[requestKey]);
  if (Number(row.since)<60 || (Number(row.elapsed)<3600 && Number(row.requests)>=5)) return false;
  await conn.query('UPDATE email_request_limits SET requests=IF(TIMESTAMPDIFF(SECOND,window_start,UTC_TIMESTAMP())>=3600,1,requests+1),window_start=IF(TIMESTAMPDIFF(SECOND,window_start,UTC_TIMESTAMP())>=3600,UTC_TIMESTAMP(),window_start),last_request_at=UTC_TIMESTAMP() WHERE request_key=?',[requestKey]);
  return true;
}
export async function invalidateChallenges(conn:PoolConnection,userId:number,purposes:string[]=['setup','verify_email','recovery','reset']) {
  const placeholders=purposes.map(()=>'?').join(',');
  await conn.query(`UPDATE account_challenges SET consumed_at=UTC_TIMESTAMP() WHERE user_id=? AND consumed_at IS NULL AND purpose IN (${placeholders})`,[userId,...purposes]);
  await conn.query("UPDATE email_deliveries d JOIN account_challenges c ON c.id=d.challenge_id SET d.status='cancelled',d.content_encrypted=NULL,d.last_error='Challenge replaced or consumed' WHERE c.user_id=? AND c.consumed_at IS NOT NULL AND d.status='queued'",[userId]);
}
async function challenge(conn:PoolConnection,user:RowDataPacket,purpose:'setup'|'verify_email'|'recovery',address:string) {
  await invalidateChallenges(conn,user.id,purpose==='recovery'?['recovery','reset']:[purpose]);
  const id=randomUUID(),secret=purpose==='recovery'?String(randomInt(0,1_000_000)).padStart(6,'0'):randomBytes(32).toString('base64url');
  const expiresAt=new Date(Date.now()+(purpose==='recovery'?600_000:86400_000));
  await conn.query('INSERT INTO account_challenges(id,user_id,purpose,email,secret_hash,expires_at) VALUES (?,?,?,?,?,?)',[id,user.id,purpose,address,secretHash(purpose,`${id}:${secret}`),sqlDate(expiresAt)]);
  const route=purpose==='setup'?'/set-password':'/verify-email';
  const link=new URL(route,config().url);link.hash=new URLSearchParams({id,token:secret}).toString();
  await email.enqueue(conn,{userId:user.id,recipient:address,purpose,dedupeKey:`challenge:${id}`,challengeId:id,security:true,expiresAt,
    message:{recipient:address,name:user.name,subject:purpose==='setup'?'Set up your library account':purpose==='recovery'?'Your library password recovery code':'Verify your library email',
      message:purpose==='setup'?'Choose your own password to activate library access. This link expires in 24 hours.':purpose==='recovery'?'Use this code to reset your library password. It expires in 10 minutes.':'Confirm this email address. This link expires in 24 hours.',
      ...(purpose==='recovery'?{code:secret}:{action_url:link.href,action_label:purpose==='setup'?'Set your password':'Verify email'}),login_identifier:String(user.student_employee_id)}});
  return id;
}
export async function invite(conn:PoolConnection,user:RowDataPacket) {
  requireEmail();
  await claimAddress(conn,user.id,user.email);
  await conn.query('UPDATE users SET setup_pending=1 WHERE id=?',[user.id]);
  await challenge(conn,user,'setup',normalizeEmail(user.email));
}
export async function stageAddress(conn:PoolConnection,user:RowDataPacket,value:unknown) {
  requireEmail();
  if (!value && user.email) throw Object.assign(new Error('An existing email address cannot be cleared'),{status:400});
  const address=normalizeEmail(value);
  if (address===String(user.email || '').trim().toLowerCase()) return;
  await claimAddress(conn,user.id,address);
  await conn.query('UPDATE users SET pending_email=? WHERE id=?',[address,user.id]);
  await conn.query('DELETE FROM email_address_claims WHERE user_id=? AND email NOT IN (?,?)',[user.id,address,String(user.email || '').trim().toLowerCase()]);
  await invalidateChallenges(conn,user.id,['verify_email']);
  if (user.setup_pending) {
    // The invitation must remain addressed to the current account email; correcting it replaces that invitation.
    await conn.query('UPDATE users SET email=?,pending_email=NULL,email_verified_at=NULL WHERE id=?',[address,user.id]);
    await conn.query('DELETE FROM email_address_claims WHERE user_id=? AND email<>?',[user.id,address]);
    await challenge(conn,{...user,email:address},'setup',address);
  } else await challenge(conn,user,'verify_email',address);
}
export async function requestRecovery(value:unknown,ip:string) {
  requireEmail();
  let address:string;try{address=normalizeEmail(value);}catch{return generic;}
  await transaction(async conn=>{
    if (!await throttle(conn,`recovery-ip:${ip}`) || !await throttle(conn,`recovery-email:${address}`)) return;
    const [[user]]=await conn.query<RowDataPacket[]>('SELECT * FROM users WHERE LOWER(TRIM(email))=? AND deleted_at IS NULL FOR UPDATE',[address]);
    if (!user || !user.is_active || !user.email_verified_at || user.setup_pending) return;
    await challenge(conn,user,'recovery',address);
  });
  return generic;
}
export async function verifyRecovery(value:unknown,code:unknown) {
  requireEmail();
  let address:string;try{address=normalizeEmail(value);}catch{throw fail();}
  const result=await transaction(async conn=>{
    // Serialize all challenge transitions on the account before locking challenge rows.
    const [[user]]=await conn.query<RowDataPacket[]>('SELECT * FROM users WHERE LOWER(TRIM(email))=? AND deleted_at IS NULL FOR UPDATE',[address]);
    if (!user || !user.is_active || !user.email_verified_at || user.setup_pending) return null;
    const [[row]]=await conn.query<RowDataPacket[]>("SELECT * FROM account_challenges WHERE user_id=? AND purpose='recovery' AND email=? AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP() ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[user.id,address]);
    if (!row || row.attempts>=5) return null;
    const hash=secretHash('recovery',`${row.id}:${String(code)}`);
    await conn.query('UPDATE account_challenges SET attempts=attempts+1 WHERE id=?',[row.id]);
    if (!/^\d{6}$/.test(String(code)) || !timingSafeEqual(Buffer.from(hash),Buffer.from(row.secret_hash))) return null;
    await invalidateChallenges(conn,user.id,['recovery','reset']);
    const id=randomUUID(),token=randomBytes(32).toString('base64url');
    await conn.query("INSERT INTO account_challenges(id,user_id,purpose,email,secret_hash,expires_at) VALUES (?,?,'reset',?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))",[id,user.id,address,secretHash('reset',`${id}:${token}`)]);
    return {id,token};
  });
  if (!result) throw fail();return result;
}
export function validatePassword(value:unknown) {
  if(typeof value!=='string' || value.length<8 || Buffer.byteLength(value)>72) throw Object.assign(new Error('Use a password of at least 8 characters and no more than 72 UTF-8 bytes'),{status:400});
  return value;
}
export async function securityNotice(conn:PoolConnection,user:RowDataPacket,purpose:string,message:string,address=user.email,oldVerifiedAddress=false) {
  if (!config().enabled || !address || (!oldVerifiedAddress && !user.email_verified_at)) return;
  await email.enqueue(conn,{userId:user.id,recipient:address,purpose,dedupeKey:`${purpose}:${randomUUID()}`,security:true,expiresAt:new Date(Date.now()+86400_000),context:{oldVerifiedAddress},message:{recipient:address,name:user.name,subject:'Library account security update',message}});
}
export async function complete(purpose:'setup'|'verify_email'|'reset',id:unknown,token:unknown,password?:unknown) {
  requireEmail();
  if(typeof id!=='string' || id.length!==36 || typeof token!=='string' || token.length>128) throw fail();
  const passwordHash=purpose==='verify_email'?null:await bcrypt.hash(validatePassword(password),12);
  let completedUserId: number | undefined;
  const result = await transaction(async conn=>{
    const [[owner]]=await conn.query<RowDataPacket[]>('SELECT user_id FROM account_challenges WHERE id=?',[id]);
    if (!owner) throw fail();
    const [[user]]=await conn.query<RowDataPacket[]>('SELECT * FROM users WHERE id=? AND deleted_at IS NULL FOR UPDATE',[owner.user_id]);
    const [[row]]=await conn.query<RowDataPacket[]>('SELECT * FROM account_challenges WHERE id=? AND purpose=? AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE',[id,purpose]);
    if (!user || !user.is_active || !row || secretHash(purpose,`${id}:${token}`)!==row.secret_hash) throw fail();
    completedUserId=Number(user.id);
    if (purpose==='setup' && (!user.setup_pending || normalizeEmail(user.email)!==row.email)) throw fail();
    if (purpose==='reset' && (user.setup_pending || !user.email_verified_at || normalizeEmail(user.email)!==row.email)) throw fail();
    if (purpose==='verify_email') {
      if (![user.email,user.pending_email].filter(Boolean).map(normalizeEmail).includes(row.email)) throw fail();
      await claimAddress(conn,user.id,row.email);
      if (user.email_verified_at && normalizeEmail(user.email)!==row.email) await securityNotice(conn,user,'email_changed','Your library account email address was changed. Contact the library if you did not request this.',user.email,true);
      await conn.query('UPDATE users SET email=?,pending_email=NULL,email_verified_at=UTC_TIMESTAMP() WHERE id=?',[row.email,user.id]);
      await conn.query('DELETE FROM email_address_claims WHERE user_id=? AND email<>?',[user.id,row.email]);
    } else {
      if (purpose==='reset' && await bcrypt.compare(String(password),user.password_hash)) throw Object.assign(new Error('Choose a password different from your current password'),{status:400});
      await conn.query('UPDATE users SET password_hash=?,setup_pending=0,must_change_password=0,email_verified_at=COALESCE(email_verified_at,UTC_TIMESTAMP()),session_version=session_version+1 WHERE id=?',[passwordHash,user.id]);
      await conn.query('UPDATE auth_refresh_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL',[user.id]);
      await securityNotice(conn,{...user,email_verified_at:new Date()},'password_changed','Your library password was changed. Contact the library if you did not request this.');
    }
    await invalidateChallenges(conn,user.id);
    await enqueueTransactionalAudit(conn,{actorId:user.id,category:'auth',action:purpose==='verify_email'?'email_verified':'password_changed',description:purpose==='verify_email'?'Verified library account email':'Completed library password setup or recovery',route:'/api/auth/account-email',extraMetadata:{}});
    return {message:purpose==='verify_email'?'Email verified.':'Password saved. Sign in with your new password.'};
  });
  if (purpose !== 'verify_email' && completedUserId) require('../../realtime/notificationHub').closeUserConnections(completedUserId);
  return result;
}
export async function requestVerification(userId:number) {
  requireEmail();
  return transaction(async conn=>{
    const [[user]]=await conn.query<RowDataPacket[]>('SELECT * FROM users WHERE id=? AND deleted_at IS NULL AND is_active=1 FOR UPDATE',[userId]);
    if (!user) throw fail();
    const address=user.pending_email || user.email;
    if (!address) throw Object.assign(new Error('Ask library staff to add your email address first.'),{status:400});
    if (await throttle(conn,`verification:${userId}`)) await challenge(conn,user,'verify_email',normalizeEmail(address));
    return generic;
  });
}
export async function accountStatus(userId:number) {
  const [[user]]=await db.query<RowDataPacket[]>('SELECT email,pending_email,email_verified_at,setup_pending,student_employee_id FROM users WHERE id=?',[userId]);
  return { ...user,emailEnabled:config().enabled };
}
export async function changeEmail(userId:number,value:unknown) {
  return transaction(async conn=>{const [[user]]=await conn.query<RowDataPacket[]>('SELECT * FROM users WHERE id=? AND deleted_at IS NULL AND is_active=1 FOR UPDATE',[userId]);if(!user)throw fail();if(!await throttle(conn,`verification:${userId}`))throw Object.assign(new Error('Wait before requesting another email change.'),{status:429});await stageAddress(conn,user,value);await enqueueTransactionalAudit(conn,{actorId:user.id,category:'auth',action:'email_change_requested',description:'Requested email address verification',route:'/api/auth/email-change',before:{email:user.email},after:{pending_email:normalizeEmail(value)}});return generic;});
}
export async function adminAction(identifier:string,actorId:number,actorRole:string,action:'invite'|'recovery'|'verify') {
  requireEmail();
  return transaction(async conn=>{
    const [[user]]=await conn.query<RowDataPacket[]>('SELECT * FROM users WHERE student_employee_id=? AND deleted_at IS NULL AND is_active=1 FOR UPDATE',[identifier]);
    const roles:Record<string,string[]>={super_admin:['admin','staff','scanner','employee','alumni','student'],admin:['staff','scanner','employee','alumni','student'],staff:['scanner','employee','alumni','student']};
    if(!user || !roles[actorRole]?.includes(user.role))throw Object.assign(new Error('You cannot manage this account'),{status:403});
    if(!await throttle(conn,`admin-${action}:${user.id}`))throw Object.assign(new Error('Wait before requesting another email.'),{status:429});
    if(action==='invite'){if(!user.setup_pending)throw Object.assign(new Error('Account setup is already complete'),{status:409});await challenge(conn,user,'setup',normalizeEmail(user.email));}
    if(action==='verify'){const address=user.pending_email||user.email;if(!address)throw Object.assign(new Error('Add an email address first'),{status:400});await challenge(conn,user,'verify_email',normalizeEmail(address));}
    if(action==='recovery'){if(!user.email_verified_at || user.setup_pending)throw Object.assign(new Error('Verify email and complete setup before recovery'),{status:409});if(await throttle(conn,`recovery-email:${normalizeEmail(user.email)}`))await challenge(conn,user,'recovery',normalizeEmail(user.email));}
    await enqueueTransactionalAudit(conn,{actorId,category:'users',action:'email_requested',description:`Requested account ${action} email`,route:'/api/admin/users/account-email',extraMetadata:{target_user_id:user.id}});
    return {message:'Account email queued if eligible.'};
  });
}

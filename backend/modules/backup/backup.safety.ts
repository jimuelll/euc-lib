import bcrypt = require('bcryptjs');
import {createHash} from 'node:crypto';
import type {SnapshotPayload} from './snapshot.types';
const db=require('../../db');
const transforms=require('./snapshot.transforms');
export async function requireRestoreCredentials(req:any){
 if(req.get('x-restore-confirmation')!=='global-sign-out'||req.get('x-restore-word')!=='RESTORE')throw Object.assign(new Error('Type RESTORE to acknowledge that all users will be signed out.'),{status:400});
 const password=req.get('x-restore-password');
 if(typeof password!=='string'||!password||password.length>256)throw Object.assign(new Error('Re-enter your current password.'),{status:400});
 const [[user]]=await db.query('SELECT password_hash,is_active,role FROM users WHERE id=?',[req.user.id]);
 if(!user||!user.is_active||user.role!=='super_admin'||!await bcrypt.compare(password,user.password_hash))throw Object.assign(new Error('The current password could not be verified.'),{status:403});
}
const digest=(row:any)=>createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))))).digest('hex');
export function compareRecords(before:SnapshotPayload,current:SnapshotPayload,restoredTables?:SnapshotPayload['tables']){
 const prepared=transforms.upgradeBackup(JSON.parse(JSON.stringify(before)));
 if(restoredTables)prepared.tables=restoredTables;
 const excluded=new Set(['accession_claims','accession_claim_corrections','accession_claim_voids','auth_refresh_sessions','delivery_outbox']);
 const tables=['users','borrowings','clearance_transactions','reservations','books','fine_ledger_entries',...require('./snapshot.registry').APPLICATION_TABLES];
 return [...new Set<string>(tables)].filter(table=>!excluded.has(table)&&(prepared.tables[table]||current.tables[table])).map(table=>{
  const keys:Record<string,string>={book_embeddings:'book_id',book_enrichment:'book_id',copy_holdings:'copy_id',fine_accounts:'borrowing_id',website_content_drafts:'section'};
  const identity=(row:any)=>{const value=row[keys[table]||'id'];if(value===undefined)throw Object.assign(new Error(`Impact cannot be calculated: a ${table} record has no identity.`),{status:409});return String(value);};
  const old=new Map((prepared.tables[table]||[]).map((row:any)=>[identity(row),digest(row)])),live=current.tables[table]||[];let added=0,changed=0;
  for(const row of live){const key=identity(row);if(!old.has(key))added++;else if(old.get(key)!==digest(row))changed++;old.delete(key);}
  return {table,added,changed,restored:old.size};
 });
}
export async function activeSessions(){
 const [rows]=await db.query("SELECT u.role,COUNT(DISTINCT s.user_id) AS users,COUNT(*) AS sessions FROM auth_refresh_sessions s JOIN users u ON u.id=s.user_id WHERE s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP() GROUP BY u.role");
 return {users:rows.reduce((n:number,r:any)=>n+Number(r.users),0),staff:rows.filter((r:any)=>['staff','admin','super_admin'].includes(r.role)).reduce((n:number,r:any)=>n+Number(r.users),0),patrons:rows.filter((r:any)=>!['staff','admin','super_admin'].includes(r.role)).reduce((n:number,r:any)=>n+Number(r.users),0),sessions:rows.reduce((n:number,r:any)=>n+Number(r.sessions),0)};
}
let progress:{phase:string;startedAt:string;source?:string;result?:any}|null=null;
export function setProgress(phase:string,source?:string,result?:any){progress={phase,source:source||progress?.source,startedAt:phase==='verifying'?new Date().toISOString():progress?.startedAt||new Date().toISOString(),...(result?{result}:{})};}
export function getProgress(){return progress;}

import type { Pool, RowDataPacket } from 'mysql2/promise';
import { config } from './email.config';
const db = require('../../db') as Pool;

export const deliveryStatuses = ['queued','processing','accepted','failed','unknown','cancelled'] as const;
type Filters = { category: 'all'|'account'|'manual'|'automated'; q: string; status: string; purpose: string; from: string; to: string; sort: 'newest'|'oldest'; page: number; limit: number; legacy: boolean };
const invalid = () => Object.assign(new Error('Invalid email delivery filters.'), {status:400});
export function deliveryFilters(query: Record<string, unknown> = {}): Filters {
  const read = (key: string, fallback = '') => { const value=query[key]; if(value===undefined)return fallback; if(typeof value!=='string')throw invalid(); return value.trim(); };
  const category=read('category','all'),status=read('status','all'),sort=read('sort','newest');
  const q=read('q'),purpose=read('purpose','all'),from=read('from'),to=read('to');
  const legacy=Object.keys(query).length===0;
  const pageText=read('page','1'),limitText=read('limit',legacy?'100':'25');
  const page=Number(pageText),limit=Number(limitText);
  if(!['all','account','manual','automated'].includes(category) || !['all',...deliveryStatuses].includes(status) || !['newest','oldest'].includes(sort) || q.length>255 || !/^[a-z_]{1,50}$/.test(purpose) || !/^\d+$/.test(pageText) || !/^\d+$/.test(limitText) || !Number.isSafeInteger(page) || page<1 || ![25,50,100].includes(limit))throw invalid();
  for(const date of [from,to])if(date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date))throw invalid();
  if(from && to && from>to)throw invalid();
  return {category:category as Filters['category'],status,sort:sort as Filters['sort'],q,purpose,from,to,page,limit,legacy};
}
export function deliveryWhere(filters: Filters, includeStatus=true, categoryOnly=false) {
  const clauses:string[]=[],values:unknown[]=[];
  if(filters.category==='account')clauses.push('priority=1');
  if(filters.category==='manual')clauses.push("priority=0 AND purpose='manual_notification'");
  if(filters.category==='automated')clauses.push("priority=0 AND purpose<>'manual_notification'");
  if(!categoryOnly) {
    if(filters.q){clauses.push("(recipient LIKE ? ESCAPE '!' OR id LIKE ? ESCAPE '!' OR JSON_UNQUOTE(JSON_EXTRACT(context_json,'$.providerMessageId')) LIKE ? ESCAPE '!')");const term=`%${filters.q.replace(/[!%_]/g,'!$&')}%`;values.push(term,term,term);}
    if(filters.purpose!=='all'){clauses.push('purpose=?');values.push(filters.purpose);}
    if(filters.from){clauses.push('created_at>=?');values.push(`${filters.from} 00:00:00`);}
    if(filters.to){clauses.push('created_at<DATE_ADD(?,INTERVAL 1 DAY)');values.push(`${filters.to} 00:00:00`);}
    if(includeStatus && filters.status!=='all'){clauses.push('status=?');values.push(filters.status);}
  }
  return {sql:clauses.length?` WHERE ${clauses.map(clause=>`(${clause})`).join(' AND ')}`:'',values};
}
const fields=`id,user_id,recipient,purpose,priority,status,attempts,last_error,notification_id,
  DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') AS created_at,
  DATE_FORMAT(started_at,'%Y-%m-%dT%H:%i:%sZ') AS started_at,
  DATE_FORMAT(accepted_at,'%Y-%m-%dT%H:%i:%sZ') AS accepted_at,
  DATE_FORMAT(next_attempt_at,'%Y-%m-%dT%H:%i:%sZ') AS next_attempt_at,
  DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%sZ') AS expires_at,
  (priority=0 AND status='failed' AND expires_at>UTC_TIMESTAMP()) AS retry_available,
  NULLIF(JSON_UNQUOTE(JSON_EXTRACT(context_json,'$.providerMessageId')),'null') AS provider_message_id,
  NULLIF(JSON_UNQUOTE(JSON_EXTRACT(context_json,'$.providerMode')),'null') AS provider_mode`;
export async function adminDelivery(id: string) {
  if(!/^[a-f0-9-]{36}$/i.test(id))throw Object.assign(new Error('Email delivery not found.'),{status:404});
  const [[row]]=await db.query<RowDataPacket[]>(`SELECT ${fields} FROM email_deliveries WHERE id=?`,[id]);
  if(!row)throw Object.assign(new Error('Email delivery not found.'),{status:404});
  return row;
}
export async function adminStatus(query: Record<string,unknown> = {}) {
  const filters=deliveryFilters(query),where=deliveryWhere(filters),countWhere=deliveryWhere(filters,false),purposeWhere=deliveryWhere(filters,true,true),c=config();
  const [usage]=await db.query<RowDataPacket[]>('SELECT requests_used FROM email_quota_usage WHERE period_start=?',[c.periodStart]);
  const [counts]=await db.query<RowDataPacket[]>(`SELECT status,COUNT(*) AS total FROM email_deliveries${countWhere.sql} GROUP BY status`,countWhere.values);
  const totals=Object.fromEntries(deliveryStatuses.map(status=>[status,0]));
  for(const row of counts)totals[String(row.status)]=Number(row.total);
  const total=filters.status==='all'?Object.values(totals).reduce((sum,value)=>sum+value,0):totals[filters.status];
  const totalPages=Math.max(1,Math.ceil(total/filters.limit)),page=Math.min(filters.page,totalPages);
  const direction=filters.sort==='oldest'?'ASC':'DESC';
  const [rows]=await db.query<RowDataPacket[]>(`SELECT ${fields} FROM email_deliveries${where.sql} ORDER BY email_deliveries.created_at ${direction},id ${direction} LIMIT ? OFFSET ?`,[...where.values,filters.limit,(page-1)*filters.limit]);
  const [purposes]=await db.query<RowDataPacket[]>(`SELECT DISTINCT purpose FROM email_deliveries${purposeWhere.sql} ORDER BY purpose`,purposeWhere.values);
  const [[queue]]=await db.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM email_deliveries WHERE priority=0 AND status='queued' AND expires_at>UTC_TIMESTAMP()");
  const used=Number(usage[0]?.requests_used || 0),routineRemaining=Math.max(0,c.limit-c.reserve-used),queuedRoutine=Number(queue.total);
  return {enabled:c.enabled,routineEnabled:c.routineEnabled,mode:c.mode,limit:c.limit,reserve:c.reserve,used,periodStart:c.periodStart,periodEnd:c.periodEnd,periodValid:true,
    routineRemaining,queuedRoutine,routineAfterQueue:Math.max(0,routineRemaining-queuedRoutine),rows,statusTotals:totals,purposes:purposes.map(row=>row.purpose),pagination:{page,limit:filters.limit,total,totalPages}};
}

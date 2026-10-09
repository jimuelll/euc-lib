const db=require('../../db');
const {filters,safeRow,highImpactSql,categorySql,quickSql}=require('./audit.feed.helpers');
const {enrichAuditLookupRows}=require('./audit.lookup-labels');
const {enrichCopyAuditRows}=require('./audit.copy-label');
export async function getFeed(input:any={}){
 const limit=Math.min(50,Math.max(1,Math.floor(Number(input.limit)||20))),page=Math.max(1,Math.floor(Number(input.page)||1)),where=filters(input);
 const [[counts]]=await db.query(`SELECT COUNT(*) AS total,MAX(id) AS latestId FROM audit_events ${where.sql}`,where.params);
 const [[all]]=await db.query('SELECT COUNT(*) AS total FROM audit_events WHERE occurred_at IS NOT NULL');
 const base=filters({...input,quick:undefined});
 const [[facets]]=await db.query(`SELECT ${Object.entries(quickSql).map(([key,sql])=>`COALESCE(SUM(${sql}),0) AS ${key}`).join(',')}, COALESCE(SUM(actor_id=?),0) AS mine FROM audit_events ${base.sql}`,[Number(input.currentActorId)||0,...base.params]);
 const quickCounts=Object.fromEntries([...Object.keys(quickSql),'mine'].map(key=>[key,Number(facets?.[key]||0)]));
 let [rows]=await db.query(`SELECT id,actor_id,occurred_at,category,action,actor_name,actor_role,description,metadata,route,restore_status,reversed_at,${highImpactSql} AS significant FROM audit_events ${where.sql} ORDER BY occurred_at DESC,id DESC LIMIT ? OFFSET ?`,[...where.params,limit,(page-1)*limit]);
 const routes=new Map(rows.map((row:any)=>[row.id,row.route]));
 try{rows=await enrichAuditLookupRows(rows,db.query.bind(db));rows=await enrichCopyAuditRows(rows,db.query.bind(db));}catch{/* Captured values still remain visible. */}
 // Legacy display enrichment intentionally omits routes. This investigative
 // feed needs the captured route for exact filters, references and context.
 rows=rows.map((row:any)=>({...row,route:routes.get(row.id)}));
 rows=rows.map(safeRow);await targets(rows);
 const failures=rows.filter((row:any)=>row.category==='auth'&&/failed|denied/i.test(row.action)&&row.actor_id);
 if(failures.length){const [repeats]=await db.query("SELECT actor_id,DATE(occurred_at) AS day,COUNT(*) AS failures FROM audit_events WHERE category='auth' AND action REGEXP 'failed|denied' AND actor_id IN (?) GROUP BY actor_id,DATE(occurred_at) HAVING COUNT(*)>=3",[[...new Set(failures.map((row:any)=>row.actor_id))]]);for(const row of failures){const day=String(row.occurred_at instanceof Date?row.occurred_at.toISOString():row.occurred_at).slice(0,10),match=repeats.find((repeat:any)=>Number(repeat.actor_id)===Number(row.actor_id)&&String(repeat.day instanceof Date?repeat.day.toISOString():repeat.day).slice(0,10)===day);if(match)row.recorded_failures_today=Number(match.failures);}}
 for(const row of rows){
  // A contradictory historical summary must never acquire an unrelated link.
  if(row.target?.kind==='Book type policy'&&/patron account/i.test(row.description||''))row.target={kind:'Patron',label:'Patron reference not reliably recorded',unavailable:true};
 }
 for(const row of rows){row.related_ids=rows.filter((other:any)=>other.id!==row.id&&other.route&&other.route===row.route&&other.actor_id===row.actor_id&&other.action===row.action&&Math.abs(new Date(other.occurred_at).getTime()-new Date(row.occurred_at).getTime())<2000).map((other:any)=>other.id);}
 return {rows,quickCounts,pagination:{page,limit,total:Number(counts.total),totalPages:Math.max(1,Math.ceil(counts.total/limit))},unfilteredTotal:Number(all.total),latestId:Number(counts.latestId||0),updatedAt:new Date().toISOString(),filters:input};
}
export async function getMeta(){
 const [actions]=await db.query(`SELECT DISTINCT ${categorySql} AS category,action FROM audit_events WHERE occurred_at IS NOT NULL ORDER BY category,action`);
 const [actors]=await db.query('SELECT actor_id AS id,MAX(actor_name) AS name FROM audit_events WHERE actor_id IS NOT NULL GROUP BY actor_id ORDER BY name');
 const actionsByCategory:any={};for(const row of actions)(actionsByCategory[row.category]??=[]).push(row.action);
 return {categories:[...new Set(actions.map((r:any)=>r.category))],actions:[...new Set(actions.map((r:any)=>r.action))],actionsByCategory,actors,guarantees:{retention:'No automatic audit expiry is configured. A formal retention period has not been set.',readOnly:'This application provides no edit or delete action for audit events. Database administrators retain database access.',coverage:'Successful changes and recorded sign-ins/sign-outs are captured. General read-only views, failed sign-ins and permission denials are not guaranteed to be logged. Exports from this page are recorded.'}};
}
async function targets(rows:any[]){
 const patrons=rows.filter(r=>/\/users\/([^/]+)/.test(r.route||''));if(patrons.length){const refs=patrons.map(r=>decodeURIComponent(r.route.match(/\/users\/([^/]+)/)[1]));try{const [users]=await db.query('SELECT id,name,student_employee_id,deleted_at FROM users WHERE student_employee_id IN (?) OR id IN (?)',[refs,patrons.map(r=>r.metadata?.target_id||0)]);for(const row of patrons){const ref=decodeURIComponent(row.route.match(/\/users\/([^/]+)/)[1]),user=users.find((u:any)=>u.student_employee_id===ref||Number(u.id)===Number(row.metadata?.target_id));row.target={kind:'Patron',id:user?.id,label:user?.name||(ref===':user'&&!row.metadata?.target_id?'Patron reference not recorded':'Patron record'),deleted:!user&&(ref!==':user'||Boolean(row.metadata?.target_id)),url:user?'/admin/users?status=all&q='+encodeURIComponent(user.student_employee_id)+'&patron='+encodeURIComponent(user.student_employee_id)+(user.deleted_at?'&archived=true':''):null};}}catch{for(const row of patrons)row.target={kind:'Patron',label:'Record link unavailable',unavailable:true};}}

 const definitions=[{pattern:/\/book-types\/(\d+)/,table:'book_types',label:'name',kind:'Book type policy',url:(r:any)=>`/admin/book-types?policyId=${r.id}`},{pattern:/\/books\/(\d+)/,table:'books',label:'title',kind:'Book',url:(r:any)=>`/admin/catalog?tab=records&bookId=${r.id}&record=${r.id}&status=all`},{pattern:/\/reservations\/(\d+)/,table:'reservations',label:'id',extra:',deleted_at',kind:'Reservation',url:(r:any)=>`/admin/reservations?recordId=${r.id}&filter=all${r.deleted_at?'&archived=true':''}`}];
 for(const d of definitions){const matched=rows.filter(r=>d.pattern.test(r.route||''));if(!matched.length)continue;const ids=[...new Set(matched.map(r=>Number(r.route.match(d.pattern)[1])))];try{const [records]=await db.query(`SELECT id,${d.label} AS label${d.extra||''} FROM ${d.table} WHERE id IN (?)`,[ids]);for(const row of matched){const id=Number(row.route.match(d.pattern)[1]),record=records.find((r:any)=>Number(r.id)===id);row.target={id,kind:d.kind,label:record?.label||`${d.kind} #${id}`,deleted:!record,url:record?d.url(record):null};}}catch{for(const row of matched)row.target={kind:d.kind,label:'Record link unavailable',unavailable:true};}}
}

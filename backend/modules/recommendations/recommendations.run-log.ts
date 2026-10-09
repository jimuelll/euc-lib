const db=require('../../db');
const audit=require('../analytics/analytics.audit.service');
export async function recordRun(run:any,actorId:number|null){
 if(!actorId)return;
 await audit.recordAuditEvent({actorId,category:'recommendations',action:run.status==='running'?'started':'completed',description:`AI backfill ${run.runId}: ${run.status} · ${run.completed} of ${run.total} processed`,route:'/api/admin/recommendations/embeddings/backfill',metadata:{runSummary:run,affected_record_count:run.total,affected_record_type:'books'}});
}
export async function latestRun(){
 const [rows]=await db.query("SELECT id,actor_name,metadata FROM audit_events WHERE category='recommendations' AND JSON_EXTRACT(metadata,'$.runSummary') IS NOT NULL ORDER BY occurred_at DESC,id DESC LIMIT 1");
 if(!rows.length)return null;
 const metadata=typeof rows[0].metadata==='string'?JSON.parse(rows[0].metadata):rows[0].metadata;
 return {...metadata.runSummary,actorName:rows[0].actor_name||'Actor not recorded',auditEventId:rows[0].id};
}
export async function staffName(id:number){const [[staff]]=await db.query('SELECT name FROM users WHERE id=? LIMIT 1',[id]);return staff?.name||`Staff #${id}`;}

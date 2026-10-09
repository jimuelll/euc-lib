const db=require('../../db'),audit=require('../analytics/analytics.audit.service');
export function nextRun(config:{frequency:string;hour:number;weekday:number},now=Date.now()){
 const local=new Date(now+8*3600000),candidate=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate(),config.hour));
 if(config.frequency==='weekly')candidate.setUTCDate(candidate.getUTCDate()+(config.weekday-candidate.getUTCDay()+7)%7);
 let run=candidate.getTime()-8*3600000;if(run<=now)run+=(config.frequency==='weekly'?7:1)*86400000;return new Date(run);
}
export async function read(){const [[row]]=await db.query("SELECT *,DATE_FORMAT(next_run,'%Y-%m-%dT%H:%i:%sZ') AS nextRunIso,DATE_FORMAT(last_run,'%Y-%m-%dT%H:%i:%sZ') AS lastRunIso FROM backup_schedule WHERE id=1");return {enabled:Boolean(row?.enabled),frequency:row?.frequency||'daily',hour:Number(row?.hour??2),weekday:Number(row?.weekday??1),nextRun:row?.nextRunIso||null,lastRun:row?.lastRunIso||null,lastResult:row?.last_result||null,lastError:row?.last_error||null};}
export async function update(req:any,res:any){let conn:any;try{
 const {enabled,frequency,hour,weekday}=req.body;if(typeof enabled!=='boolean'||!['daily','weekly'].includes(frequency)||!Number.isInteger(hour)||hour<0||hour>23||!Number.isInteger(weekday)||weekday<0||weekday>6)throw Object.assign(new Error('Choose Daily or Weekly, an hour from 0 to 23 and a valid weekday.'),{status:400});
 conn=await db.getConnection();await conn.beginTransaction();await conn.query('UPDATE backup_schedule SET enabled=?,frequency=?,hour=?,weekday=?,next_run=?,updated_by=? WHERE id=1',[Number(enabled),frequency,hour,weekday,enabled?nextRun({frequency,hour,weekday}).toISOString().slice(0,19).replace('T',' '):null,req.user.id]);
 await audit.enqueueAuditEvent(conn,{actorId:req.user.id,category:'backup',action:'updated',description:`${enabled?'Enabled':'Disabled'} ${frequency} snapshots`,route:'/api/admin/backup/schedule',metadata:{frequency,hour,weekday,time_zone:'UTC+08:00'}});await conn.commit();res.locals.auditEnqueued=true;res.json(await read());
 }catch(error:any){if(conn)await conn.rollback();res.status(error.status||500).json({message:error.status?error.message:'Could not save the snapshot schedule.'});}finally{conn?.release();}}
async function tick(){let conn:any;try{
 conn=await db.getConnection();const [[lock]]=await conn.query("SELECT GET_LOCK('euc-library-scheduled-snapshot',0) AS acquired");if(!lock.acquired)return;
 const [[config]]=await conn.query("SELECT * FROM backup_schedule WHERE id=1 AND enabled=1 AND next_run<=UTC_TIMESTAMP()");if(!config)return;
 const [[maintenance]]=await conn.query('SELECT mode FROM system_maintenance_state WHERE id=1');if(maintenance?.mode==='restoring')return;
 await conn.query("UPDATE backup_schedule SET next_run=?,last_run=UTC_TIMESTAMP(),last_result='running',last_error=NULL WHERE id=1",[nextRun(config).toISOString().slice(0,19).replace('T',' ')]);
 try{
  const saved=await require('./snapshot.storage.service').uploadSnapshot(await require('./snapshot.service').createBackupPayload(),config.updated_by,'scheduled');
  await audit.recordAuditEvent({actorId:config.updated_by,category:'backup',action:'created',description:`Saved scheduled snapshot #${saved.id}`,route:'/api/admin/backup/snapshots/'+saved.id,metadata:{snapshot_id:saved.id,schedule:config.frequency}});
  await conn.query("UPDATE backup_schedule SET last_result='saved',last_error=NULL WHERE id=1");
 }catch{await conn.query("UPDATE backup_schedule SET last_result='failed',last_error='Scheduled snapshot failed. Check storage configuration and Audit Logs before retrying.' WHERE id=1");}
 }catch(error:any){if(error.code!=='ER_NO_SUCH_TABLE')console.error('[backup] Schedule check failed:',error.code||'unknown');}finally{if(conn){await conn.query("SELECT RELEASE_LOCK('euc-library-scheduled-snapshot')").catch(()=>{});conn.release();}}}
export function start(){const timer=setInterval(()=>void tick(),60000);timer.unref();void tick();}

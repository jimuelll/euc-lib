const db=require('../../db'),repository=require('./backup.repository'),storage=require('./snapshot.storage.service'),snapshot=require('./snapshot.service'),transforms=require('./snapshot.transforms'),audit=require('../analytics/analytics.audit.service'),safety=require('./backup.safety');
const record=(req:any,action:string,description:string,metadata:any)=>audit.recordAuditEvent({actorId:req.user.id,category:'backup',action,description,route:req.params.id?'/api/admin/backup/snapshots/'+req.params.id:'/api/admin/backup/notice',metadata});
const fail=(res:any,error:any)=>res.status(error.status||500).json({message:error.status?error.message:'Snapshot action failed. Refresh and try again.'});
export async function notice(req:any,res:any){try{
 const notifications=require('../notifications/notifications.admin.service');
 const count=await notifications.count({audienceType:'all'});if(count!==req.body.confirmedRecipientCount)throw Object.assign(new Error('Recipient count changed. Refresh and confirm the notice again.'),{status:409});
 await record(req,'created','Requested advance notice of a library restore',{recipient_count:count});
 await notifications.create({type:'announcement',title:'Library restore planned',body:'A library administrator is preparing to restore the system. Save your work and finish current transactions. All users will need to sign in again after the restore.',audienceType:'all',confirmedRecipientCount:count,expiresAt:new Date(Date.now()+3600000).toISOString()},req.user.id);
 res.locals.auditEnqueued=true;res.json({message:`Advance notice sent to ${count} active accounts.`,recipientCount:count,sentAt:new Date().toISOString()});
 }catch(error){fail(res,error);}}
export async function preview(req:any,res:any){try{
 const saved=req.params.id?await repository.findSnapshot(req.params.id):null,backup=saved?await storage.getSnapshotPayload(saved):req.body;
 const compatibility=await snapshot.compatibilityFor(backup);if(!compatibility.compatible)return res.json({...compatibility,createdAt:backup?.createdAt,currentVersion:transforms.SNAPSHOT_VERSION});
 const current=await snapshot.createBackupPayload(),prepared=transforms.upgradeBackup(JSON.parse(JSON.stringify(backup))),accession=await require('./restore.repository').preflightAccessionRestore(prepared);res.json({...compatibility,sourceVersion:backup.version,currentVersion:transforms.SNAPSHOT_VERSION,createdAt:backup.createdAt,checksum:backup.integrity?.checksum,verification:backup.integrity?.algorithm==='sha256'&&backup.integrity.checksum===transforms.payloadChecksum(backup)?'verified':'unverified',impact:safety.compareRecords(backup,current,accession.tables),activeSessions:await safety.activeSessions(),checkedAt:new Date().toISOString(),safetyLabel:'Automatic safety snapshot · immediately before this restore'});
 }catch(error){fail(res,error);}}
export async function verify(req:any,res:any){try{
 const saved=await repository.findSnapshot(req.params.id),compatibility=await require('./backup.verification').verifyStoredSnapshot(saved);
 await record(req,'verified',`Verified snapshot #${saved.id}`,{snapshot_id:saved.id,compatible:compatibility.compatible});res.locals.auditEnqueued=true;res.json({...compatibility});
 }catch(error:any){await db.query("UPDATE backup_snapshots SET verification_status='failed',verified_at=UTC_TIMESTAMP() WHERE id=?",[req.params.id]).catch(()=>{});fail(res,error);}}
export async function update(req:any,res:any){let conn:any;try{
 const {label,notes,pinned}=req.body||{};if(label!==undefined&&(typeof label!=='string'||label.length>120)||notes!==undefined&&(typeof notes!=='string'||notes.length>500)||pinned!==undefined&&typeof pinned!=='boolean')throw Object.assign(new Error('Use a name up to 120 characters and notes up to 500 characters.'),{status:400});
 conn=await db.getConnection();await conn.beginTransaction();const [[saved]]=await conn.query('SELECT * FROM backup_snapshots WHERE id=? FOR UPDATE',[req.params.id]);if(!saved)throw Object.assign(new Error('Snapshot not found.'),{status:404});
 await conn.query('UPDATE backup_snapshots SET label=?,notes=?,pinned=? WHERE id=?',[label===undefined?saved.label:label.trim()||null,notes===undefined?saved.notes:notes.trim()||null,pinned===undefined?saved.pinned:Number(pinned),saved.id]);
 await audit.enqueueAuditEvent(conn,{actorId:req.user.id,category:'backup',action:'updated',description:`Updated snapshot #${saved.id}${pinned===undefined?'':pinned?' · pinned':' · unpinned'}`,route:'/api/admin/backup/snapshots/'+saved.id,metadata:{snapshot_id:saved.id,pinned:pinned??Boolean(saved.pinned)}});await conn.commit();res.locals.auditEnqueued=true;res.json({message:'Snapshot updated.'});
 }catch(error){if(conn)await conn.rollback();fail(res,error);}finally{conn?.release();}}
export async function remove(req:any,res:any){let conn:any;try{
 conn=await db.getConnection();await conn.beginTransaction();const [[saved]]=await conn.query('SELECT * FROM backup_snapshots WHERE id=? FOR UPDATE',[req.params.id]);if(!saved)throw Object.assign(new Error('Snapshot not found.'),{status:404});if(saved.pinned)throw Object.assign(new Error('Unpin this snapshot before deleting it.'),{status:409});
 await audit.enqueueAuditEvent(conn,{actorId:req.user.id,category:'backup',action:'deleted',description:`Deleted snapshot #${saved.id}`,route:'/api/admin/backup/snapshots/'+saved.id,metadata:{snapshot_id:saved.id}});await conn.query('DELETE FROM backup_snapshots WHERE id=?',[saved.id]);await conn.commit();res.locals.auditEnqueued=true;
 await storage.removeStoredSnapshot(saved).catch(()=>{});res.json({message:'Snapshot deleted.'});
 }catch(error){if(conn)await conn.rollback();fail(res,error);}finally{conn?.release();}}

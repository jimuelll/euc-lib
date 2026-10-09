const db=require('../../db'),storage=require('./snapshot.storage.service'),transforms=require('./snapshot.transforms'),snapshot=require('./snapshot.service');
export async function verifyStoredSnapshot(saved:any,requireCompatible=false){
 try{
  const backup=await storage.getSnapshotPayload(saved);
  if(!transforms.validateBackup(backup)||backup.integrity?.algorithm!=='sha256'||backup.integrity.checksum!==transforms.payloadChecksum(backup))throw Object.assign(new Error('Checksum verification failed or the backup has no checksum.'),{status:409});
  const compatibility=await snapshot.compatibilityFor(backup);
  if(requireCompatible&&!compatibility.compatible)throw Object.assign(new Error('The safety snapshot is incompatible. Live data was not replaced.'),{status:409});
  await db.query("UPDATE backup_snapshots SET checksum=?,snapshot_version=?,verification_status='verified',verified_at=UTC_TIMESTAMP() WHERE id=?",[backup.integrity.checksum,backup.version,saved.id]);
  return {...compatibility,checksum:backup.integrity.checksum,verification:'verified',verifiedAt:new Date().toISOString()};
 }catch(error){await db.query("UPDATE backup_snapshots SET verification_status='failed',verified_at=UTC_TIMESTAMP() WHERE id=?",[saved.id]).catch(()=>{});throw error;}
}

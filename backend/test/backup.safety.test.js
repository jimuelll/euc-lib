const test=require('node:test'),assert=require('node:assert/strict'),bcrypt=require('bcryptjs');
const db=require('../db'),safety=require('../modules/backup/backup.safety'),transforms=require('../modules/backup/snapshot.transforms');
test('restore requires the exact acknowledgement and the active super-admin password',async()=>{
 const query=db.query,hash=await bcrypt.hash('current-password',4);db.query=async()=>[[{password_hash:hash,is_active:1,role:'super_admin'}]];
 const request=(word,password)=>({user:{id:1},get:key=>({'x-restore-confirmation':'global-sign-out','x-restore-word':word,'x-restore-password':password}[key])});
 try{await assert.rejects(safety.requireRestoreCredentials(request('restore','current-password')),{status:400});await assert.rejects(safety.requireRestoreCredentials(request('RESTORE','wrong')),{status:403});await safety.requireRestoreCredentials(request('RESTORE','current-password'));db.query=async()=>[[{password_hash:hash,is_active:1,role:'staff'}]];await assert.rejects(safety.requireRestoreCredentials(request('RESTORE','current-password')),{status:403});}finally{db.query=query;}
});
test('restore impact counts added, changed and absent records instead of guessing losses from dates',()=>{
 const before={format:'euc-library-backup',version:17,createdAt:'2026-10-08T00:00:00Z',tables:{users:[{id:1,name:'A'},{id:2,name:'B'}],books:[]}};before.integrity={algorithm:'sha256',checksum:transforms.payloadChecksum(before)};
 const rows=safety.compareRecords(before,{tables:{users:[{id:1,name:'Changed'},{id:3,name:'New'}]}});assert.deepEqual(rows[0],{table:'users',added:1,changed:1,restored:1});
});
test('daily and weekly schedules use UTC+08:00 and move strictly into the future',()=>{
 const {nextRun}=require('../modules/backup/backup.schedule');assert.equal(nextRun({frequency:'daily',hour:2,weekday:1},Date.parse('2026-10-09T12:00:00Z')).toISOString(),'2026-10-09T18:00:00.000Z');assert.equal(nextRun({frequency:'weekly',hour:2,weekday:1},Date.parse('2026-10-09T12:00:00Z')).toISOString(),'2026-10-11T18:00:00.000Z');
});
test('pinned deletion is blocked before deleting records or cloud objects',async()=>{
 const connection=db.getConnection;let deleted=false;db.getConnection=async()=>({beginTransaction:async()=>{},query:async sql=>{if(sql.startsWith('DELETE'))deleted=true;return [[{id:1,pinned:1}]];},rollback:async()=>{},release(){}});
 const res={status(n){this.code=n;return this;},json(value){this.body=value;}};try{await require('../modules/backup/backup.management').remove({params:{id:1},user:{id:1}},res);assert.equal(res.code,409);assert.equal(deleted,false);}finally{db.getConnection=connection;}
});
test('verification rejects a corrupted checksum instead of marking it verified',async()=>{
 const repository=require('../modules/backup/backup.repository'),storage=require('../modules/backup/snapshot.storage.service'),find=repository.findSnapshot,get=storage.getSnapshotPayload,query=db.query;let verified=false;
 repository.findSnapshot=async()=>({id:4});storage.getSnapshotPayload=async()=>({format:'euc-library-backup',version:17,tables:{},integrity:{algorithm:'sha256',checksum:'bad'}});db.query=async(sql)=>{if(sql.includes("='verified'"))verified=true;return [[]];};
 const res={status(n){this.code=n;return this;},json(value){this.body=value;}};try{await require('../modules/backup/backup.management').verify({params:{id:4},user:{id:1}},res);assert.equal(res.code,409);assert.equal(verified,false);}finally{repository.findSnapshot=find;storage.getSnapshotPayload=get;db.query=query;}
});
test('snapshot creation validates and passes optional names and notes into storage',async()=>{
 const service=require('../modules/backup/snapshot.service'),storage=require('../modules/backup/snapshot.storage.service'),create=service.createBackupPayload,upload=storage.uploadSnapshot;
 let details;service.createBackupPayload=async()=>({createdAt:'2026-10-09T00:00:00Z'});storage.uploadSnapshot=async(_payload,_actor,_kind,value)=>{details=value;return {id:7,...value};};
 const response=()=>({status(n){this.code=n;return this;},json(body){this.body=body;}});
 try{const res=response();await require('../modules/backup/backup.controller').saveSnapshot({user:{id:1},body:{label:' Before clearance ',notes:'Keep this copy'}},res);assert.equal(res.code,201);assert.deepEqual(details,{label:'Before clearance',notes:'Keep this copy'});const invalid=response();await require('../modules/backup/backup.controller').saveSnapshot({user:{id:1},body:{label:'x'.repeat(121)}},invalid);assert.equal(invalid.code,400);}finally{service.createBackupPayload=create;storage.uploadSnapshot=upload;}
});
test('impact includes settings and holdings using their actual primary keys and excludes retained registries',()=>{
 const before={format:'euc-library-backup',version:17,tables:{copy_holdings:[{copy_id:7,state:'old'}],book_embeddings:[{book_id:5,status:'ready'}],catalog_settings:[{id:1,show_unheld_in_opac:1}],accession_claims:[]}};before.integrity={algorithm:'sha256',checksum:transforms.payloadChecksum(before)};
 const rows=safety.compareRecords(before,{tables:{copy_holdings:[{copy_id:7,state:'changed'},{copy_id:8,state:'new'}],book_embeddings:[{book_id:5,status:'stale'}],catalog_settings:[{id:1,show_unheld_in_opac:0}],accession_claims:[{accession_number:'A'}]}});
 assert.deepEqual(rows.find(r=>r.table==='copy_holdings'),{table:'copy_holdings',added:1,changed:1,restored:0});assert.equal(rows.find(r=>r.table==='book_embeddings').changed,1);assert.equal(rows.find(r=>r.table==='catalog_settings').changed,1);assert.ok(!rows.some(r=>r.table==='accession_claims'));
});
for(const verificationFails of [false,true])test(`safety snapshot must verify before replacement (failure: ${verificationFails})`,async()=>{
 const repository=require('../modules/backup/restore.repository'),stored=require('../modules/backup/backup.repository'),storage=require('../modules/backup/snapshot.storage.service'),service=require('../modules/backup/snapshot.service'),verification=require('../modules/backup/backup.verification'),hub=require('../realtime/notificationHub');
 const originals={lock:repository.acquireRestoreLock,maintenance:repository.setMaintenance,accession:repository.preflightAccessionRestore,replace:repository.replaceApplicationData,find:stored.findSnapshot,upload:storage.uploadSnapshot,create:service.createBackupPayload,preflight:service.preflightRestore,verify:verification.verifyStoredSnapshot,close:hub.closeAllConnections};const calls=[];
 repository.acquireRestoreLock=async()=>({query:async()=>{},release(){}});repository.setMaintenance=async()=>{};repository.preflightAccessionRestore=async()=>{};repository.replaceApplicationData=async()=>{calls.push('replace');return {auditEventId:123};};stored.findSnapshot=async()=>({id:7});storage.uploadSnapshot=async()=>({id:7});service.createBackupPayload=async()=>({});service.preflightRestore=async()=>{};verification.verifyStoredSnapshot=async()=>{calls.push('verify');if(verificationFails)throw new Error('verification failed');return {verification:'verified'};};hub.closeAllConnections=()=>{};
 const payload={format:'euc-library-backup',version:17,tables:{},createdAt:'2026-10-09T00:00:00Z'};payload.integrity={algorithm:'sha256',checksum:transforms.payloadChecksum(payload)};
 const modulePath=require.resolve('../modules/backup/snapshot.restore.service'),oldModule=require.cache[modulePath];delete require.cache[modulePath];
 try{const run=require('../modules/backup/snapshot.restore.service').performRestore(payload,{restoredBy:1});if(verificationFails){await assert.rejects(run,error=>error.safetySnapshotId===7&&error.restoreCommitted===false);assert.deepEqual(calls,['verify']);}else{const result=await run;assert.deepEqual(calls,['verify','replace']);assert.equal(result.verification,'verified');}}
 finally{if(oldModule)require.cache[modulePath]=oldModule;else delete require.cache[modulePath];Object.assign(repository,{acquireRestoreLock:originals.lock,setMaintenance:originals.maintenance,preflightAccessionRestore:originals.accession,replaceApplicationData:originals.replace});stored.findSnapshot=originals.find;storage.uploadSnapshot=originals.upload;service.createBackupPayload=originals.create;service.preflightRestore=originals.preflight;verification.verifyStoredSnapshot=originals.verify;hub.closeAllConnections=originals.close;}
});
test('impact compares the accession-adjusted restore tables rather than overstating preserved holding changes',()=>{
 const payload={format:'euc-library-backup',version:17,tables:{copy_holdings:[{copy_id:7,accession_number:'OLD'}]}};payload.integrity={algorithm:'sha256',checksum:transforms.payloadChecksum(payload)};
 const actual={copy_holdings:[{copy_id:7,accession_number:'RETAINED'}]};assert.equal(safety.compareRecords(payload,{tables:actual},actual).find(r=>r.table==='copy_holdings').changed,0);
});

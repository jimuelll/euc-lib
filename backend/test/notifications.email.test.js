const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../db');
const repo=require('../modules/notifications/notifications.email.repository');
const email=require('../modules/notifications/notifications.email.service');
const admin=require('../modules/notifications/notifications.admin.service');
const adminRepo=require('../modules/notifications/notifications.admin.repository');
const notifications=require('../modules/notifications/notifications.service');
const delivery=require('../modules/email/email.service');
const transport=require('../modules/email/email.provider');
const settings=require('../modules/email/email.config');
const hub=require('../realtime/notificationHub');
const base={type:'announcement',title:'New library hours',body:'Check the bulletin.',audienceType:'all',href:'/bulletin',sendEmail:true,createdBy:1};
async function env(work,extra={}){
 const values={EMAIL_ENABLED:'true',EMAIL_ROUTINE_ENABLED:'true',EMAIL_MODE:'capture',EMAIL_DAILY_LIMIT:'300',EMAIL_SECURITY_RESERVE:'50',EMAIL_ENCRYPTION_KEY:'08'.repeat(32),PUBLIC_APP_URL:'https://library.example',...extra};
 const before=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));Object.assign(process.env,values);
 try{return await work();}finally{for(const[key,value]of Object.entries(before))if(value===undefined)delete process.env[key];else process.env[key]=value;}
}
test('manual email preview counts verified recipients and pending mail before exposing routine capacity',()=>env(async()=>{
 const original=repo.preview;repo.preview=async()=>({total:28,eligible:20,used:180,queued:60});
 try{
  const result=await email.preview(base);assert.equal(result.inAppCount,28);assert.equal(result.emailCount,20);assert.equal(result.skippedCount,8);assert.equal(result.remainingRoutine,10);assert.equal(result.enabled,true);
  await env(async()=>{const paused=await email.preview(base);assert.equal(paused.enabled,false);assert.match(paused.reason,/paused/);},{EMAIL_ROUTINE_ENABLED:'false'});
  repo.preview=async()=>({total:28,eligible:20,used:290,queued:60});assert.equal((await email.preview(base)).remainingRoutine,0);
 }finally{repo.preview=original;}
}));
test('manual email creation rejects stale counts, disabled delivery and zero verified recipients; opt-out never queues email',()=>env(async()=>{
 const original={count:adminRepo.audienceCount,preview:email.preview,publish:email.publish,create:notifications.createNotification};let result={enabled:true,inAppCount:4,emailCount:3};let published=0,inApp=0;
 adminRepo.audienceCount=async()=>4;email.preview=async()=>result;email.publish=async()=>{published++;};notifications.createNotification=async()=>{inApp++;};
 try{
  await assert.rejects(admin.create({...base,confirmedRecipientCount:4,confirmedEmailCount:2},1),e=>e.status===409);
  result={...result,enabled:false,reason:'Paused'};await assert.rejects(admin.create({...base,confirmedRecipientCount:4,confirmedEmailCount:3},1),/Paused/);
  result={...result,enabled:true,emailCount:0};await assert.rejects(admin.create({...base,confirmedRecipientCount:4,confirmedEmailCount:0},1),/no verified/);
  await admin.create({...base,sendEmail:false,confirmedRecipientCount:4},1);assert.equal(inApp,1);assert.equal(published,0);
  assert.equal(admin.validate({...base,sendEmail:undefined}).sendEmail,false);assert.throws(()=>admin.validate({...base,sendEmail:'true'}),/whether/);
 }finally{adminRepo.audienceCount=original.count;email.preview=original.preview;email.publish=original.publish;notifications.createNotification=original.create;}
}));
async function publicationFixture(work,{failHandoff=false,existing=false,snapshotCount=3}={}){
 const original=db.getConnection,calls=[];const record={id:41,audience_type:'all',email_batch_id:'batch',email_requested:1};
 const query=async(sql,values)=>{
  calls.push({sql,values});
  if(sql.includes('WHERE delivery_key='))return [existing?[record]:[]];
  if(sql.startsWith('INSERT INTO notifications'))return [{insertId:41,affectedRows:1}];
  if(sql.includes('FROM notifications WHERE id='))return [[record]];
  if(sql.includes('COUNT(*) AS total FROM users'))return [[{total:4}]];
  if(sql.startsWith('INSERT INTO email_deliveries'))return [{affectedRows:snapshotCount}];
  if(failHandoff&&sql.startsWith('INSERT INTO delivery_outbox'))throw new Error('handoff failed');
  return [{affectedRows:1}];
 };
 db.getConnection=async()=>({query,beginTransaction:async()=>calls.push({sql:'BEGIN'}),commit:async()=>calls.push({sql:'COMMIT'}),rollback:async()=>calls.push({sql:'ROLLBACK'}),release(){}});
 try{await work(calls);}finally{db.getConnection=original;}
}
test('publication snapshots all audience modes with set-based inserts, atomic handoffs and post-commit realtime',async()=>{
 for(const audience of [{audienceType:'all'},{audienceType:'role',audienceRole:'student'},{audienceType:'user',audienceUserId:7}]){
  await publicationFixture(async calls=>{
   const push=hub.pushAudienceChanged,one=hub.pushNotification;hub.pushAudienceChanged=()=>assert.ok(calls.some(c=>c.sql==='COMMIT'));hub.pushNotification=hub.pushAudienceChanged;
   try{await email.publish({...base,...audience},{total:4,email:3});}finally{hub.pushAudienceChanged=push;hub.pushNotification=one;}
   const snapshot=calls.find(c=>c.sql.startsWith('INSERT INTO email_deliveries'));
   assert.match(snapshot.sql,/SELECT UUID\(\),u.id,LOWER\(TRIM\(u.email\)\)/);assert.match(snapshot.sql,/email_verified_at IS NOT NULL/);assert.match(snapshot.sql,/setup_pending=0/);assert.match(snapshot.sql,/manualBatch/);
   if(audience.audienceRole)assert.equal(snapshot.values.at(-1),'student');if(audience.audienceUserId)assert.equal(snapshot.values.at(-1),7);
   assert.ok(calls.some(c=>c.sql.startsWith('INSERT INTO delivery_outbox')));assert.ok(!calls.some(c=>c.sql==='ROLLBACK'));
  });
 }
});
test('publication rollback leaves no partial in-app/email batch; duplicate scheduled delivery never snapshots twice',async()=>{
 await publicationFixture(async calls=>{await assert.rejects(repo.publish(base,{total:4,email:3}),/handoff failed/);assert.equal(calls.at(-1).sql,'ROLLBACK');assert.ok(!calls.some(c=>c.sql==='COMMIT'));},{failHandoff:true});
 await publicationFixture(async calls=>{await assert.rejects(repo.publish(base,{total:4,email:3}),e=>e.status===409);assert.equal(calls.at(-1).sql,'ROLLBACK');},{snapshotCount:2});
 await publicationFixture(async calls=>{const result=await repo.publish({...base,deliveryKey:'same-event'});assert.equal(result.created,false);assert.ok(!calls.some(c=>c.sql.startsWith('INSERT')));},{existing:true});
});
test('manual email worker rechecks role, address, verification and notification activity before sending',()=>env(async()=>{
 const original={get:db.getConnection,query:db.query,send:transport.provider.send};let sent=[];
 const row={id:'delivery',user_id:7,recipient:'member@example.edu',purpose:'manual_notification',notification_id:41,priority:0,status:'queued',attempts:0,content_encrypted:null,context_json:{manualBatch:'batch'}};
 let user={id:7,email:'member@example.edu',email_verified_at:'2026-01-01',name:'Member',is_active:1,deleted_at:null,setup_pending:0,role:'student'};
 let notice={title:'Hours <updated>',body:'Visit today.',href:'/bulletin',audience_type:'role',audience_role:'student'};let finalStatus;
 const query=async(sql,values)=>{
  if(sql.includes('GET_LOCK'))return [[{acquired:1}]];if(sql.includes('SELECT mode'))return [[{mode:'idle'}]];if(sql.includes('AS waiting'))return [[{waiting:0}]];
  if(sql.includes('SELECT d.*'))return [[row]];if(sql.includes('SELECT id,email,pending_email'))return [[user]];
  if(sql.startsWith('SELECT * FROM notifications')){assert.match(sql,/email_expires_at>UTC_TIMESTAMP/);assert.match(sql,/is_active=1/);assert.deepEqual(values,[41,'batch']);return [notice?[notice]:[]];}
  if(sql.includes('accepted_at=CASE')||sql.includes("status='cancelled'" )&&sql.includes('WHERE id=?'))finalStatus=values?.[0]||'cancelled';
  return [{affectedRows:1}];
 };
 db.getConnection=async()=>({query,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){}});db.query=query;transport.provider.send=async message=>sent.push(message);
 try{
  await delivery.dispatchOne();assert.equal(sent.length,1);assert.equal(finalStatus,'accepted');assert.equal(sent[0].action_url,'https://library.example/bulletin');assert.match(transport.renderEmail(sent[0],false).htmlContent,/&lt;updated&gt;/);
  for(const invalid of [{role:'alumni'},{email:'changed@example.edu'},{email_verified_at:null},{setup_pending:1},{is_active:0}]){
   const previous=user;user={...user,...invalid};await delivery.dispatchOne();assert.equal(sent.length,1);user=previous;
  }
  notice=null;await delivery.dispatchOne();assert.equal(sent.length,1);
 }finally{db.getConnection=original.get;db.query=original.query;transport.provider.send=original.send;}
}));
test('per-notification summaries expose every status without recipient addresses and stay within a publication batch',async()=>{
 const original=db.query;db.query=async(sql,values)=>{assert.deepEqual(values,[41,'batch']);assert.match(sql,/manualBatch/);return [[{status:'accepted',total:12},{status:'failed',total:2}]];};
 try{assert.deepEqual(await repo.summary(41,'batch'),{queued:0,processing:0,accepted:12,failed:2,unknown:0,cancelled:0});}finally{db.query=original;}
});
test('scheduled publication resolves its audience at dispatch, remains idempotent, and suppresses restored emails',async()=>{
 const outbox=require('../modules/delivery-outbox/outbox.repository'),worker=require('../modules/delivery-outbox/outbox.service');
 const original={claim:outbox.claimBatch,mark:outbox.markDelivered,publish:email.publish};const attempts=[];
 let suppressed=false;outbox.claimBatch=async()=>[{id:'scheduled-event',event_type:'notification',attempts:1,payload:{...base,manualNotification:true,suppressEmail:suppressed}}];outbox.markDelivered=async()=>{};
 email.publish=async input=>attempts.push(input);
 try{
  await worker.drainOutbox();await worker.drainOutbox();suppressed=true;await worker.drainOutbox();
  assert.deepEqual(attempts.map(row=>row.deliveryKey),['scheduled-event','scheduled-event','scheduled-event']);assert.equal(attempts[0].sendEmail,true);assert.equal(attempts[2].sendEmail,false);
 }finally{outbox.claimBatch=original.claim;outbox.markDelivered=original.mark;email.publish=original.publish;}
});
test('manual notification email preview and creation authorize admins and super admins only',async()=>{
 const jwt=require('../modules/auth/jwt.util'),sessions=require('../modules/auth/authSession.service');
 const original={verify:jwt.verifyAccessToken,current:sessions.isAccessTokenCurrent,active:sessions.isUserAccessActive};
 const paths=['../modules/auth/auth.middleware','../modules/notifications/notifications.routes'];const cached=paths.map(path=>[require.resolve(path),require.cache[require.resolve(path)]]);
 jwt.verifyAccessToken=token=>({id:3,role:token});sessions.isAccessTokenCurrent=async()=>true;sessions.isUserAccessActive=async()=>true;
 for(const[path]of cached)delete require.cache[path];
 try{
  const router=require(paths[1]);
  for(const path of ['/admin/notifications/email-preview','/admin/notifications']){
   const gate=router.stack.find(layer=>layer.route?.path===path).route.stack[0].handle;
   for(const role of ['student','staff','admin','super_admin']){let next=false,status;await gate({headers:{authorization:`Bearer ${role}`}},{status(code){status=code;return this;},json(){}},()=>{next=true;});assert.equal(next,['admin','super_admin'].includes(role));if(!next)assert.equal(status,403);}
  }
 }finally{jwt.verifyAccessToken=original.verify;sessions.isAccessTokenCurrent=original.current;sessions.isUserAccessActive=original.active;for(const[path,value]of cached)if(value)require.cache[path]=value;else delete require.cache[path];}
});

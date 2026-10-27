const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../db');
const admin=require('../modules/notifications/notifications.admin.service');
const adminRepo=require('../modules/notifications/notifications.admin.repository');
const repo=require('../modules/notifications/notifications.email.repository');
const email=require('../modules/notifications/notifications.email.service');
const notifications=require('../modules/notifications/notifications.repository');
const hub=require('../realtime/notificationHub');
const base={type:'announcement',title:'Hours',body:'Updated opening hours',audienceType:'users',audienceUserIds:[7,8,7],sendEmail:false};

test('selected audience normalizes duplicates and rejects malformed or empty IDs',()=>{
 assert.deepEqual(admin.validate(base).audienceUserIds,[7,8]);
 for(const audienceUserIds of [[],[0],[-1],[1.5],[true],['x'],[Number.MAX_SAFE_INTEGER+1],{}])assert.throws(()=>admin.validate({...base,audienceUserIds}),/valid IDs/);
 assert.deepEqual(admin.selectedUserIds({audienceUserIds:'8,7,8'}),[7,8]);
 assert.deepEqual(admin.selectedUserIds({'audienceUserIds[]':['8','7']}),[7,8]);
 assert.match(repo.audienceWhere({...base,audienceUserIds:[]}).sql,/1=0/);
 assert.deepEqual(repo.audienceWhere(base).params,[7,8]);
});
test('selected patrons retain their IDs through scheduling, count confirmation and retry',async()=>{
 const original={count:adminRepo.audienceCount,enqueue:adminRepo.enqueue,get:adminRepo.get,retry:adminRepo.retry};let queued;
 adminRepo.audienceCount=async(type,role,id,ids)=>{assert.equal(type,'users');assert.deepEqual(ids,[7,8]);return 2;};
 adminRepo.enqueue=async payload=>{queued=payload;return 'selected-event';};
 adminRepo.get=async()=>({audience_type:'users',audience_user_ids:[7,8],queue_id:'selected-event',delivery_status:'failed'});
 adminRepo.retry=async id=>{assert.equal(id,'selected-event');return true;};
 try {
  await assert.rejects(admin.create({...base,confirmedRecipientCount:1},1),e=>e.status===409);
  await admin.create({...base,scheduledAt:new Date(Date.now()+3600000).toISOString(),confirmedRecipientCount:2},1);
  assert.deepEqual(queued.audienceUserIds,[7,8]);assert.equal(queued.manualNotification,true);
  await admin.action('queue:selected-event','resend',1,{confirmedRecipientCount:2});
 } finally {Object.assign(adminRepo,{audienceCount:original.count,enqueue:original.enqueue,get:original.get,retry:original.retry});}
});
async function publication(work,{members=2,existing=false,failMembership=false}={}) {
 const original=db.getConnection,calls=[];
 const record={id:41,audience_type:'users'};
 db.getConnection=async()=>({beginTransaction:async()=>calls.push('BEGIN'),commit:async()=>calls.push('COMMIT'),rollback:async()=>calls.push('ROLLBACK'),release(){},query:async(sql,values)=>{
  calls.push({sql,values});
  if(sql.includes('WHERE delivery_key='))return [existing?[record]:[]];
  if(sql.startsWith('INSERT INTO notifications'))return [{insertId:41}];
  if(sql.includes('FROM notifications WHERE id='))return [[record]];
  if(sql.startsWith('INSERT INTO notification_recipients')){if(failMembership)throw new Error('membership failure');return [{affectedRows:members}];}
  if(sql.startsWith('SELECT user_id FROM notification_recipients'))return [[{user_id:7},{user_id:8}]];
  if(sql.includes('COUNT(*) AS total FROM users'))return [[{total:2}]];
  if(sql.startsWith('INSERT INTO email_deliveries'))return [{affectedRows:1}];
  return [{affectedRows:1}];
 }});
 try {await work(calls);}finally{db.getConnection=original;}
}
test('one publication commits memberships and optional email atomically before targeted realtime',async()=>{
 for(const sendEmail of [false,true])await publication(async calls=>{
  const original=hub.pushNotification,all=hub.pushAudienceChanged,targets=[];
  hub.pushNotification=id=>{assert.ok(calls.includes('COMMIT'));targets.push(id);};hub.pushAudienceChanged=()=>assert.fail('Selected audience cannot broadcast');
  try{await email.publish({...base,sendEmail},{total:2,email:sendEmail?1:0});}finally{hub.pushNotification=original;hub.pushAudienceChanged=all;}
  assert.deepEqual(targets,[7,8]);assert.equal(calls.filter(call=>call.sql?.startsWith('INSERT INTO notifications')).length,1);
  const membership=calls.find(call=>call.sql?.startsWith('INSERT INTO notification_recipients'));
  assert.match(membership.sql,/deleted_at IS NULL AND u.is_active=1/);assert.deepEqual(membership.values,[41,7,8]);
  const snapshot=calls.find(call=>call.sql?.startsWith('INSERT INTO email_deliveries'));
  if(sendEmail)assert.match(snapshot.sql,/notification_recipients/);else assert.equal(snapshot,undefined);
 });
});
test('membership failure or changed count rolls back; repeated queue delivery cannot expand membership',async()=>{
 for(const options of [{members:1},{failMembership:true}])await publication(async calls=>{await assert.rejects(repo.publish(base,{total:2,email:0}));assert.ok(calls.includes('ROLLBACK'));assert.ok(!calls.includes('COMMIT'));},options);
 await publication(async calls=>{const result=await repo.publish({...base,deliveryKey:'same'});assert.equal(result.created,false);assert.ok(!calls.some(call=>call.sql?.startsWith('INSERT')));},{existing:true});
});
test('all patron read paths enforce membership through the common authorization predicate',async()=>{
 const original=db.query,calls=[];
 db.query=async(sql,params)=>{calls.push({sql,params});return [[{total:0}]];};
 try {
  await notifications.listForUser({userId:99,role:'student',limit:20,unreadOnly:false});
  await notifications.getByIdForUser({notificationId:41,userId:99,role:'student'});
  await notifications.getUnreadCountForUser({userId:99,role:'student'});
  await notifications.markAllAsRead({userId:99,role:'student'});
  for(const call of calls){assert.match(call.sql,/notification_recipients r WHERE r.notification_id=n.id AND r.user_id=audience_user.id/);assert.match(call.sql,/audience_user.is_active=1/);assert.ok(call.params.includes(99));}
 } finally {db.query=original;}
});
test('email exclusions are exclusive and sum to in-app-only accounts',async()=>{
 const original=db.query;let queryIndex=0;
 db.query=async sql=>{if(queryIndex++===0){assert.match(sql,/setup_pending=0 AND u.email_verified_at IS NULL/);return [[{total:6,eligible:3,missing_address:1,incomplete_setup:1,unverified_address:1}]];}return [[{used:0,queued:0}]];};
 try{const result=await repo.preview(base,'2026-10-27');assert.deepEqual(result.exclusions,{missingAddress:1,incompleteSetup:1,unverifiedAddress:1});assert.equal(Object.values(result.exclusions).reduce((a,b)=>a+b,0),result.total-result.eligible);}finally{db.query=original;}
});

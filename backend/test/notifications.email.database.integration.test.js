const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const db=require('../db');
const repo=require('../modules/notifications/notifications.email.repository');
const admin=require('../modules/notifications/notifications.admin.service');
const adminRepo=require('../modules/notifications/notifications.admin.repository');
const email=require('../modules/email/email.service');
const settings=require('../modules/email/email.config');
const provider=require('../modules/email/email.provider');
const outbox=require('../modules/delivery-outbox/outbox.service');
const enabled=process.env.RUN_DB_INTEGRATION==='1'&&process.env.DB_NAME==='euc_manual_email_test';
const options={skip:enabled?false:'requires RUN_DB_INTEGRATION=1 and prepared euc_manual_email_test schema'};
if(require.main===module)require('node:test').after(()=>db.end());
async function fixture(work){
 const prefix=`MANUAL-${randomUUID()}`,ids=[];
 const values={EMAIL_ENABLED:'true',EMAIL_ROUTINE_ENABLED:'true',EMAIL_MODE:'capture',EMAIL_DAILY_LIMIT:'300',EMAIL_SECURITY_RESERVE:'50',EMAIL_ENCRYPTION_KEY:'06'.repeat(32),PUBLIC_APP_URL:'https://library.example'};
 const before=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));Object.assign(process.env,values);
 async function user(suffix,changes={}){
  const row={role:'student',verified:1,setup:0,active:1,deleted:null,...changes};
  const [result]=await db.query('INSERT INTO users(student_employee_id,name,email,password_hash,role,email_verified_at,setup_pending,is_active,deleted_at) VALUES (?,?,?,?,?,IF(?=1,UTC_TIMESTAMP(),NULL),?,?,?)',[`${prefix}-${suffix}`,suffix,`${prefix}-${suffix}@example.edu`,'fixture-only',row.role,row.verified,row.setup,row.active,row.deleted]);ids.push(result.insertId);return result.insertId;
 }
 try{
  const student=await user('student'),alumni=await user('alumni',{role:'alumni'}),unverified=await user('unverified',{verified:0});
  await user('setup',{setup:1});await user('inactive',{active:0});await user('deleted',{deleted:new Date()});
  await db.query('UPDATE email_dispatch_state SET next_send_at=NULL WHERE id=1');
  await work({prefix,student,alumni,unverified,user,base:{type:'announcement',title:prefix,body:'Hours <updated>',href:'/bulletin',audienceType:'all',sendEmail:true,createdBy:student}});
 }finally{
  const [notices]=await db.query('SELECT id FROM notifications WHERE title=?',[prefix]);
  for(const notice of notices){await db.query('DELETE o FROM delivery_outbox o JOIN email_deliveries d ON BINARY d.id=BINARY o.id WHERE d.notification_id=?',[notice.id]);await db.query('DELETE FROM email_deliveries WHERE notification_id=?',[notice.id]);await db.query('DELETE FROM notification_recipients WHERE notification_id=?',[notice.id]);await db.query('DELETE FROM notifications WHERE id=?',[notice.id]);}
  await db.query("DELETE FROM delivery_outbox WHERE event_type='notification' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.title'))=?",[prefix]);
  for(const id of ids)await db.query('DELETE FROM users WHERE id=?',[id]);
  await db.query('DELETE FROM email_quota_usage WHERE period_start=?',[settings.config().periodStart]);
  for(const[key,value]of Object.entries(before))if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
}
test('database: all/role/individual manual emails freeze verified recipients and preserve seven-day or explicit deadlines',options,()=>fixture(async f=>{
 for(const audience of [{audienceType:'all',total:4,eligible:2},{audienceType:'role',audienceRole:'student',total:3,eligible:1},{audienceType:'user',audienceUserId:f.student,total:1,eligible:1}]){
  const result=await repo.publish({...f.base,...audience},{total:audience.total,email:audience.eligible});
  const [[count]]=await db.query('SELECT COUNT(*) AS total FROM email_deliveries WHERE notification_id=?',[result.record.id]);assert.equal(Number(count.total),audience.eligible);
  const [[deadline]]=await db.query('SELECT TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),email_expires_at) AS seconds FROM notifications WHERE id=?',[result.record.id]);assert.ok(deadline.seconds>604700&&deadline.seconds<=604800);
  const [[handoffs]]=await db.query("SELECT COUNT(*) AS total FROM delivery_outbox o JOIN email_deliveries d ON BINARY d.id=BINARY o.id WHERE d.notification_id=? AND o.event_type='email'",[result.record.id]);assert.equal(Number(handoffs.total),audience.eligible);
 }
 const result=await repo.publish({...f.base,expiresAt:new Date(Date.now()+1200000)});
 const [[deadline]]=await db.query('SELECT TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),email_expires_at) AS seconds FROM notifications WHERE id=?',[result.record.id]);assert.ok(deadline.seconds>=1190&&deadline.seconds<=1200);
}));
test('database: stale email confirmation rolls publication back and duplicate handoffs cannot expand a frozen audience',options,()=>fixture(async f=>{
 await assert.rejects(repo.publish({...f.base,deliveryKey:'rollback-'+f.prefix},{total:4,email:1}),e=>e.status===409);
 const [[count]]=await db.query('SELECT COUNT(*) AS total FROM notifications WHERE title=?',[f.prefix]);assert.equal(Number(count.total),0);
 const input={...f.base,deliveryKey:'stable-'+f.prefix};const first=await repo.publish(input);
 await f.user('new-verified');const second=await repo.publish(input);assert.equal(second.created,false);assert.equal(second.record.id,first.record.id);
 const [[emails]]=await db.query('SELECT COUNT(*) AS total FROM email_deliveries WHERE notification_id=?',[first.record.id]);assert.equal(Number(emails.total),2);
 const details=await admin.details(`notification:${first.record.id}`);assert.equal(details[0].email_summary.queued,2);
 await adminRepo.expire(`notification:${first.record.id}`);
 const summary=await repo.summary(first.record.id,first.record.email_batch_id);assert.equal(summary.cancelled,2);assert.equal(summary.queued,0);
}));
test('database: scheduled manual notifications capture recipients at publication, not schedule creation',options,()=>fixture(async f=>{
 const queued=await admin.create({...f.base,scheduledAt:new Date(Date.now()+3600000).toISOString(),confirmedRecipientCount:4,confirmedEmailCount:2},f.student);
 await f.user('joined-before-publication');
 await db.query('UPDATE delivery_outbox SET available_at=UTC_TIMESTAMP() WHERE id=?',[queued.queueId]);
 await outbox.drainOutbox();
 const [[notice]]=await db.query('SELECT id FROM notifications WHERE delivery_key=?',[queued.queueId]);
 const [[emails]]=await db.query('SELECT COUNT(*) AS total FROM email_deliveries WHERE notification_id=?',[notice.id]);assert.equal(Number(emails.total),3);
 await outbox.drainOutbox();
 const [[again]]=await db.query('SELECT COUNT(*) AS total FROM email_deliveries WHERE notification_id=?',[notice.id]);assert.equal(Number(again.total),3);
}));

test('database: selected audiences publish once, isolate patron reads and freeze only active memberships',options,()=>fixture(async f=>{
 const notifications=require('../modules/notifications/notifications.repository');
 const service=require('../modules/notifications/notifications.service');
 const input={...f.base,audienceType:'users',audienceUserIds:[f.student,f.unverified,f.student],deliveryKey:'selected-'+f.prefix};
 const result=await repo.publish(input,{total:2,email:1});
 const [[count]]=await db.query('SELECT COUNT(*) AS total FROM notification_recipients WHERE notification_id=?',[result.record.id]);assert.equal(Number(count.total),2);
 assert.ok(await notifications.getByIdForUser({notificationId:result.record.id,userId:f.student,role:'student'}));
 assert.equal(await notifications.getByIdForUser({notificationId:result.record.id,userId:f.alumni,role:'alumni'}),null);
 await assert.rejects(service.markAsRead({notificationId:result.record.id,userId:f.alumni,role:'alumni'}),e=>e.status===404);
 const unread=await notifications.getUnreadCountForUser({userId:f.student,role:'student'});assert.ok(unread>=1);
 await notifications.markAllAsRead({userId:f.alumni,role:'alumni'});
 const [[unselectedRead]]=await db.query('SELECT COUNT(*) AS total FROM notification_reads WHERE notification_id=? AND user_id=?',[result.record.id,f.alumni]);assert.equal(Number(unselectedRead.total),0);
 const duplicate=await repo.publish({...input,audienceUserIds:[f.student,f.alumni]});assert.equal(duplicate.created,false);
 assert.equal(await notifications.getByIdForUser({notificationId:result.record.id,userId:f.alumni,role:'alumni'}),null);
 const found=await adminRepo.list({tab:'announcements',filter:'manual',search:'student',page:1,limit:100});assert.ok(found.rows.some(row=>Number(row.id)===Number(result.record.id)));
 const details=await admin.details(`notification:${result.record.id}`);assert.equal(details[0].audience_users.length,2);
 await adminRepo.expire(`notification:${result.record.id}`);
 assert.equal(await notifications.getByIdForUser({notificationId:result.record.id,userId:f.student,role:'student'}),null);
 assert.equal((await repo.summary(result.record.id,result.record.email_batch_id)).cancelled,1);
}));

test('database: selected memberships roll back together and scheduled inactive patrons never gain access',options,()=>fixture(async f=>{
 const notifications=require('../modules/notifications/notifications.repository');
 await assert.rejects(repo.publish({...f.base,audienceType:'users',audienceUserIds:[f.student,f.unverified],deliveryKey:'failed-'+f.prefix},{total:2,email:2}),e=>e.status===409);
 const [[rollback]]=await db.query('SELECT COUNT(*) AS total FROM notifications WHERE delivery_key=?',['failed-'+f.prefix]);assert.equal(Number(rollback.total),0);
 const queued=await admin.create({...f.base,audienceType:'users',audienceUserIds:[f.student,f.alumni],scheduledAt:new Date(Date.now()+3600000).toISOString(),confirmedRecipientCount:2,confirmedEmailCount:2},f.student);
 await db.query('UPDATE users SET is_active=0 WHERE id=?',[f.alumni]);
 await db.query('UPDATE delivery_outbox SET available_at=UTC_TIMESTAMP() WHERE id=?',[queued.queueId]);await outbox.drainOutbox();
 const [[notice]]=await db.query('SELECT id FROM notifications WHERE delivery_key=?',[queued.queueId]);
 const [members]=await db.query('SELECT user_id FROM notification_recipients WHERE notification_id=?',[notice.id]);assert.deepEqual(members.map(row=>Number(row.user_id)),[f.student]);
 await db.query('UPDATE users SET is_active=1 WHERE id=?',[f.alumni]);
 assert.equal(await notifications.getByIdForUser({notificationId:notice.id,userId:f.alumni,role:'alumni'}),null);
 await outbox.drainOutbox();const [[again]]=await db.query('SELECT COUNT(*) AS total FROM notification_recipients WHERE notification_id=?',[notice.id]);assert.equal(Number(again.total),1);
}));
test('database: manual mail uses the shared daily reserve, and quota-paused emails remain queued until midnight',options,()=>fixture(async f=>{
 const original=provider.provider.send;const captured=[];provider.provider.send=async message=>{captured.push(message);return '<test-receipt@example>';};
 try{
  const publication=await repo.publish(f.base);await outbox.drainOutbox();
  process.env.EMAIL_MODE='brevo';const c=settings.config();
  await db.query('INSERT INTO email_quota_usage(period_start,period_end,requests_used) VALUES (?,?,249) ON DUPLICATE KEY UPDATE requests_used=249',[c.periodStart,c.periodEnd]);
  await email.dispatchOne();await db.query('UPDATE email_dispatch_state SET next_send_at=NULL WHERE id=1');await email.dispatchOne();
  assert.equal(captured.length,1);assert.equal(captured[0].subject,f.prefix);
  const [[receipt]]=await db.query("SELECT JSON_UNQUOTE(JSON_EXTRACT(context_json,'$.providerMessageId')) AS receipt FROM email_deliveries WHERE notification_id=? AND status='accepted'",[publication.record.id]);assert.equal(receipt.receipt,'<test-receipt@example>');
  const counts=await repo.summary(publication.record.id,publication.record.email_batch_id);assert.equal(counts.accepted,1);assert.equal(counts.queued,1);
  const [[paused]]=await db.query("SELECT DATE_FORMAT(next_attempt_at,'%Y-%m-%d %H:%i:%s') AS next FROM email_deliveries WHERE notification_id=? AND status='queued'",[publication.record.id]);assert.equal(paused.next,`${c.periodEnd} 00:00:00`);
 }finally{provider.provider.send=original;}
}));

test('database: delivery pages partition history, filter before paging, search provider IDs and share allowance',options,()=>fixture(async f=>{
 const listing=require('../modules/email/email.admin');
 const ids=[];
 try{
  for(let index=0;index<33;index++){
   const id=randomUUID();ids.push(id);const priority=index===0?1:0,purpose=index===0?'recovery':index<30?'manual_notification':'overdue_summary';
   await db.query("INSERT INTO email_deliveries(id,user_id,recipient,purpose,dedupe_key,priority,status,expires_at,created_at,context_json) VALUES (?,?,?,?,?,?,'accepted',DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY),?,?)",[id,f.student,`${f.prefix}-${index}@example.edu`,purpose,id,priority,index===32?'2026-10-27 00:00:00':'2026-10-26 23:59:59',JSON.stringify({providerMessageId:`${f.prefix}-provider-${index}`,providerMode:'brevo'})]);
  }
  const manual=await listing.adminStatus({category:'manual',q:f.prefix,limit:'25'}),account=await listing.adminStatus({category:'account',q:f.prefix}),automated=await listing.adminStatus({category:'automated',q:f.prefix});
  assert.equal(manual.pagination.total,29);assert.equal(manual.rows.length,25);assert.equal(account.pagination.total,1);assert.equal(automated.pagination.total,3);
  assert.equal(manual.used,account.used);assert.equal(account.used,automated.used);assert.equal(manual.queuedRoutine,automated.queuedRoutine);
  const second=await listing.adminStatus({category:'manual',q:f.prefix,page:'2',limit:'25'});assert.equal(second.rows.length,4);assert.ok(second.rows.every(row=>!manual.rows.some(first=>first.id===row.id)));
  const filtered=await listing.adminStatus({category:'automated',q:f.prefix,to:'2026-10-26'});assert.equal(filtered.pagination.total,2);assert.ok(filtered.rows.every(row=>row.created_at==='2026-10-26T23:59:59Z'));
  const provider=await listing.adminStatus({category:'automated',q:`${f.prefix}-provider-32`});assert.equal(provider.pagination.total,1);
  const detail=await listing.adminDelivery(ids[32]);assert.equal(detail.provider_message_id,`${f.prefix}-provider-32`);assert.ok(!('content_encrypted' in detail));assert.ok(!('context_json' in detail));
 }finally{for(const id of ids)await db.query('DELETE FROM email_deliveries WHERE id=?',[id]);}
}));

test('database: notification images survive immediate and scheduled publication and recipient access stays scoped',options,()=>fixture(async f=>{
 const previous=process.env.CLOUDINARY_CLOUD_NAME;process.env.CLOUDINARY_CLOUD_NAME='test-cloud';
 const image={imageUrl:'https://res.cloudinary.com/test-cloud/image/upload/v123/library/notifications/poster.jpg',imagePublicId:'library/notifications/poster',imageAlt:'Library hours poster'};
 try{
  const notice=await admin.create({...f.base,...image,audienceType:'user',audienceUserId:f.student,sendEmail:false},f.student);
  const reader=require('../modules/notifications/notifications.service');
  const allowed=await reader.getByIdForUser({notificationId:notice.id,userId:f.student,role:'student'});assert.equal(allowed.image_url,image.imageUrl);assert.equal(allowed.image_alt,image.imageAlt);
  assert.equal(await reader.getByIdForUser({notificationId:notice.id,userId:f.alumni,role:'alumni'}),null);
  const emailed=await repo.publish({...f.base,...image});const [[stored]]=await db.query('SELECT image_public_id FROM notifications WHERE id=?',[emailed.record.id]);assert.equal(stored.image_public_id,image.imagePublicId);
  const [[delivery]]=await db.query('SELECT context_json FROM email_deliveries WHERE notification_id=? LIMIT 1',[emailed.record.id]);const context=typeof delivery.context_json==='string'?JSON.parse(delivery.context_json):delivery.context_json;assert.equal(context.notificationDetail,true);
  const originalSend=provider.provider.send,captured=[];provider.provider.send=async message=>{captured.push(message);};
  try{await outbox.drainOutbox();await email.dispatchOne();assert.equal(captured.length,1);assert.equal(captured[0].action_url,`https://library.example/my-library?view=updates&notification=${emailed.record.id}`);assert.equal(captured[0].image_url,image.imageUrl);assert.match(provider.renderEmail(captured[0],false).htmlContent,/<img /);}finally{provider.provider.send=originalSend;}
  const schedule=await admin.create({...f.base,...image,sendEmail:false,scheduledAt:new Date(Date.now()+3600000).toISOString(),confirmedRecipientCount:4},f.student);
  const details=await admin.details(`queue:${schedule.queueId}`);assert.equal(details[0].image_url,image.imageUrl);
  await db.query('UPDATE delivery_outbox SET available_at=UTC_TIMESTAMP() WHERE id=?',[schedule.queueId]);await outbox.drainOutbox();
  const [[published]]=await db.query('SELECT image_url,image_alt FROM notifications WHERE delivery_key=?',[schedule.queueId]);assert.equal(published.image_url,image.imageUrl);assert.equal(published.image_alt,image.imageAlt);
  await adminRepo.expire(`notification:${notice.id}`);assert.equal(await reader.getByIdForUser({notificationId:notice.id,userId:f.student,role:'student'}),null);
 }finally{if(previous===undefined)delete process.env.CLOUDINARY_CLOUD_NAME;else process.env.CLOUDINARY_CLOUD_NAME=previous;}
}));

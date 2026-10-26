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
  for(const notice of notices){await db.query('DELETE o FROM delivery_outbox o JOIN email_deliveries d ON BINARY d.id=BINARY o.id WHERE d.notification_id=?',[notice.id]);await db.query('DELETE FROM email_deliveries WHERE notification_id=?',[notice.id]);await db.query('DELETE FROM notifications WHERE id=?',[notice.id]);}
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

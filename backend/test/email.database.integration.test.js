const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const db=require('../db');
const accounts=require('../modules/auth/account-email.service');
const settings=require('../modules/email/email.config');
const enabled=process.env.RUN_DB_INTEGRATION==='1'&&/_test$/i.test(process.env.DB_NAME||'');

test('database: invitation completion is single-use under concurrency and verifies ownership', {skip:enabled?false:'requires RUN_DB_INTEGRATION=1 and dedicated *_test database with email migration'},async()=>{
 const previous={EMAIL_ENABLED:process.env.EMAIL_ENABLED,EMAIL_MODE:process.env.EMAIL_MODE,EMAIL_ENCRYPTION_KEY:process.env.EMAIL_ENCRYPTION_KEY};
 Object.assign(process.env,{EMAIL_ENABLED:'true',EMAIL_MODE:'capture',EMAIL_ENCRYPTION_KEY:'07'.repeat(32)});
 const identifier=`EMAIL-${randomUUID()}`,address=`${randomUUID()}@example.edu`;let userId;
 try{
  await accounts.transaction(async conn=>{
   const [result]=await conn.query("INSERT INTO users(student_employee_id,name,email,password_hash,role,is_active,must_change_password) VALUES (?,'Email integration',?,'unusable','staff',1,1)",[identifier,address]);userId=result.insertId;
   await accounts.invite(conn,{id:userId,student_employee_id:identifier,name:'Email integration',email:address});
  });
  const [[delivery]]=await db.query("SELECT content_encrypted FROM email_deliveries WHERE user_id=? AND purpose='setup'",[userId]);
  const message=settings.unprotect(delivery.content_encrypted),link=new URL(message.action_url),params=new URLSearchParams(link.hash.slice(1));
  const attempts=await Promise.allSettled([accounts.complete('setup',params.get('id'),params.get('token'),'ValidPassword123!'),accounts.complete('setup',params.get('id'),params.get('token'),'AnotherPassword123!')]);
  assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
  const [[user]]=await db.query('SELECT setup_pending,email_verified_at,must_change_password,session_version FROM users WHERE id=?',[userId]);
  assert.equal(user.setup_pending,0);assert.ok(user.email_verified_at);assert.equal(user.must_change_password,0);assert.equal(user.session_version,1);
  await assert.rejects(accounts.complete('reset',params.get('id'),params.get('token'),'ThirdPassword123!'));
 }finally{
  if(userId){await db.query("DELETE o FROM delivery_outbox o JOIN email_deliveries d ON d.id=o.id WHERE d.user_id=?",[userId]);for(const table of ['account_challenges','email_deliveries','email_address_claims'])await db.query(`DELETE FROM ${table} WHERE user_id=?`,[userId]);await db.query('DELETE FROM users WHERE id=?',[userId]);}
  for(const[key,value]of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});

test('database: account and invitation delivery roll back together', {skip:enabled?false:'requires RUN_DB_INTEGRATION=1 and dedicated *_test database with email migration'},async()=>{
 const identifier=`ROLLBACK-${randomUUID()}`;
 await assert.rejects(accounts.transaction(async conn=>{const [result]=await conn.query("INSERT INTO users(student_employee_id,name,password_hash,role) VALUES (?,'Rollback fixture','unusable','staff')",[identifier]);await conn.query("INSERT INTO email_deliveries(id,user_id,recipient,purpose,dedupe_key,expires_at) VALUES (?,?,?,'setup',?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY))",[randomUUID(),result.insertId,'fixture@example.edu',identifier]);throw new Error('intentional rollback');}));
 const [[users]]=await db.query('SELECT COUNT(*) AS count FROM users WHERE student_employee_id=?',[identifier]);const [[emails]]=await db.query('SELECT COUNT(*) AS count FROM email_deliveries WHERE dedupe_key=?',[identifier]);assert.equal(users.count,0);assert.equal(emails.count,0);
});

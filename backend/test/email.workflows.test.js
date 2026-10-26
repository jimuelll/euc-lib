const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../db');
const settings=require('../modules/email/email.config');
const delivery=require('../modules/email/email.service');
const transport=require('../modules/email/email.provider');
const accounts=require('../modules/auth/account-email.service');
const sessions=require('../modules/auth/authSession.service');
const sessionRepo=require('../modules/auth/auth-session.repository');
const snapshots=require('../modules/backup/snapshot.transforms');
const registry=require('../modules/backup/snapshot.registry');

async function env(work,extra={}) {
 const keys={EMAIL_ENABLED:'true',EMAIL_MODE:'capture',EMAIL_DAILY_LIMIT:'300',EMAIL_SECURITY_RESERVE:'50',BREVO_SENDER_NAME:'Enverga Library',EMAIL_ENCRYPTION_KEY:'04'.repeat(32),PUBLIC_APP_URL:'http://localhost:8080',...extra};
 const before=Object.fromEntries(Object.keys(keys).map(key=>[key,process.env[key]]));
 Object.assign(process.env,keys);
 try{return await work();}finally{for(const [key,value]of Object.entries(before))if(value===undefined)delete process.env[key];else process.env[key]=value;}
}

test('account email actions allow a super admin to manage their own account only',()=>env(async()=>{
 const original=db.getConnection;
 db.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},query:async sql=>{
  if(sql.startsWith('SELECT * FROM users'))return [[{id:42,role:'super_admin',is_active:1}]];
  if(sql.startsWith('SELECT requests,'))return [[{requests:1,elapsed:1,since:0}]];
  return [{affectedRows:1}];
 }});
 try {
  // An allowed action reaches the existing rate limiter before any email is queued.
  await assert.rejects(accounts.adminAction('super-one',42,'super_admin','verify'),{status:429});
  await assert.rejects(accounts.adminAction('super-one',99,'super_admin','verify'),{status:403});
  await assert.rejects(accounts.adminAction('super-one',42,'admin','verify'),{status:403});
 }finally{db.getConnection=original;}
}));
test('email encryption authenticates content and purpose-bound HMACs do not expose codes',()=>env(async()=>{
 const protectedValue=settings.protect({code:'123456',action_url:'https://example.org/#secret'});
 assert.ok(!protectedValue.includes('123456'));
 assert.deepEqual(settings.unprotect(protectedValue),{code:'123456',action_url:'https://example.org/#secret'});
 const bytes=Buffer.from(protectedValue,'base64');bytes[32]^=1;
 assert.throws(()=>settings.unprotect(bytes.toString('base64')));
 assert.notEqual(settings.secretHash('setup','same'),settings.secretHash('reset','same'));
}));
test('email input and password validation supports normalized addresses and rejects bcrypt truncation',()=>{
 assert.equal(settings.normalizeEmail(' Member@Example.edu '),'member@example.edu');
 for(const address of ['',null,'a@','a b@example.org','<a@example.org>'])assert.throws(()=>settings.normalizeEmail(address));
 assert.equal(accounts.validatePassword('valid-pass'),'valid-pass');
 assert.throws(()=>accounts.validatePassword('short'));
 assert.throws(()=>accounts.validatePassword('ç•Œ'.repeat(25)));
});
test('production email configuration fails closed and local capture performs no fetch',()=>env(async()=>{
 const oldFetch=global.fetch;let called=false;global.fetch=async()=>{called=true;throw new Error('must not contact network');};
 try{await transport.provider.send({recipient:'member@example.edu',name:'Member',subject:'Test',message:'Captured'},true);assert.equal(called,false);assert.equal(transport.capturedEmails.pop().recipient,'member@example.edu');}finally{global.fetch=oldFetch;}
 await env(async()=>assert.throws(settings.validateConfig,/Production email/),{NODE_ENV:'production'});
}));
test('Brevo uses documented request fields, treats 201 as acceptance, and classifies uncertain outcomes',()=>env(async()=>{
 const oldFetch=global.fetch;let request;
 try {
  global.fetch=async(url,options)=>{request={url,headers:options.headers,body:JSON.parse(options.body)};return new Response(JSON.stringify({messageId:'test-id'}),{status:201});};
  const message={recipient:'member@example.edu',name:'Member',subject:'Account',message:'Use this code',code:'123456'};
  await transport.provider.send(message,true);
  assert.equal(request.url,'https://api.brevo.com/v3/smtp/email');assert.equal(request.headers['api-key'],'private');assert.deepEqual(request.body.sender,{email:'library@example.edu',name:'Enverga Library'});assert.equal(request.body.to[0].email,message.recipient);assert.equal(request.body.subject,'Account');assert.match(request.body.htmlContent,/123456/);assert.match(request.body.textContent,/123456/);assert.ok(!JSON.stringify(request.body).includes('private'));
  global.fetch=async()=>new Response('do not log this secret',{status:429,headers:{'Retry-After':'20'}});
  await assert.rejects(transport.provider.send(message,true),error=>error.kind==='retry'&&error.retryAfterSeconds===20&&!error.message.includes('secret'));
  for(const status of [503,408,200,202]){global.fetch=async()=>new Response('',{status});await assert.rejects(transport.provider.send(message,true),error=>error.kind==='unknown');}
  global.fetch=async()=>{throw new Error('timeout');};await assert.rejects(transport.provider.send(message,true),error=>error.kind==='unknown');
  global.fetch=async()=>new Response('private provider detail',{status:400});await assert.rejects(transport.provider.send(message,true),error=>error.kind==='permanent'&&!error.message.includes('detail'));
 }finally{global.fetch=oldFetch;}
},{EMAIL_MODE:'brevo',BREVO_API_KEY:'private',BREVO_SENDER_EMAIL:'library@example.edu'}));

test('Brevo renders escaped account and library content without active HTML or unsafe links',()=>env(async()=>{
 const message={recipient:'member@example.edu',name:'<script>alert(1)</script>',subject:'<Account>',message:'Line one\nLine two',login_identifier:'ID&123',code:'123456',action_url:'https://library.example/#token=a&next=b',action_label:'Open <account>',as_of:'Today',loans:[{title:'<Book>',due:'Tomorrow',balance:'12.50'}]};
 const account=transport.renderEmail(message,true),library=transport.renderEmail(message,false);
 assert.ok(!account.htmlContent.includes('<script>'));assert.match(account.htmlContent,/&lt;script&gt;/);assert.match(account.htmlContent,/ID&amp;123/);assert.match(account.htmlContent,/token=a&amp;next=b/);assert.match(account.htmlContent,/Line one<br>Line two/);
 assert.match(library.htmlContent,/&lt;Book&gt;/);assert.match(library.textContent,/Unsettled balance: PHP 12.50/);assert.match(library.textContent,/Balances as of Today/);assert.ok(!library.textContent.includes('123456'));
 assert.throws(()=>transport.prepareEmailRequest({...message,action_url:'javascript:alert(1)'},true),error=>error.kind==='permanent');
 assert.throws(()=>transport.prepareEmailRequest({...message,message:'x'.repeat(50_000)},true),error=>error.kind==='permanent');
}));

test('live Brevo configuration requires credentials, sender and validates the daily limit',()=>env(async()=>{
 settings.validateConfig();
 await env(async()=>assert.throws(settings.validateConfig,/BREVO_API_KEY/),{EMAIL_MODE:'brevo',BREVO_API_KEY:''});
 await env(async()=>assert.throws(settings.validateConfig,/valid email/),{EMAIL_MODE:'brevo',BREVO_SENDER_EMAIL:'invalid'});
 await env(async()=>assert.throws(settings.validateConfig,/quota/),{EMAIL_MODE:'brevo',EMAIL_DAILY_LIMIT:'0'});
 await env(async()=>assert.throws(settings.validateConfig,/Invalid email mode/),{EMAIL_MODE:'emailjs'});
 await env(async()=>settings.validateConfig(),{EMAIL_MODE:'brevo',NODE_ENV:'production',PUBLIC_APP_URL:'https://library.example'});
},{EMAIL_MODE:'brevo',BREVO_API_KEY:'private',BREVO_SENDER_EMAIL:'library@example.edu'}));

async function dispatchFixture(work,{used=0,priority=0,waiting=false,eligible=true,sendError=null}={}){
 return env(async()=>{
  const original={get:db.getConnection,query:db.query,send:transport.provider.send};
  const calls=[];let sent=0;
  const row={id:'delivery-1',user_id:7,recipient:'member@example.edu',purpose:priority?'password_changed':'borrowing_created',priority,challenge_id:null,content_encrypted:settings.protect({recipient:'member@example.edu',name:'Member',subject:'Notice',message:'Content'}),context_json:{},attempts:0,status:'queued'};
  const query=async(sql,values)=>{
   calls.push({sql,values});
   if(sql.includes('GET_LOCK'))return [[{acquired:1}]];
   if(sql.includes('SELECT mode'))return [[{mode:'idle'}]];
   if(sql.includes('AS waiting'))return [[{waiting:waiting?1:0}]];
   if(sql.includes('SELECT d.*'))return [[row]];
   if(sql.includes('SELECT id,email,pending_email'))return [[{id:7,email:'member@example.edu',name:'Member',is_active:1,deleted_at:null,setup_pending:0,email_verified_at:eligible?'2026-01-01':null}]];
   if(sql.includes('SELECT requests_used'))return [[{requests_used:used}]];
   return [{affectedRows:1}];
  };
  db.getConnection=async()=>({query,beginTransaction:async()=>calls.push({sql:'BEGIN'}),commit:async()=>calls.push({sql:'COMMIT'}),rollback:async()=>calls.push({sql:'ROLLBACK'}),release(){}});
  db.query=query;transport.provider.send=async()=>{sent++;if(sendError)throw sendError;};
  try{await work({calls,sent:()=>sent});}finally{db.getConnection=original.get;db.query=original.query;transport.provider.send=original.send;}
 },{EMAIL_MODE:'brevo',EMAIL_DAILY_LIMIT:'300',EMAIL_SECURITY_RESERVE:'50'});
}
test('quota reserves final 50 requests for account mail and stops every category at total limit',async()=>{
 await dispatchFixture(async f=>{await delivery.dispatchOne();assert.equal(f.sent(),1);},{used:249});
 await dispatchFixture(async f=>{await delivery.dispatchOne();assert.equal(f.sent(),0);assert.ok(f.calls.some(c=>c.sql.includes('Paused by daily email quota')));},{used:250});
 await dispatchFixture(async f=>{await delivery.dispatchOne();assert.equal(f.sent(),1);assert.ok(f.calls.some(c=>c.sql.includes('requests_used=requests_used+1')));},{used:250,priority:1});
 await dispatchFixture(async f=>{await delivery.dispatchOne();assert.equal(f.sent(),1);},{used:299,priority:1});
 await dispatchFixture(async f=>{await delivery.dispatchOne();assert.equal(f.sent(),0);},{used:300,priority:1});
});

test('daily quota rolls at UTC midnight and ignores obsolete monthly environment settings',()=>env(async()=>{
 assert.equal(settings.config().limit,300);
 assert.deepEqual(settings.dailyQuotaPeriod(new Date('2026-12-31T23:59:59.999Z')),{periodStart:'2026-12-31',periodEnd:'2027-01-01'});
 assert.deepEqual(settings.dailyQuotaPeriod(new Date('2027-01-01T00:00:00Z')),{periodStart:'2027-01-01',periodEnd:'2027-01-02'});
 assert.deepEqual(settings.dailyQuotaPeriod(new Date('2028-02-29T12:00:00Z')),{periodStart:'2028-02-29',periodEnd:'2028-03-01'});
},{EMAIL_DAILY_LIMIT:'300',EMAIL_MONTHLY_LIMIT:'200',EMAIL_QUOTA_PERIOD_START:'2000-01-01',EMAIL_QUOTA_PERIOD_END:'2000-02-01'}));

test('dispatch reuses the persisted daily counter and defers exhausted mail until midnight',async()=>{
 const period=settings.dailyQuotaPeriod();
 await dispatchFixture(async f=>{
  await delivery.dispatchOne();assert.equal(f.sent(),0);
  const read=f.calls.find(call=>call.sql.includes('SELECT requests_used'));
  assert.deepEqual(read.values,[period.periodStart]);
  const pause=f.calls.find(call=>call.sql.includes('Paused by daily email quota'));
  assert.equal(pause.values[0],`${period.periodEnd} 00:00:00`);
  assert.ok(!f.calls.some(call=>call.sql.includes('requests_used=requests_used+1')));
 },{used:300,priority:1});
 await dispatchFixture(async f=>{await delivery.dispatchOne();assert.equal(f.sent(),1);},{used:0,priority:1});
});
test('shared rate slot and recipient eligibility prevent sends before quota reservation',async()=>{
 for(const options of [{waiting:true},{eligible:false}])await dispatchFixture(async f=>{await delivery.dispatchOne();assert.equal(f.sent(),0);assert.ok(!f.calls.some(c=>c.sql.includes('requests_used=requests_used+1')));},options);
});
test('ambiguous sends become unknown without retry; explicit rate rejection schedules a retry',async()=>{
 await dispatchFixture(async f=>{await delivery.dispatchOne();const finish=f.calls.find(c=>c.sql.includes('accepted_at=CASE'));assert.equal(finish.values[0],'unknown');},{sendError:new transport.SendFailure('unknown','Timeout')});
 await dispatchFixture(async f=>{await delivery.dispatchOne();assert.ok(f.calls.some(c=>c.sql.includes("status='queued'")&&c.values?.[0]>=20));},{sendError:new transport.SendFailure('retry','Rate limit',20)});
});
test('Manila digest date rolls at Philippine midnight independently of host timezone',()=>env(async()=>{
 assert.deepEqual(delivery.localClock(new Date('2026-10-20T15:59:00Z')),{date:'2026-10-20',time:'23:59'});
 assert.deepEqual(delivery.localClock(new Date('2026-10-20T16:00:00Z')),{date:'2026-10-21',time:'00:00'});
},{EMAIL_DIGEST_TIMEZONE:'Asia/Manila'}));
test('per-account version invalidates legacy access/refresh signatures after recovery',async()=>{
 const before=sessionRepo.getInvalidBefore,version=sessionRepo.getSessionVersion;
 sessionRepo.getInvalidBefore=async()=>null;sessionRepo.getSessionVersion=async()=>1;
 try{assert.equal(await sessions.isAccessTokenCurrent({id:7}),false);assert.equal(await sessions.isAccessTokenCurrent({id:7,session_version:0}),false);assert.equal(await sessions.isAccessTokenCurrent({id:7,session_version:1}),true);}finally{sessionRepo.getInvalidBefore=before;sessionRepo.getSessionVersion=version;}
});
test('snapshot upgrade preserves legacy access and excludes live challenges/quota/delivery controls',()=>{
 const payload={format:'euc-library-backup',version:17,tables:{users:[{id:7,email:'member@example.edu',password_hash:'keep',must_change_password:1}]}};
 payload.integrity={algorithm:'sha256',checksum:snapshots.payloadChecksum(payload)};
 const upgraded=snapshots.upgradeBackup(payload),user=upgraded.tables.users[0];
 assert.equal(upgraded.version,18);assert.equal(user.password_hash,'keep');assert.equal(user.setup_pending,0);assert.equal(user.email_verified_at,null);assert.equal(user.session_version,0);assert.equal(user.must_change_password,1);
 for(const name of ['account_challenges','email_deliveries','email_quota_usage','email_request_limits','email_dispatch_state','email_address_claims']){assert.ok(registry.SYSTEM_TABLES.includes(name));assert.ok(!registry.APPLICATION_TABLES.includes(name));}
});

test('failed recovery codes consume persistent attempts; exhausted challenges cannot reset a password',()=>env(async()=>{
 const original=db.getConnection;let attempts=0,committed=0,resetIssued=0;
 const id='11111111-1111-4111-8111-111111111111';
 db.getConnection=async()=>({
  beginTransaction:async()=>{},commit:async()=>{committed++;},rollback:async()=>{},release(){},
  query:async(sql)=>{
   if(sql.includes('SELECT * FROM users'))return [[{id:7,email:'member@example.edu',is_active:1,email_verified_at:'2026-01-01',setup_pending:0}]];
   if(sql.includes('SELECT * FROM account_challenges'))return [[{id,user_id:7,attempts,secret_hash:settings.secretHash('recovery',`${id}:123456`)}]];
   if(sql.includes('attempts=attempts+1'))attempts++;
   if(sql.includes('INSERT INTO account_challenges'))resetIssued++;
   return [{affectedRows:1}];
  }
 });
 try{
  for(let index=0;index<5;index++)await assert.rejects(accounts.verifyRecovery('member@example.edu','000000'),/invalid or expired/);
  assert.equal(attempts,5);assert.equal(committed,5);
  await assert.rejects(accounts.verifyRecovery('member@example.edu','123456'),/invalid or expired/);assert.equal(resetIssued,0);
 }finally{db.getConnection=original;}
}));

test('recovery requests do not expose unknown accounts and obey persistent cooldown',()=>env(async()=>{
 const original=db.getConnection;let userReads=0,windowRequests=0;
 db.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},query:async(sql)=>{
  if(sql.includes('SELECT requests,'))return [[{requests:windowRequests,elapsed:10,since:windowRequests?1:100}]];
  if(sql.includes('UPDATE email_request_limits'))windowRequests++;
  if(sql.includes('SELECT * FROM users')){userReads++;return [[]];}
  return [{affectedRows:1}];
 }});
 try{
  const first=await accounts.requestRecovery('unknown@example.edu','127.0.0.1');
  const second=await accounts.requestRecovery('unknown@example.edu','127.0.0.1');
  assert.deepEqual(first,second);assert.ok(!Object.hasOwn(first,'token'));assert.ok(userReads<=1);assert.ok(windowRequests<=2);
 }finally{db.getConnection=original;}
}));

test('refresh issuance keeps the authenticated version rather than adopting a concurrent password reset',async()=>{
 const old=sessionRepo.createRefreshSession;sessionRepo.createRefreshSession=async()=>{};
 try{const token=await sessions.issueRefreshSession(7,new Date(Date.now()+60000),false,3);assert.equal(require('../modules/auth/jwt.util').verifyRefreshToken(token).session_version,3);}finally{sessionRepo.createRefreshSession=old;}
});
test('restored pending in-app jobs cannot recreate external email deliveries',()=>env(async()=>{
 const original=db.getConnection;db.getConnection=async()=>assert.fail('Restored jobs must not queue email');
 try{await delivery.queueNotification({suppressEmail:true,type:'reservation_ready',audienceType:'user',audienceUserId:7},'restored-event');}finally{db.getConnection=original;}
},{EMAIL_ROUTINE_ENABLED:'true'}));
test('overdue summary includes zero-fine loans and refreshes balances through the existing ledger',()=>env(async()=>{
 const ledger=require('../modules/borrowing/fine-ledger.service'),library=require('../modules/library-settings/library-settings.service');
 const original={assess:ledger.assessBorrowing,balances:ledger.balancesForBorrowings,settings:library.getSettings};
 const assessed=[];let sql;
 ledger.assessBorrowing=async row=>{assessed.push(row);};ledger.balancesForBorrowings=async()=>new Map([[1,{balance:0}],[2,{balance:12.5}]]);library.getSettings=async()=>({overdue_fine_per_hour:1});
 const connection={query:async statement=>{sql=statement;return [[{id:1,title:'Zero-fine loan',due_date:'2026-10-01T00:00:00Z',fine_per_hour:0},{id:2,title:'Other loan',due_date:'2026-10-02T00:00:00Z',fine_per_hour:1}]];}};
 try{const loans=await delivery.overdueLoans(7,connection);assert.equal(loans.length,2);assert.equal(loans[0].balance,'0.00');assert.equal(loans[1].balance,'12.50');assert.equal(assessed.length,2);assert.equal(assessed[0].fine_per_hour,0);assert.ok(sql.includes("status IN ('borrowed','overdue')"));assert.ok(sql.includes('FOR UPDATE'));}finally{ledger.assessBorrowing=original.assess;ledger.balancesForBorrowings=original.balances;library.getSettings=original.settings;}
}));
test('worker failures back off and redact error details instead of logging on every tick',()=>env(async()=>{
 const getConnection=db.getConnection,interval=global.setInterval,now=Date.now,log=console.error,info=console.info;
 let clock=100_000,tick,attempts=0;const logs=[];
 Date.now=()=>clock;console.error=message=>logs.push(message);console.info=()=>{};
 global.setInterval=callback=>{tick=callback;return {unref(){}};};
 db.getConnection=async()=>{attempts++;throw Object.assign(new Error('private@example.edu secret token SQL'),{code:'ER_CANT_AGGREGATE_2COLLATIONS'});};
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 try {
  delivery.startEmailJob();await flush();assert.equal(attempts,1);assert.equal(logs.length,1);assert.match(logs[0],/ER_CANT_AGGREGATE_2COLLATIONS/);assert.ok(!logs[0].includes('secret'));
  clock+=1200;tick();await flush();assert.equal(attempts,1);
  clock=105_000;tick();await flush();assert.equal(attempts,2);assert.equal(logs.length,1);
  clock=106_200;tick();await flush();assert.equal(attempts,2);
  assert.equal(delivery.workerFailureCode({code:'private@example.edu'}),'INTERNAL_ERROR');
 }finally{db.getConnection=getConnection;global.setInterval=interval;Date.now=now;console.error=log;console.info=info;}
},{EMAIL_ROUTINE_ENABLED:'false'}));

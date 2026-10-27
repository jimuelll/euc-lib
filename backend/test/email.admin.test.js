const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../db');
const admin=require('../modules/email/email.admin');
if(require.main===module)test.after(()=>db.end());
test('delivery filters validate categories, dates, paging and untrusted query shapes',()=>{
 assert.equal(admin.deliveryFilters().limit,100);
 assert.equal(admin.deliveryFilters({category:'manual'}).limit,25);
 for(const query of [{category:'bad'},{status:'sent'},{limit:'500'},{page:'0'},{page:'1.5'},{q:['a']},{from:'2026-02-30'},{from:'2026-10-29',to:'2026-10-28'},{purpose:'x OR 1=1'},{sort:'DESC;DROP TABLE users'}])assert.throws(()=>admin.deliveryFilters(query),e=>e.status===400);
});
test('delivery queries partition historical records and parameterize recipient or provider searches',()=>{
 const account=admin.deliveryWhere(admin.deliveryFilters({category:'account'}));assert.match(account.sql,/priority=1/);
 const manual=admin.deliveryWhere(admin.deliveryFilters({category:'manual'}));assert.match(manual.sql,/purpose='manual_notification'/);
 const automatic=admin.deliveryWhere(admin.deliveryFilters({category:'automated'}));assert.match(automatic.sql,/purpose<>'manual_notification'/);
 const filters=admin.deliveryFilters({category:'manual',status:'failed',q:"a%_!'",purpose:'manual_notification',from:'2026-10-01',to:'2026-10-27'});
 const where=admin.deliveryWhere(filters);assert.ok(!where.sql.includes(filters.q));assert.equal(where.values[0],"%a!%!_!!'%");assert.equal(where.values.at(-1),'failed');assert.match(where.sql,/DATE_ADD/);
 assert.ok(!admin.deliveryWhere(filters,false).values.includes('failed'));
 assert.deepEqual(admin.deliveryWhere(filters,true,true).values,[]);
});
test('delivery listing counts before paging, returns shared capacity, and exposes safe metadata only',async()=>{
 const original=db.query,queries=[];
 db.query=async(sql,values)=>{queries.push({sql,values});
  if(sql.includes('email_quota_usage'))return [[{requests_used:240}]];
  if(sql.includes('GROUP BY status'))return [[{status:'failed',total:26},{status:'accepted',total:4}]];
  if(sql.includes('SELECT DISTINCT'))return [[{purpose:'overdue_summary'}]];
  if(sql.includes("priority=0 AND status='queued'"))return [[{total:15}]];
  return [[{id:'delivery',status:'failed',purpose:'overdue_summary'}]];
 };
 const old={EMAIL_DAILY_LIMIT:process.env.EMAIL_DAILY_LIMIT,EMAIL_SECURITY_RESERVE:process.env.EMAIL_SECURITY_RESERVE};Object.assign(process.env,{EMAIL_DAILY_LIMIT:'300',EMAIL_SECURITY_RESERVE:'50'});
 try{
  const result=await admin.adminStatus({category:'automated',status:'failed',page:'999',limit:'25'});
  assert.deepEqual(result.pagination,{page:2,limit:25,total:26,totalPages:2});assert.equal(result.statusTotals.accepted,4);assert.equal(result.statusTotals.unknown,0);
  assert.equal(result.routineRemaining,10);assert.equal(result.queuedRoutine,15);assert.equal(result.routineAfterQueue,0);
  const listing=queries.find(q=>q.sql.includes('LIMIT ? OFFSET ?'));assert.deepEqual(listing.values.slice(-2),[25,25]);assert.match(listing.sql,/created_at DESC,id DESC/);
  assert.doesNotMatch(listing.sql,/content_encrypted|SELECT \*/);assert.match(listing.sql,/providerMessageId/);
  await assert.rejects(admin.adminDelivery('bad'),e=>e.status===404);
 }finally{db.query=original;for(const[key,value]of Object.entries(old))if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
test('delivery list, detail and retry authorize super admins only',async()=>{
 const jwt=require('../modules/auth/jwt.util'),sessions=require('../modules/auth/authSession.service');
 const original={verify:jwt.verifyAccessToken,current:sessions.isAccessTokenCurrent,active:sessions.isUserAccessActive};
 const paths=['../modules/auth/auth.middleware','../modules/auth/account-email.routes'];const cached=paths.map(path=>[require.resolve(path),require.cache[require.resolve(path)]]);
 jwt.verifyAccessToken=token=>({id:3,role:token});sessions.isAccessTokenCurrent=async()=>true;sessions.isUserAccessActive=async()=>true;
 for(const[path]of cached)delete require.cache[path];
 try{
  const router=require(paths[1]).adminRouter;
  for(const path of ['/email-deliveries','/email-deliveries/:id','/email-deliveries/:id/retry']){
   const gate=router.stack.find(layer=>layer.route?.path===path).route.stack[0].handle;
   for(const role of ['student','alumni','employee','scanner','staff','admin','super_admin']){let next=false,status;await gate({headers:{authorization:`Bearer ${role}`}},{status(code){status=code;return this;},json(){}},()=>{next=true;});assert.equal(next,role==='super_admin');if(!next)assert.equal(status,403);}
  }
 }finally{jwt.verifyAccessToken=original.verify;sessions.isAccessTokenCurrent=original.current;sessions.isUserAccessActive=original.active;for(const[path,value]of cached)if(value)require.cache[path]=value;else delete require.cache[path];}
});

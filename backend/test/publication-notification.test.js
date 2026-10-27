const test=require("node:test");
const assert=require("node:assert/strict");
const db=require("../db");
const email=require("../modules/notifications/notifications.email.service");
const repository=require("../modules/notifications/notifications.email.repository");
const service=require("../modules/notifications/publication-notification.service");
const bulletin=require("../modules/bulletin/bulletin.service");
if(require.main===module)test.after(async()=>db.end());
test("quick publication checks permissions and recipient counts and reuses its original result",async()=>{
 const previous={connection:db.getConnection,preview:email.preview,publish:repository.publishInTransaction};let existing=false,created=0,published=0,rolled=0,released=0;
 const conn={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{rolled++;},release:()=>{released++;},query:async(sql)=>sql.includes("GET_LOCK")?[[{acquired:1}]]:sql.includes("source_id")?[existing?[{source_id:21}]:[]]:[[]]};
 db.getConnection=async()=>conn;email.preview=async()=>({enabled:true,inAppCount:4,emailCount:3});repository.publishInTransaction=async(_conn,input,counts)=>{published++;assert.equal(input.sourceId,21);assert.equal(input.href,"/bulletin?post=21");assert.deepEqual(counts,{total:4,email:3});};
 const notice={total:4,email:3,requestId:"e541fb29-9894-4d9c-9a49-bdca47b2f833"};
 try{
  await assert.rejects(bulletin.createPost({id:1,role:"staff"},{title:"Post",content:"Text",is_pinned:false,notifyUsers:notice}),e=>e.status===403);
  await assert.rejects(service.publishWithNotice("bulletin",1,{...notice,email:2},"Post","Text",{},async()=>{created++;return 21;}),e=>e.status===409);
  assert.equal(created,0);assert.equal(rolled,1);
  assert.deepEqual(await service.publishWithNotice("bulletin",1,notice,"Post","Text",{},async()=>{created++;return 21;}),{id:21});
  existing=true;assert.deepEqual(await service.publishWithNotice("bulletin",1,notice,"Post","Text",{},async()=>{created++;return 22;}),{id:21});
  assert.equal(created,1);assert.equal(published,1);assert.equal(released,3);
  existing=false;repository.publishInTransaction=async()=>{throw new Error("queue failed");};
  await assert.rejects(service.publishWithNotice("events",1,notice,"Event","Text",{},async()=>22),/queue failed/);
  assert.equal(rolled,2,"a queue error rolls back the content transaction");
 } finally{db.getConnection=previous.connection;email.preview=previous.preview;repository.publishInTransaction=previous.publish;}
});

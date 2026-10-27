const test = require("node:test");
const assert = require("node:assert/strict");
const repository = require("../modules/publishing/publishing.repository");
const audit = require("../modules/analytics/transactional-audit");
const service = require("../modules/publishing/publishing.service");
const notificationEmail = require("../modules/notifications/notifications.email.service");
const notificationRepository = require("../modules/notifications/notifications.email.repository");
const { digest, validateDraft, validatePublished } = require("../modules/publishing/publishing.validation");
if (require.main === module) test.after(async () => require("../db").end());

test("drafts allow incomplete records; publication validates dates, IDs, and safe URLs", () => {
  assert.doesNotThrow(() => validateDraft({items:[{title:""}]}));
  assert.throws(() => validatePublished("events",{items:[{title:""}]},{items:[]}), /Complete title/);
  assert.throws(() => validatePublished("events",{items:[{title:"Workshop",starts_at:"invalid"}]},{items:[]}), /valid event start/);
  assert.throws(() => validatePublished("subscriptions",{items:[{title:"Resource",url:"javascript:alert(1)"}]},{items:[]}), /http or https/);
  assert.throws(() => validatePublished("events",{items:[]},{items:[{id:1}]}), /missing/);
  assert.throws(() => validatePublished("events",{items:[{id:2,deleted:true}]},{items:[{id:1}]}), /Records changed/);
});

test("individual publication retains other saved drafts; publish all rolls back every section on failure",async()=>{
  const keys=["getConnection","lockDraft","readLive","writeDraft","writeLive","markPublished","writeItemMeta"];
  const originals=Object.fromEntries(keys.map(key=>[key,repository[key]]));const originalAudit=audit.enqueueTransactionalAudit;
  const originalPreview=notificationEmail.preview,originalPublish=notificationRepository.publishInTransaction;
  let lives={events:{items:[{id:1,title:"First",starts_at:"2027-01-01T09:00:00"},{id:2,title:"Second",starts_at:"2027-01-02T09:00:00"}]},subscriptions:{items:[{id:3,title:"Resource",url:"https://example.test"}]}};
  let rows=Object.fromEntries(Object.keys(lives).map(section=>[section,{section,revision:0,draft_json:null,base_json:null,item_meta_json:null,saved_at:null,published_at:null}]));let snapshot;
  repository.getConnection=async()=>({beginTransaction:async()=>{snapshot=structuredClone({lives,rows});},commit:async()=>{},rollback:async()=>{lives=snapshot.lives;rows=snapshot.rows;},release:()=>{}});
  repository.lockDraft=async(_conn,kind)=>structuredClone(rows[kind]);repository.readLive=async(_conn,kind)=>structuredClone(lives[kind]);
  repository.writeDraft=async(_conn,kind,payload,base)=>{Object.assign(rows[kind],{draft_json:payload?JSON.stringify(payload):null,base_json:base?JSON.stringify(base):null,revision:rows[kind].revision+1});};
  repository.writeLive=async(_conn,kind,payload)=>{lives[kind]=structuredClone({items:payload.items.filter(item=>!item.deleted).map(item=>item.id?item:{...item,id:99})});};
  repository.markPublished=async(_conn,kind)=>{Object.assign(rows[kind],{draft_json:null,base_json:null,published_at:"2026-10-08T09:00:00",revision:rows[kind].revision+1});};
  repository.writeItemMeta=async(_conn,kind,meta)=>{rows[kind].item_meta_json=JSON.stringify(meta);};audit.enqueueTransactionalAudit=async()=>{};
  try{
    let doc=await service.read("events");const working={items:doc.payload.items.map(item=>({...item,title:item.title+" draft"}))};
    doc=await service.mutate("events","draft",{...doc,payload:working,itemKey:"1"},1);
    assert.equal(doc.payload.items.find(item=>item.id===2).title,"Second","save only selected item");
    doc=await service.mutate("events","draft",{...doc,payload:working,itemKey:"2"},1);
    doc=await service.mutate("events","publish",{...doc,payload:working,itemKey:"1"},1);
    assert.equal(lives.events.items.find(item=>item.id===1).title,"First draft");assert.equal(lives.events.items.find(item=>item.id===2).title,"Second");
    assert.equal(doc.payload.items.find(item=>item.id===2).title,"Second draft");assert.equal(doc.draftCount,1);assert.ok(doc.itemMeta["1"].lastPublished);
    const sub=await service.read("subscriptions");const before=structuredClone(lives);
    await assert.rejects(service.publishAll({documents:[{...doc,section:"events"},{...sub,section:"subscriptions",payload:{items:[{...sub.payload.items[0],url:"javascript:bad"}]}}]},1),/http or https/);
    assert.deepEqual(lives,before,"first section publication rolled back when second failed");
    const results=await service.publishAll({documents:[{...doc,section:"events"},{...sub,section:"subscriptions"}]},1);assert.equal(results.length,2);assert.equal(lives.events.items.find(item=>item.id===2).title,"Second draft");
    let fresh=await service.read("events");const added={items:[...fresh.payload.items,{_key:"new",title:"New",starts_at:"2027-02-01T09:00:00"}]};
    notificationEmail.preview=async()=>({enabled:true,inAppCount:4,emailCount:3});
    let delivery;notificationRepository.publishInTransaction=async(_conn,input,counts)=>{delivery={input,counts};};
    await assert.rejects(service.mutate("events","publish",{...fresh,payload:added,itemKey:"new",notifyUsers:{total:4,email:2}},1),/recipient counts changed/);
    assert.equal(lives.events.items.length,2);
    notificationRepository.publishInTransaction=async()=>{throw new Error("queue failed");};
    await assert.rejects(service.mutate("events","publish",{...fresh,payload:added,itemKey:"new",notifyUsers:{total:4,email:3}},1),/queue failed/);
    assert.equal(lives.events.items.length,2,"queue failure rolls back publication");
    notificationRepository.publishInTransaction=async(_conn,input,counts)=>{delivery={input,counts};};
    const created=await service.mutate("events","publish",{...fresh,payload:added,itemKey:"new",notifyUsers:{total:4,email:3}},1);assert.equal(created.resolvedKey,"99");
    assert.equal(delivery.input.href,"/bulletin#upcoming-events");assert.equal(delivery.input.deliveryKey,"publication:events:99");assert.deepEqual(delivery.counts,{total:4,email:3});
    await assert.rejects(service.mutate("events","publish",{...created,payload:created.payload,itemKey:"99",notifyUsers:{total:4,email:3}},1),/only be sent/);
  }finally{Object.assign(repository,originals);audit.enqueueTransactionalAudit=originalAudit;notificationEmail.preview=originalPreview;notificationRepository.publishInTransaction=originalPublish;}
});

test("published guide addresses cannot be changed",()=>{
  const module={id:1,title:"Guide",slug:"old",published_slug:"old",summary:"Summary",overview:"Overview",audience_roles:["staff"],steps:[{title:"Step",body:"Do this"}]};
  assert.throws(()=>validatePublished("guide",{items:[{...module,slug:"new"}]},{items:[module]}),/addresses are locked/);
});

test("discard also restores a previously saved legacy guide draft", async () => {
  const guide=require("../modules/user-guide/user-guide.service");
  const keys=["getConnection","lockDraft","readLive","writeDraft","discardLegacyGuideDraft"];
  const originals=Object.fromEntries(keys.map(key=>[key,repository[key]]));
  const originalPrepare=guide.listForAdmin,originalAudit=audit.enqueueTransactionalAudit;
  let restored=false,revision=0;
  guide.listForAdmin=async()=>[];
  repository.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{}});
  repository.lockDraft=async()=>({section:"guide",revision,draft_json:null,base_json:null,saved_at:null,published_at:null});
  repository.readLive=async()=>({items:[{id:1,title:restored?"Published module":"Old draft",is_published:true,has_unpublished_changes:!restored}]});
  repository.writeDraft=async()=>{revision++;};
  repository.discardLegacyGuideDraft=async()=>{restored=true;};
  audit.enqueueTransactionalAudit=async()=>{};
  try {
    const initial=await service.read("guide");
    assert.equal(initial.hasDraft,true);assert.equal(initial.draftCount,1);
    const discarded=await service.mutate("guide","discard",initial,1);
    assert.equal(discarded.hasDraft,false);assert.equal(discarded.payload.items[0].title,"Published module");
  } finally {Object.assign(repository,originals);guide.listForAdmin=originalPrepare;audit.enqueueTransactionalAudit=originalAudit;}
});

test("save, publish, conflicts, discard, and failed publication preserve transaction boundaries", async () => {
  const originals = Object.fromEntries(["getConnection","lockDraft","readLive","writeDraft","writeLive","markPublished","writeItemMeta"].map(key=>[key,repository[key]]));
  const originalAudit = audit.enqueueTransactionalAudit;
  let live={items:[{id:1,title:"Workshop",starts_at:"2027-01-01T09:00:00",ends_at:null}]};
  let row={section:"events",revision:0,draft_json:null,base_json:null,saved_at:null,published_at:null};
  let writes=0,commits=0,rollbacks=0,snapshot;
  repository.getConnection=async()=>({beginTransaction:async()=>{snapshot=structuredClone({live,row});},commit:async()=>{commits++;},rollback:async()=>{live=snapshot.live;row=snapshot.row;rollbacks++;},release:()=>{}});
  repository.lockDraft=async()=>structuredClone(row);
  repository.readLive=async()=>structuredClone(live);
  repository.writeDraft=async(_conn,_kind,payload,base)=>{row.draft_json=payload?JSON.stringify(payload):null;row.base_json=base?JSON.stringify(base):null;row.saved_at=payload?"2026-10-08T09:00:00":null;row.revision++;};
  repository.writeLive=async(_conn,_kind,payload)=>{writes++;live=structuredClone(payload);};
  repository.markPublished=async()=>{row.draft_json=null;row.base_json=null;row.saved_at=null;row.published_at="2026-10-08T10:00:00";row.revision++;};
  repository.writeItemMeta=async()=>{};
  audit.enqueueTransactionalAudit=async()=>{};
  try {
    const initial=await service.read("events");
    const working={items:[{...live.items[0],title:"Changed workshop"}]};
    const saved=await service.mutate("events","draft",{...initial,payload:working},1);
    assert.equal(saved.hasDraft,true);assert.equal(saved.draftCount,1);assert.equal(saved.lastPublished,null);
    assert.equal(live.items[0].title,"Workshop");assert.equal(writes,0);
    await assert.rejects(service.mutate("events","publish",{...initial,payload:working},1),error=>error.status===409);
    const published=await service.mutate("events","publish",{...saved,payload:working},1);
    assert.equal(live.items[0].title,"Changed workshop");assert.equal(published.hasDraft,false);assert.ok(published.lastPublished);
    const next=await service.mutate("events","draft",{...published,payload:{items:[{...live.items[0],title:"Another draft"}]}},1);
    const discarded=await service.mutate("events","discard",next,1);
    assert.equal(discarded.payload.items[0].title,"Changed workshop");assert.equal(discarded.hasDraft,false);
    const invalid=await service.mutate("events","draft",{...discarded,payload:{items:[{...live.items[0],title:""}]}},1);
    await assert.rejects(service.mutate("events","publish",invalid,1),/Complete title/);
    assert.equal(row.revision,invalid.revision);assert.equal(live.items[0].title,"Changed workshop");
    live.items[0].title="External edit";
    await assert.rejects(service.mutate("events","publish",{...invalid,payload:working},1),error=>error.status===409);
    assert.ok(commits>=5);assert.ok(rollbacks>=3);
    assert.equal(digest({b:2,a:1}),digest({a:1,b:2}));
    const fresh=await service.mutate("events","discard",invalid,1);
    audit.enqueueTransactionalAudit=async()=>{throw new Error("Audit unavailable");};
    await assert.rejects(service.mutate("events","publish",{...fresh,payload:working},1),/Audit unavailable/);
    assert.equal(live.items[0].title,"External edit");assert.equal(row.revision,fresh.revision);
  } finally {Object.assign(repository,originals);audit.enqueueTransactionalAudit=originalAudit;}
});

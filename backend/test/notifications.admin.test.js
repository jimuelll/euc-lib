const test=require('node:test');
const assert=require('node:assert/strict');
const service=require('../modules/notifications/notifications.admin.service');
const repository=require('../modules/notifications/notifications.admin.repository');
const notifications=require('../modules/notifications/notifications.service');
const base={type:'announcement',title:'Library hours',body:'Review the revised opening hours.',audienceType:'all',href:'/my-library'};
test('notification scheduling validates dates, destinations, lengths and roles',()=>{
 const now=new Date('2026-10-08T00:00:00Z');
 assert.throws(()=>service.validate({...base,scheduledAt:'2026-10-07T00:00:00Z'},now),/future/);
 assert.throws(()=>service.validate({...base,scheduledAt:'2026-10-09T00:00:00Z',expiresAt:'2026-10-08T05:00:00Z'},now),/after the send/);
 assert.throws(()=>service.validate({...base,href:'javascript:alert(1)'},now),/destination/);
 assert.equal(service.validate({...base,href:'/bulletin?post=42'},now).href,'/bulletin?post=42');
 for(const href of ['/bulletin?post=0','/bulletin?post=1&next=https://example.com','/bulletin?post=1#x']) assert.throws(()=>service.validate({...base,href},now),/destination/);
 assert.throws(()=>service.validate({...base,title:'x'.repeat(201)},now),/200 characters/);
 assert.throws(()=>service.validate({...base,audienceType:'role',audienceRole:'unknown'},now),/role/);
 assert.equal(service.validate({...base,scheduledAt:'2026-10-09T00:00:00Z'},now).scheduledAt.toISOString(),'2026-10-09T00:00:00.000Z');
});
test('broadcasts require the current count; scheduling queues without creating a public message',async()=>{
 const originals={count:repository.audienceCount,enqueue:repository.enqueue,create:notifications.createNotification};const writes=[];
 repository.audienceCount=async()=>8;repository.enqueue=async(payload,when)=>{writes.push({payload,when});return 'queue-123';};notifications.createNotification=async()=>assert.fail('Scheduled messages must not be sent immediately');
 try{await assert.rejects(service.create({...base,confirmedRecipientCount:7},1),error=>error.status===409);
 const scheduledAt=new Date(Date.now()+86400000).toISOString();const result=await service.create({...base,scheduledAt,confirmedRecipientCount:8},1);
 assert.equal(result.status,'scheduled');assert.equal(writes.length,1);assert.equal(writes[0].payload.createdBy,1);assert.equal(writes[0].when.toISOString(),scheduledAt);assert.equal(writes[0].payload.scheduledAt,scheduledAt);
 }finally{repository.audienceCount=originals.count;repository.enqueue=originals.enqueue;notifications.createNotification=originals.create;}
});
test('failed deliveries retry the original event and cannot resend an in-flight schedule',async()=>{
 const originals={get:repository.get,count:repository.audienceCount,retry:repository.retry,create:notifications.createNotification};let status='failed',retried=0;
 repository.get=async()=>({queue_id:'event-123',delivery_status:status,audience_type:'all'});repository.audienceCount=async()=>3;repository.retry=async id=>{assert.equal(id,'event-123');retried++;return true;};notifications.createNotification=async()=>assert.fail('Retry must reuse the queued event');
 try{await service.action('queue:event-123','resend',1,{confirmedRecipientCount:3});assert.equal(retried,1);status='scheduled';await assert.rejects(service.action('queue:event-123','resend',1,{confirmedRecipientCount:3}),/Only failed/);assert.equal(retried,1);
 }finally{repository.get=originals.get;repository.audienceCount=originals.count;repository.retry=originals.retry;notifications.createNotification=originals.create;}
});

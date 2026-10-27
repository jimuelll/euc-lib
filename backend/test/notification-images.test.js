const test=require('node:test'),assert=require('node:assert/strict');
const images=require('../modules/notifications/notifications.image.service');
const templates=require('../modules/email/email.provider');
const transforms=require('../modules/backup/snapshot.transforms');
const db=require('../db');
if(require.main===module)test.after(()=>db.end());
const asset={imageUrl:'https://res.cloudinary.com/test-cloud/image/upload/v123/library/notifications/test.jpg',imagePublicId:'library/notifications/test',imageAlt:'Library hours <updated>'};
async function env(work){const keys={CLOUDINARY_CLOUD_NAME:'test-cloud',CLOUDINARY_API_KEY:'fixture',CLOUDINARY_API_SECRET:'fixture'};const before=Object.fromEntries(Object.keys(keys).map(k=>[k,process.env[k]]));Object.assign(process.env,keys);try{return await work();}finally{for(const[k,v]of Object.entries(before))if(v===undefined)delete process.env[k];else process.env[k]=v;}}
test('notification images require a complete reference in this cloud and folder and accept optional descriptions',()=>env(async()=>{
 assert.deepEqual(images.notificationImage({}),{imageUrl:null,imagePublicId:null,imageAlt:null});assert.deepEqual(images.notificationImage(asset),asset);
 for(const imageAlt of [undefined,null,'','   '])assert.equal(images.notificationImage({...asset,imageAlt}).imageAlt,null);
 for(const change of [{imageUrl:'https://elsewhere.example/image.jpg'},{imageUrl:asset.imageUrl+'?x=1'},{imagePublicId:'library/catalog/books/test'},{imageAlt:123},{imageAlt:'x'.repeat(251)},{imageUrl:asset.imageUrl.replace('test-cloud','other-cloud')},{imageUrl:asset.imageUrl.replace('/test.jpg','/../test.jpg')},{imageUrl:'data:image/png;base64,abc'}])assert.throws(()=>images.notificationImage({...asset,...change}),e=>e.status===400);
}));
test('notification uploads validate byte signatures and size rather than trusting file names',()=>{
 images.validateImageFile({buffer:Buffer.from([255,216,255]),size:3,mimetype:'image/jpeg'});
 for(const file of [undefined,{buffer:Buffer.from('<svg>'),size:5,mimetype:'image/jpeg'},{buffer:Buffer.from('bad'),size:3,mimetype:'image/png'},{buffer:Buffer.from([255,216,255]),size:6000000,mimetype:'image/jpeg'}])assert.throws(()=>images.validateImageFile(file));
});
test('notification image upload requests immutable JPEG output bounded to 1600px',()=>env(async()=>{
 const cloud=require('cloudinary').v2,old=cloud.uploader.upload_stream;let options;
 cloud.uploader.upload_stream=(input,done)=>{options=input;return {end(){done(null,{secure_url:asset.imageUrl,public_id:asset.imagePublicId});}};};
 try{assert.deepEqual(await images.uploadNotificationImage({buffer:Buffer.from([255,216,255]),size:3,mimetype:'image/jpeg'}),{imageUrl:asset.imageUrl,imagePublicId:asset.imagePublicId});assert.equal(options.folder,'library/notifications');assert.equal(options.format,'jpg');assert.equal(options.overwrite,false);assert.deepEqual(options.transformation[0],{width:1600,height:1600,crop:'limit'});}finally{cloud.uploader.upload_stream=old;}
}));
test('notification email images are escaped hosted content and account emails remain image-free',()=>env(async()=>{
 const message={recipient:'member@example.edu',name:'Member',subject:'Hours',message:'Read the new hours.',image_url:asset.imageUrl,image_public_id:asset.imagePublicId,image_alt:asset.imageAlt,action_url:'https://library.example/my-library?view=updates&notification=41',action_label:'View notification'};
 const email=templates.renderEmail(message,false);assert.match(email.htmlContent,/<img /);assert.match(email.htmlContent,/alt="Library hours &lt;updated&gt;"/);assert.match(email.htmlContent,/height:auto/);assert.ok(email.htmlContent.indexOf('Read the new hours.')<email.htmlContent.indexOf('<img '));assert.ok(email.htmlContent.indexOf('<img ')<email.htmlContent.indexOf('>View notification<'));assert.match(email.textContent,/Image: Library hours <updated>/);assert.match(email.htmlContent,/view=updates&amp;notification=41/);
 const undescribed=templates.renderEmail({...message,image_alt:undefined},false);assert.match(undescribed.htmlContent,/alt="Notification image"/);assert.doesNotMatch(undescribed.textContent,/undefined/);
 assert.doesNotMatch(templates.renderEmail(message,true).htmlContent,/<img /);assert.throws(()=>templates.renderEmail({...message,image_url:'javascript:alert(1)'},false),e=>e.kind==='permanent');
}));
test('version 19 backups upgrade to text-only defaults without queuing retrospective emails',()=>{
 const backup={version:19,tables:{notifications:[{id:1,title:'Existing',email_requested:0}]},integrity:{algorithm:'sha256',checksum:''}};backup.integrity.checksum=transforms.payloadChecksum(backup);const upgraded=transforms.upgradeBackup(backup);assert.equal(upgraded.version,21);assert.equal(upgraded.tables.notifications[0].image_url,null);assert.equal(upgraded.tables.notifications[0].image_alt,null);assert.equal(upgraded.tables.notifications[0].email_requested,0);
});

test('notification image endpoint enforces roles and accepts real multipart uploads',()=>env(async()=>{
 const express=require('express'),jwt=require('../modules/auth/jwt.util'),sessions=require('../modules/auth/authSession.service'),cloud=require('cloudinary').v2;
 const original={verify:jwt.verifyAccessToken,current:sessions.isAccessTokenCurrent,active:sessions.isUserAccessActive,upload:cloud.uploader.upload_stream};
 const paths=['../modules/auth/auth.middleware','../modules/notifications/notifications.routes'],cached=paths.map(path=>[require.resolve(path),require.cache[require.resolve(path)]]);
 jwt.verifyAccessToken=token=>({id:999871,role:token});sessions.isAccessTokenCurrent=async()=>true;sessions.isUserAccessActive=async()=>true;
 let uploads=0;cloud.uploader.upload_stream=(_,done)=>({end(){uploads++;done(null,{secure_url:asset.imageUrl,public_id:asset.imagePublicId});}});
 for(const[path]of cached)delete require.cache[path];let server;
 try{
  const app=express();app.use(express.json());app.use('/api',require(paths[1]));server=await new Promise(resolve=>{const started=app.listen(0,'127.0.0.1',()=>resolve(started));});const address=`http://127.0.0.1:${server.address().port}/api/admin/notifications/images`;
  const form=()=>{const data=new FormData();data.append('image',new Blob([Buffer.from([255,216,255])],{type:'image/jpeg'}),'poster.jpg');return data;};
  for(const role of ['admin','super_admin']){const response=await fetch(address,{method:'POST',headers:{authorization:`Bearer ${role}`},body:form()});assert.equal(response.status,201);assert.deepEqual(await response.json(),{imageUrl:asset.imageUrl,imagePublicId:asset.imagePublicId});}
  for(const role of ['staff','scanner','student']){const response=await fetch(address,{method:'POST',headers:{authorization:`Bearer ${role}`},body:form()});assert.equal(response.status,403);}
  assert.equal((await fetch(address,{method:'POST',body:form()})).status,401);assert.equal(uploads,2);
  const bad=new FormData();bad.append('image',new Blob(['<svg/>'],{type:'image/svg+xml'}),'bad.svg');assert.equal((await fetch(address,{method:'POST',headers:{authorization:'Bearer admin'},body:bad})).status,415);assert.equal(uploads,2);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));jwt.verifyAccessToken=original.verify;sessions.isAccessTokenCurrent=original.current;sessions.isUserAccessActive=original.active;cloud.uploader.upload_stream=original.upload;for(const[path,value]of cached)if(value)require.cache[path]=value;else delete require.cache[path];}
}));

test('automatic notification emails use their published notification ID while legacy handoffs keep their destination',async()=>{
 const delivery=require('../modules/email/email.service'),settings=require('../modules/email/email.config'),oldGet=db.getConnection;
 const values={EMAIL_ENABLED:'true',EMAIL_ROUTINE_ENABLED:'true',EMAIL_MODE:'capture',EMAIL_ENCRYPTION_KEY:'08'.repeat(32),PUBLIC_APP_URL:'https://library.example'},before=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));Object.assign(process.env,values);
 let insert;
 db.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},query:async(sql,params)=>{if(sql.startsWith('SELECT id,email,name'))return [[{id:3,email:'member@example.edu',name:'Member'}]];if(sql.startsWith('INSERT INTO email_deliveries'))insert=params;if(sql.startsWith('SELECT id FROM email_deliveries'))return [[{id:insert[0]}]];return [{affectedRows:1}];}});
 try{
  for(const notificationId of [41,undefined]){await delivery.queueNotification({type:'borrowing_created',audienceType:'user',audienceUserId:3,title:'Borrowed',body:'Review your loan.'},'test-event',new Date(),notificationId);const message=settings.unprotect(insert[7]);assert.equal(message.action_url,notificationId?'https://library.example/my-library?view=updates&notification=41':'https://library.example/my-library');assert.equal(message.action_label,notificationId?'View notification':'Open My Library');assert.equal(insert[10],notificationId || null);}
 }finally{db.getConnection=oldGet;for(const[key,value]of Object.entries(before))if(value===undefined)delete process.env[key];else process.env[key]=value;}
});

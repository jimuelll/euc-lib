const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const {operationsRequestAllowed: allowed} = require('../modules/auth/operations-access');
const repo = require('../modules/admin/admin.repository');
const service = require('../modules/admin/admin.service');
const accounts = require('../modules/auth/account-email.service');
const outbox = require('../modules/delivery-outbox/outbox.repository');
const hub = require('../realtime/notificationHub');

test('terminal API permissions are explicit, method-specific, and deny cross-role access', () => {
 const endpoints = [
  ['POST','/api/auth/login',true,true], ['POST','/api/auth/refresh',true,true], ['POST','/api/auth/logout',true,true],
  ['POST','/api/attendance/scan',true,false], ['GET','/api/catalogue/schema',false,true],
  ['GET','/api/catalogue/search?q=books',false,true], ['GET','/api/catalogue/books/42/recommendations',false,true],
  ['POST','/api/reservations/42',false,false], ['GET','/api/reservations/active',false,false],
  ['POST','/api/borrowing/scan/borrow',false,false], ['POST','/api/borrowing/scan/return',false,false],
  ['GET','/api/attendance/my',false,false], ['GET','/api/attendance/today',false,false],
  ['POST','/api/attendance/scan/time-out-all',false,false], ['GET','/api/recommendations/me',false,false],
  ['GET','/api/notifications',false,false], ['GET','/api/auth/profile',false,false],
  ['POST','/api/auth/change-password',false,false], ['POST','/api/auth/email-change',false,false],
  ['GET','/api/admin/users',false,false], ['POST','/api/bulletin/1/comments',false,false],
  ['POST','/api/catalogue/search',false,false], ['GET','/api/attendance/scan',false,false],
 ];
 for (const [method,path,scanner,opac] of endpoints) {
  assert.equal(allowed('scanner',method,path),scanner,`scanner: ${method} ${path}`);
  assert.equal(allowed('opac',method,path),opac,`opac: ${method} ${path}`);
  for (const role of [undefined,'student','staff','admin','super_admin']) assert.equal(allowed(role,method,path),true);
 }
 assert.equal(allowed('opac','GET','/API/CATALOGUE/SEARCH/'),true);
});

async function fixture(work) {
 const original={...repo},invite=accounts.invite,enqueue=outbox.enqueue,close=hub.closeUserConnections;
 const user={id:7,name:'Terminal',role:'scanner',student_employee_id:'terminal',username:'terminal',is_active:1};
 const writes=[],queries=[],events=[];let invitations=0,commits=0,rollbacks=0,closed=0;
 const conn={beginTransaction:async()=>{},commit:async()=>commits++,rollback:async()=>rollbacks++,release(){},query:async(sql,args)=>{queries.push({sql,args});return [[user]];}};
 repo.getConnection=async()=>conn;repo.findExistingUser=async()=>[];repo.findUserForUpdate=async()=>user;
 repo.findArchivedUser=async()=>user;repo.findUserByIdForAudit=async()=>({...user});
 repo.createUser=async value=>{writes.push(value);user.role=value.role;return 'BARCODE';};repo.updateUser=async(id,value)=>writes.push(value);
 accounts.invite=async()=>invitations++;outbox.enqueue=async(kind,event)=>events.push({kind,event});hub.closeUserConnections=()=>closed++;
 try {await work({user,writes,queries,events,commits:()=>commits,rollbacks:()=>rollbacks,invitations:()=>invitations,closed:()=>closed});}
 finally {Object.assign(repo,original);accounts.invite=invite;outbox.enqueue=enqueue;hub.closeUserConnections=close;}
}
for (const actor of ['admin','super_admin']) for (const role of ['scanner','opac']) {
 test(`${actor} creates an email-free ${role} with a hashed immediate password`,()=>fixture(async f=>{
  await service.createUser({role,name:'Terminal',username:'terminal',password:'terminal-password'},actor,1);
  assert.equal(f.writes[0].email,null);assert.equal(f.writes[0].role,role);
  assert.equal(await bcrypt.compare('terminal-password',f.writes[0].passwordHash),true);
  assert.equal(f.invitations(),0);assert.equal(f.commits(),1);
  assert.equal(JSON.stringify(f.events).includes('terminal-password'),false);
 }));
}
test('Staff cannot create, update, archive, restore, or reset operations accounts',()=>fixture(async f=>{
 for(const role of ['scanner','opac']) {
  f.user.role=role;
  await assert.rejects(service.createUser({role,name:'Terminal',username:'terminal',password:'terminal-password'},'staff',1),{status:403});
  await assert.rejects(service.updateUser('terminal',{name:'Changed'},'staff',1),{status:403});
  await assert.rejects(service.deleteUser('terminal','staff',1,'Retired terminal'),{status:403});
  await assert.rejects(service.restoreUser('terminal','staff',1),{status:403});
  await assert.rejects(service.resetOperationsPassword('terminal','replacement-password','staff',1),{status:403});
 }
 assert.equal(f.writes.length,0);assert.equal(f.commits(),0);
}));
test('operations creation validates passwords and rejects email and pseudo-roles',()=>fixture(async()=>{
 for (const password of [undefined,'short','😀'.repeat(19)]) await assert.rejects(service.createUser({role:'opac',name:'Terminal',username:'terminal',password},'admin',1),/password/i);
 await assert.rejects(service.createUser({role:'opac',name:'Terminal',username:'terminal',password:'terminal-password',email:'old@example.edu'},'admin',1),/do not use email/);
 await assert.rejects(service.createUser({role:'library_operations',name:'Terminal'},'admin',1),{status:403});
}));
test('regular account invitation behavior is preserved and direct passwords stay forbidden',()=>fixture(async f=>{
 f.user.role='staff';
 repo.findActiveProgram=async()=>({id:1});repo.findAcademicTerm=async()=>({id:1});
 await service.createUser({role:'staff',name:'Staff',library_card_number:'CARD-1',student_number:'ST-1',program_id:1,year_level:'2nd Year',academic_term_id:1,email:'staff@example.edu'},'admin',1);
 assert.equal(f.invitations(),1);assert.equal(f.writes[0].email,'staff@example.edu');
 await assert.rejects(service.createUser({role:'staff',password:'terminal-password'},'admin',1),/cannot choose passwords/);
}));
test('regular and operations account types cannot be converted',()=>fixture(async f=>{
 await assert.rejects(service.updateUser('terminal',{role:'staff'},'admin',1),{status:403});
 f.user.role='staff';await assert.rejects(service.updateUser('terminal',{role:'opac'},'admin',1),{status:403});
 assert.equal(f.writes.length,0);
}));
test('Scanner can change to OPAC and both session stores are invalidated',()=>fixture(async f=>{
 await service.updateUser('terminal',{role:'opac'},'admin',1);
 assert.equal(f.writes[0].role,'opac');
 assert.ok(f.queries.some(q=>q.sql.includes('session_version = session_version + 1')));
 assert.ok(f.queries.some(q=>q.sql.includes('UPDATE auth_refresh_sessions')));
 assert.equal(f.closed(),1);assert.equal(f.commits(),1);
}));
test('admin reset replaces the hash, revokes sessions and challenges, and audits without credentials',()=>fixture(async f=>{
 const result=await service.resetOperationsPassword('terminal','replacement-password','admin',1);
 const update=f.queries.find(q=>q.sql.startsWith('UPDATE users SET password_hash'));
 assert.equal(await bcrypt.compare('replacement-password',update.args[0]),true);
 assert.ok(f.queries.some(q=>q.sql.includes('UPDATE auth_refresh_sessions')));
 assert.ok(f.queries.some(q=>q.sql.includes('UPDATE account_challenges')));
 assert.equal(f.commits(),1);assert.equal(f.closed(),1);
 assert.equal(JSON.stringify({...result,events:f.events}).includes('replacement-password'),false);
 f.user.role='student';await assert.rejects(service.resetOperationsPassword('terminal','replacement-password','admin',1),{status:403});
}));
test('reset rolls back and does not close sessions when its audit fails',()=>fixture(async f=>{
 outbox.enqueue=async()=>{throw new Error('Audit failed');};
 await assert.rejects(service.resetOperationsPassword('terminal','replacement-password','admin',1),/Audit failed/);
 assert.equal(f.commits(),0);assert.equal(f.closed(),0);assert.equal(f.rollbacks(),1);
}));

test('application mounts deny restricted requests before public and protected routers',async()=>{
 const express=require('express'),jwt=require('../modules/auth/jwt.util');
 const cached=new Map(),verify=jwt.verifyAccessToken;
 const replace=(path,value)=>{const id=require.resolve(path);cached.set(id,require.cache[id]);if(value===undefined)delete require.cache[id];else require.cache[id]={id,filename:id,loaded:true,exports:value};};
 const next=(_req,_res,done)=>done(),respond=(_req,res)=>res.json({ok:true});
 const auth=express.Router();for(const path of ['/login','/refresh','/logout'])auth.post(path,respond);
 const catalog=express.Router();catalog.get('/catalogue/schema',respond);catalog.get('/catalogue/search',respond);
 const related=express.Router();related.get('/catalogue/books/:bookId/recommendations',respond);
 const bulletin=express.Router();bulletin.get('/',respond);bulletin.post('/:id/comments',respond);
 const attendance=express.Router();attendance.post('/scan',respond);attendance.get('/my',respond);
 const borrowing=express.Router();borrowing.post('/scan/borrow',respond);
 const reservations=express.Router();reservations.post('/:bookId',respond);
 const routers=new Proxy({authRoutes:auth,publicCatalogRoutes:catalog,recommendationPublicRoutes:related,bulletinRoutes:bulletin,attendanceRoutes:attendance,borrowingRoutes:borrowing,reservationRoutes:reservations},{get:(object,key)=>object[key]||express.Router()});
 jwt.verifyAccessToken=role=>({id:7,role});
 replace('../modules/auth/authSession.service',{isAccessTokenCurrent:async()=>true,isUserAccessActive:async()=>true});
 replace('../modules/auth/auth.middleware');
 replace('../middlewares/maintenanceMode',next);replace('../middlewares/auditLogger',next);
 replace('../middlewares/rateLimiter',{limiters:new Proxy({},{get:()=>next}),rateLimitExposedHeaders:[]});
 replace('../modules',routers);replace('../modules/auth/account-email.routes',{adminRouter:express.Router()});
 replace('../modules/admin/barcode.routes',express.Router());replace('../app');
 let server;
 try {
  server=require('../app').listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const role of ['scanner','opac']) for(const [method,path,expected] of [
   ['POST','/api/auth/login',200],['POST','/api/auth/refresh',200],['POST','/api/auth/logout',200],
   ['POST','/api/attendance/scan',role==='scanner'?200:403],['GET','/api/catalogue/search',role==='opac'?200:403],
   ['GET','/api/catalogue/books/1/recommendations',role==='opac'?200:403],
   ['POST','/api/borrowing/scan/borrow',403],['POST','/api/reservations/1',403],
   ['GET','/api/attendance/my',403],['POST','/api/bulletin/1/comments',403],['GET','/api/bulletin',403]
  ]) {
   const response=await fetch(origin+path,{method,headers:{authorization:`Bearer ${role}`}});
   assert.equal(response.status,expected,`${role}: ${method} ${path}`);
  }
  assert.equal((await fetch(origin+'/api/catalogue/search')).status,200);
  assert.equal((await fetch(origin+'/api/bulletin')).status,200);
 } finally {
  if(server)await new Promise(resolve=>server.close(resolve));jwt.verifyAccessToken=verify;
  for(const [id,value]of cached)if(value)require.cache[id]=value;else delete require.cache[id];
 }
});

test('creation rolls back when a non-strict database silently drops an unsupported role',()=>fixture(async f=>{
 repo.createUser=async value=>{f.writes.push(value);f.user.role='';return 'BARCODE';};
 await assert.rejects(service.createUser({role:'opac',name:'Terminal',username:'terminal',password:'terminal-password'},'admin',1),{status:503});
 assert.equal(f.commits(),0);assert.equal(f.rollbacks(),1);assert.equal(f.invitations(),0);assert.equal(f.events.length,0);
}));

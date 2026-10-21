const test=require('node:test');
const assert=require('node:assert/strict');
const repo=require('../modules/auth/profile.repository');
const audit=require('../modules/analytics/transactional-audit');
const service=require('../modules/auth/profile.service');
const valid={name:'New Name',username:'new-admin',address:'Campus',contact:'09123456789'};
test('self profile validation rejects privilege and password mutations',()=>{
 assert.deepEqual(service.validateProfile(valid),valid);
 for(const field of ['id','role','is_active','password','email','toString'])assert.throws(()=>service.validateProfile({...valid,[field]:'bad'}));
 assert.throws(()=>service.validateProfile({...valid,name:' '}));
 assert.throws(()=>service.validateProfile({...valid,username:'x'.repeat(51)}));
 assert.throws(()=>service.validateProfile({...valid,contact:'abc'}));
});
test('self update checks persisted role, scopes writes to own ID, audits and rolls back conflicts',async()=>{
 const oldGet=repo.getConnection,oldAudit=audit.enqueueTransactionalAudit;
 let user={...valid,student_employee_id:'old',role:'super_admin',is_active:1,must_change_password:0,setup_pending:0};
 let fail=false,commits=0,rollbacks=0,releases=0,updates=[],audits=[];
 repo.getConnection=async()=>({beginTransaction:async()=>{},query:async(sql,args)=>{if(sql.startsWith('SELECT')){assert.deepEqual(args,[42]);return [[user]];}updates.push(args);if(fail)throw {code:'ER_DUP_ENTRY'};return [{}];},commit:async()=>commits++,rollback:async()=>rollbacks++,release:()=>releases++});
 audit.enqueueTransactionalAudit=async(_,entry)=>audits.push(entry);
 try {
  await service.update(42,valid);assert.equal(commits,1);assert.equal(updates[0].at(-1),42);assert.equal(audits[0].actorId,42);
  user.role='admin';await assert.rejects(service.update(42,valid),{status:403});assert.equal(updates.length,1);
  user.role='super_admin';user.must_change_password=1;await assert.rejects(service.update(42,valid),{status:403});
  user.must_change_password=0;fail=true;await assert.rejects(service.update(42,valid),{status:409});assert.equal(commits,1);assert.equal(rollbacks,3);assert.equal(releases,4);
 }finally{repo.getConnection=oldGet;audit.enqueueTransactionalAudit=oldAudit;}
});

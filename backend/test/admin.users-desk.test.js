const test=require("node:test");
const assert=require("node:assert/strict");
const repo=require("../modules/admin/admin.repository");
const overdue=require("../modules/borrowing/overdue.helper");
const service=require("../modules/admin/admin.service");
const accounts=require("../modules/auth/account-email.service");
const outbox=require("../modules/delivery-outbox/outbox.repository");

async function mutationFixture(work) {
 const original={...repo},invite=accounts.invite,enqueue=outbox.enqueue;
 const user={id:42,name:"Super Admin",username:"super-one",student_employee_id:"super-one",role:"super_admin",is_active:1};
 const writes=[],events=[];let committed=0;
 repo.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>committed++,rollback:async()=>{},release(){},query:async()=>[[user]]});
 repo.findUserForUpdate=async()=>user;
 repo.findExistingUser=async()=>[];
 repo.findUserByIdForAudit=async()=>user;
 repo.updateUser=async(identifier,values)=>writes.push({identifier,values});
 repo.createUser=async values=>{writes.push(values);return "LIB-USER-000042";};
 accounts.invite=async(conn,created)=>events.push({invited:created.id});
 outbox.enqueue=async(kind,event)=>events.push({kind,event});
 try{await work({user,writes,events,committed:()=>committed});}
 finally{Object.assign(repo,original);accounts.invite=invite;outbox.enqueue=enqueue;}
}

test("super admins can create invited super admin accounts",()=>mutationFixture(async f=>{
 await service.createUser({name:"New Super",username:"new-super",role:"super_admin",email:"super@example.edu"},"super_admin",42);
 assert.equal(f.writes[0].role,"super_admin");
 assert.equal(f.writes[0].username,"new-super");
 assert.ok(f.writes[0].passwordHash);
 assert.ok(f.events.some(event=>event.invited===42));
 assert.ok(f.events.some(event=>event.kind==="audit"));
 assert.equal(f.committed(),1);
 for(const role of ["admin","staff"])await assert.rejects(service.createUser({role:"super_admin"},role,42),{status:403});
}));

test("super admins can update their own user record with an unchanged role",()=>mutationFixture(async f=>{
 await service.updateUser("super-one",{name:"Updated",username:"renamed",role:"super_admin",address:"Campus",contact:"09123456789",remarks:"New details"},"super_admin",42);
 assert.equal(f.writes[0].values.name,"Updated");
 assert.equal(f.writes[0].values.student_employee_id,"renamed");
 assert.equal(f.writes[0].values.address,"Campus");
 assert.equal(f.writes[0].values.contact,"09123456789");
 assert.equal(f.committed(),1);
 assert.ok(f.events.some(event=>event.kind==="audit"));
}));

test("self editing does not allow other super admin edits, self demotion or archival",()=>mutationFixture(async f=>{
 await assert.rejects(service.updateUser("super-one",{name:"Other"},"super_admin",99),{status:403});
 await assert.rejects(service.updateUser("super-one",{name:"Other"},"admin",42),{status:403});
 await assert.rejects(service.updateUser("super-one",{role:"admin"},"super_admin",42),{status:403});
 await assert.rejects(service.updateUser("super-one",{is_active:0},"super_admin",42),{status:403});
 await assert.rejects(service.deleteUser("super-one","super_admin",42, "Test archive reason"),{status:403});
 assert.equal(f.writes.length,0);
}));
async function fixture(work){const search=repo.searchUsers,list=overdue.listUnsettledBorrowings;let options;repo.searchUsers=async value=>{options=value;return [{user_id:1,name:"Alex",student_employee_id:"CARD-1",role:"student",is_active:1,active_loans:2,overdue_loans:1},{user_id:2,name:"Jamie",student_employee_id:"CARD-2",role:"student",is_active:0,active_loans:0,overdue_loans:0},{user_id:3,name:"Pat",student_employee_id:"admin-one",role:"admin",is_active:1,active_loans:0,overdue_loans:0},{user_id:4,name:"Taylor",student_employee_id:"CARD-3",role:"student",is_active:0,deleted_at:"2026-10-01",active_loans:0,overdue_loans:0}];};overdue.listUnsettledBorrowings=async()=>({rows:[{user_id:1,unsettled_amount:1260},{user_id:2,unsettled_amount:25}]});try{await work(()=>options);}finally{repo.searchUsers=search;overdue.listUnsettledBorrowings=list;}}
test("users desk counts statuses across pages and adds authoritative borrowing balances",()=>fixture(async getOptions=>{const result=await service.searchUsers({page:1,limit:1,status:"active"},"super_admin");assert.equal(result.rows.length,1);assert.equal(result.rows[0].unpaid_fines,1260);assert.equal(result.summary.total,4);assert.equal(result.summary.active,2);assert.equal(result.summary.needsAttention,2);assert.deepEqual(result.summary.statuses,{active:2,inactive:1,archived:1,all:4});assert.ok(getOptions().allowedRoles.includes("super_admin"));assert.equal(result.pagination.total,2);}));
test("users desk filters attention before pagination and retains role counts",()=>fixture(async()=>{const result=await service.searchUsers({page:1,status:"all",role:"student",access:"attention",sort:"attention"},"super_admin");assert.deepEqual(result.rows.map(row=>row.name),["Alex","Jamie"]);assert.equal(result.summary.roles.admin,1);assert.equal(result.summary.statuses.active,1);assert.equal(result.summary.statuses.all,3);}));
test("users desk refuses a role outside the operator's search scope",async()=>{const result=await service.searchUsers({page:1,role:"super_admin"},"staff");assert.equal(result.rows.length,0);});

 test("users academic reference filters constrain both rows and summary",async()=>{
 const search=repo.searchUsers,list=overdue.listUnsettledBorrowings;
 repo.searchUsers=async()=>[{user_id:1,name:"Linked",role:"student",is_active:1,program_id:7},{user_id:2,name:"Unrelated",role:"student",is_active:1,program_id:8},{user_id:3,name:"Archived linked",role:"student",is_active:0,deleted_at:"2026-10-01",program_id:7}];
 overdue.listUnsettledBorrowings=async()=>({rows:[]});
 try{const result=await service.searchUsers({programId:"7",status:"all",page:1},"super_admin");assert.deepEqual(result.rows.map(row=>row.name),["Archived linked","Linked"]);assert.equal(result.summary.total,2);assert.equal(result.summary.statuses.archived,1);await assert.rejects(service.searchUsers({programId:"invalid"},"super_admin"),{status:400});}finally{repo.searchUsers=search;overdue.listUnsettledBorrowings=list;}
 });

const accountRepo=require('../modules/admin/admin.account.repository');
test('availability checks exclude only accounts the actor may manage',async()=>{
 const original={...accountRepo};let checked;
 accountRepo.accountByIdentifier=async()=>({id:77,role:'admin'});
 accountRepo.available=async(...args)=>{checked=args;return false;};
 try {
  await assert.rejects(service.checkAvailability({field:'email',value:'someone@example.edu',excludeIdentifier:'admin-one'},'staff',42),{status:403});
  assert.deepEqual(await service.checkAvailability({field:'email',value:' Desk@Example.edu ',excludeIdentifier:'admin-one'},'super_admin',42),{available:false});
  assert.deepEqual(checked,['email','desk@example.edu',77]);
  await assert.rejects(service.checkAvailability({field:'password',value:'secret'},'super_admin',42));
 } finally {Object.assign(accountRepo,original);}
});
test('email history enforces target permissions and exposes only delivery state',async()=>{
 const original={...accountRepo};
 accountRepo.accountByIdentifier=async()=>({id:77,role:'admin'});
 accountRepo.accountEmailStatus=async()=>[{purpose:'setup',status:'queued',requested_at:'2026-10-27T00:00:00Z',accepted_at:null}];
 try {
  await assert.rejects(service.getAccountEmailStatus('admin-one','staff',42),{status:403});
  const result=await service.getAccountEmailStatus('admin-one','super_admin',42);
  assert.equal(result.deliveries[0].status,'queued');assert.equal(result.deliveries[0].recipient,undefined);
 } finally {Object.assign(accountRepo,original);}
});
test('archive requires a nonempty reason',async()=>{
 await assert.rejects(service.deleteUser('staff-one','super_admin',42,'   '),/archive reason/);
});
test('duplicate create identifiers return inline field errors',()=>mutationFixture(async f=>{
 repo.findExistingUser=async()=>[f.user];
 await assert.rejects(service.createUser({name:'Desk',role:'staff',username:'super-one',email:'desk@example.edu'},'super_admin',42),e=>e.status===409 && Boolean(e.fieldErrors.username));
}));
test('email claims conflicting during create return inline email errors',()=>mutationFixture(async()=>{
 accounts.invite=async()=>{throw Object.assign(new Error('That email address is already in use'),{status:409});};
 await assert.rejects(service.createUser({name:'Desk',role:'staff',username:'new-desk',email:'desk@example.edu'},'super_admin',42),e=>e.status===409 && Boolean(e.fieldErrors.email));
}));

test('archive records its reason transactionally and retains outstanding-loan checks',()=>mutationFixture(async f=>{
 const ledger=require('../modules/borrowing/fine-ledger.service');
 const sessions=require('../modules/auth/auth-session.repository');
 const originalFine=ledger.assertNoOutstandingFines,originalSessions=sessions.revokeAllRefreshSessionsForUser;
 f.user.role='staff';
 repo.findAllBorrowingIdsForUser=async()=>[];
 repo.findActiveBorrowings=async()=>[{id:1}];repo.findActiveReservations=async()=>[];
 repo.deactivateUser=async()=>1;ledger.assertNoOutstandingFines=async()=>({outstandingAmount:0,affectedLoans:0});sessions.revokeAllRefreshSessionsForUser=async()=>{};
 try {
  await assert.rejects(service.deleteUser('super-one','super_admin',99,'Leaving institution'),{status:409});
  assert.equal(f.committed(),0);
  repo.findActiveBorrowings=async()=>[];
  await service.deleteUser('super-one','super_admin',99,' Leaving institution ');
  assert.equal(f.committed(),1);
  assert.ok(f.events.some(event=>event.kind==='audit' && event.event.metadata.archive_reason==='Leaving institution'));
 } finally {ledger.assertNoOutstandingFines=originalFine;sessions.revokeAllRefreshSessionsForUser=originalSessions;}
}));

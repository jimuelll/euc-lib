const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../db');
const overdue=require('../modules/borrowing/overdue.helper');
const clearance=require('../modules/clearance/clearance.repository');
const {getPatronBorrowing}=require('../modules/admin/admin.borrowing');

test('patron obligations use exact identity, include inactive accounts and ledger balances on returned books',async()=>{
 const original=[db.query,overdue.listUnsettledBorrowings,clearance.findUserReservations];
 const calls=[];
 db.query=async(sql,params)=>{calls.push({sql,params});return sql.startsWith('SELECT id,role')?[[{id:6,role:'student',is_active:0,deleted_at:'2026-10-01'}]]:[[{id:12,status:'overdue',book_title:'Borrowed title',copy_barcode:'COPY-2'}]];};
 overdue.listUnsettledBorrowings=async({userId})=>{assert.equal(userId,6);return {rows:[{id:5,status:'returned',fine_amount:100,settled_amount:40,unsettled_amount:60}],summary:{total_unsettled_amount:60}};};
 clearance.findUserReservations=async id=>{assert.equal(id,6);return [{id:4,status:'ready',book_title:'Reserved title'}];};
 try {
  const result=await getPatronBorrowing('CARD-6',['student']);
  assert.deepEqual(calls[0].params,['CARD-6']);assert.match(calls[0].sql,/student_employee_id = \?/);
  assert.doesNotMatch(calls[0].sql,/is_active|deleted_at/);
  assert.match(calls[1].sql,/ORDER BY .* DESC,b.due_date ASC/);
  assert.equal(result.fineRows[0].status,'returned');assert.equal(result.summary.unpaidFines,60);
  assert.equal(result.summary.overdueLoans,1);assert.equal(result.summary.activeReservations,1);
  await assert.rejects(getPatronBorrowing('CARD-6',['employee']),{status:404});
 } finally {[db.query,overdue.listUnsettledBorrowings,clearance.findUserReservations]=original;}
});

test('unknown patrons have no obligations response',async()=>{
 const original=db.query;db.query=async()=>[[]];
 try {await assert.rejects(getPatronBorrowing('missing',['student']),{status:404});}finally{db.query=original;}
});

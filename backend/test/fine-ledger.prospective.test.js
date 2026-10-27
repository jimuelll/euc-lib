const test = require('node:test');
const assert = require('node:assert/strict');
const ledger = require('../modules/borrowing/fine-ledger.service');
function fixture(charged = 0) {
 const state = { charged_amount: charged, cycle_base_amount: 0, policy_baseline: null }, entries = [];
 return { state, entries, conn: { async query(sql, v) {
  if (sql.startsWith('INSERT IGNORE')) return [[]];
  if (sql.startsWith('SELECT charged_amount')) return [[{ ...state }]];
  if (sql.startsWith('INSERT INTO fine_ledger_entries')) { entries.push(v[1]); return [[]]; }
  if (sql.startsWith('UPDATE fine_accounts SET charged_amount')) { [state.charged_amount,state.cycle_base_amount,state.assessed_through_at,state.policy_due_date,state.policy_rate,state.policy_interval,state.policy_initial,state.policy_baseline] = v; return [[]]; }
  if (sql.startsWith('UPDATE fine_accounts SET cycle_base_amount')) { state.cycle_base_amount = v[0]; state.policy_baseline = null; return [[]]; }
  throw Error(sql);
 } } };
}
const at = h => new Date(Date.UTC(2026,0,1,h));
const row = rate => ({ id:1, due_date:at(0), returned_at:null, fine_per_hour:rate, fine_interval:'hour', initial_fine:0 });
test('rate changes preserve charges and accrue new intervals', async () => {
 const f=fixture();
 await ledger.assessBorrowing(row(10),f.conn,at(2));
 await ledger.assessBorrowing(row(2),f.conn,at(2));
 assert.equal(f.state.charged_amount,20);
 await ledger.assessBorrowing(row(2),f.conn,at(3));
 await ledger.assessBorrowing(row(20),f.conn,at(3));
 assert.equal(f.state.charged_amount,22);
 await ledger.assessBorrowing(row(20),f.conn,at(4));
 assert.equal(f.state.charged_amount,42);
 assert.deepEqual(f.entries,[20,2,20]);
});
test('existing excess charges establish a baseline', async () => {
 const f=fixture(100);
 await ledger.assessBorrowing(row(10),f.conn,at(2));
 assert.equal(f.state.charged_amount,100);
 await ledger.assessBorrowing(row(10),f.conn,at(3));
 assert.equal(f.state.charged_amount,110);
});
test('renewal preserves charges and begins a new cycle', async () => {
 const f=fixture();
 await ledger.assessBorrowing(row(10),f.conn,at(2));
 await ledger.beginRenewalCycle(1,f.conn);
 const renewed={...row(10),due_date:at(5)};
 await ledger.assessBorrowing(renewed,f.conn,at(5));
 await ledger.assessBorrowing(renewed,f.conn,at(6));
 assert.equal(f.state.charged_amount,30);
});

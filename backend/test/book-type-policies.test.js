const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db');
const {savePolicy} = require('../modules/catalog/catalog.policies.repository');
const repository = require('../modules/catalog/catalog.repository');
const input = {name:'General',days:7,minutes:10080,durationUnit:'day',fine:1,fineInterval:'hour',initial:0};
test('changed loan terms require a written reason before any update',async()=>{const original=db.getConnection,statements=[];db.getConnection=async()=>({async beginTransaction(){},async rollback(){statements.push('rollback');},release(){},async query(sql){statements.push(sql);if(sql.includes("SELECT id FROM book_types WHERE name"))return [[]];return [[{id:7,loan_duration_minutes:10080,fine_per_hour:1,initial_fine:0,fine_interval:'hour'}]];}});try{await assert.rejects(savePolicy(7,{...input,fine:2},5),{status:400,field:'reason'});assert.ok(statements.includes('rollback'));assert.ok(!statements.some(sql=>sql.startsWith('UPDATE')));}finally{db.getConnection=original;}});

for (const auditFails of [false,true]) test(`policy edits and audit enqueue are atomic (audit failure: ${auditFails})`,async()=>{
 const original=db.getConnection, statements=[];
 db.getConnection=async()=>({
  async beginTransaction(){statements.push('BEGIN');},async commit(){statements.push('COMMIT');},async rollback(){statements.push('ROLLBACK');},release(){statements.push('RELEASE');},
  async query(sql,params){statements.push(sql);
   if(sql.includes('SELECT id FROM book_types WHERE name'))return [[]];
   if(sql.startsWith('SELECT * FROM book_types'))return [[{id:7,name:'General',is_active:1,loan_duration_minutes:10080,fine_per_hour:1,initial_fine:0}]];
   if(sql.startsWith('UPDATE book_types')){assert.equal(params[4],'1.00');return [{affectedRows:1}];}
   if(sql.startsWith('INSERT INTO delivery_outbox')){if(auditFails)throw new Error('audit unavailable');return [{affectedRows:1}];}
   throw new Error(`Unexpected query: ${sql}`);
  }
 });
 try{
  if(auditFails)await assert.rejects(savePolicy(7,{...input,reason:"Annual policy review"},5),/audit unavailable/);else await savePolicy(7,input,5);
  assert.equal(statements.includes('COMMIT'),!auditFails);assert.equal(statements.includes('ROLLBACK'),auditFails);
  assert.ok(!statements.some(sql=>/UPDATE borrowings/.test(sql)));assert.equal(statements.at(-1),'RELEASE');
 }finally{db.getConnection=original;}
});

test('exact policy filter is used for Catalog counts and rows with correctly ordered parameters',async()=>{
 const original=db.query,queries=[];db.query=async(sql,params)=>{queries.push({sql,params});return sql.includes('active_count')?[[{active_count:1,archived_count:0,all_count:1}]]:sql.includes('COUNT(*) AS total')?[[{total:1}]]:[[]];};
 try{
  await repository.searchBooksPage({query:'Atlas',materialType:'book',bookTypeId:7,status:'all',page:1});
  assert.equal(queries.length,3);
  for(const {sql,params} of queries){assert.match(sql,/bk.book_type_id = \?/);assert.deepEqual(params.slice(0,6),['%Atlas%','%Atlas%','%Atlas%','%Atlas%','book',7]);}
 }finally{db.query=original;}
});

test('assigned policies cannot be archived, including archived books',async()=>{
 const original=db.getConnection,statements=[];
 db.getConnection=async()=>({async beginTransaction(){},async commit(){statements.push('COMMIT');},async rollback(){statements.push('ROLLBACK');},release(){},async query(sql){statements.push(sql);if(sql.startsWith('SELECT * FROM book_types'))return [[{id:7,is_active:1}]];if(sql.includes('WHERE name'))return [[]];if(sql.startsWith('SELECT id FROM books'))return [[{id:4}]];throw new Error('Unexpected write');}});
 try{await assert.rejects(savePolicy(7,{...input,isActive:0},5),/Reassign all active and archived books/);assert.ok(statements.includes('ROLLBACK'));assert.ok(!statements.includes('COMMIT'));assert.ok(!statements.some(sql=>sql.startsWith('UPDATE')));}finally{db.getConnection=original;}
});

test('policy list uses retained event metadata and saved loan snapshots',async()=>{
 const original=db.query;let query='';db.query=async(sql)=>{query=sql;return [[]];};
 try{await repository.getBookTypes();assert.match(query,/latest.restore_status,'retained'/);assert.match(query,/ae.occurred_at AS last_changed_at/);assert.match(query,/b.loan_policy_id_snapshot=bt.id/);assert.match(query,/loan_duration_minutes IS NOT NULL/);assert.match(query,/previous_terms_loans/);assert.doesNotMatch(query,/b.book_type_id/);}finally{db.query=original;}
});

test('previous-terms loans filter agrees with policy counts and preserves bound parameters',async()=>{
 const borrowing=require('../modules/borrowing/borrowing.repository');const {previousPolicyTerms}=require('../modules/catalog/policy.snapshot');
 const original=db.query,queries=[];db.query=async(sql,params)=>{queries.push({sql,params});return sql.includes('COUNT(*) AS total')?[[{total:0}]]:sql.includes('total_records')?[[{}]]:[[]];};
 try{await borrowing.getAdminBorrowings({policyId:7,previousTerms:true,status:'needs_action'});assert.equal(queries.length,3);for(const {sql,params} of queries){assert.match(sql,/b.loan_policy_id_snapshot = \?/);assert.ok(sql.includes(previousPolicyTerms()));assert.equal(params[0],7);assert.match(sql,/b.status IN \('borrowed','overdue'\)/);}}finally{db.query=original;}
});

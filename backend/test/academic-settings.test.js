const test = require('node:test');
const assert = require('node:assert/strict');
const repository = require('../modules/library-settings/library-settings.repository');
const service = require('../modules/library-settings/library-settings.service');

test('term dates reject impossible dates and reversed ranges before any write', async () => {
  for (const [startsOn,endsOn] of [['2026-02-30','2026-06-01'],['2026-07-01','2026-06-01'],['12/07/2026','2026-12-07']]) {
    await assert.rejects(service.createAcademicTerm({name:'Term',startsOn,endsOn},1), {status:400});
  }
});
test('term peer validation blocks duplicate names and inclusive overlaps while holding locks', async () => {
  const peers = [{id:2,name:'First semester',starts_on:'2026-07-12',ends_on:'2026-12-07'}];
  const conn = {async query(sql) { assert.match(sql,/ORDER BY id FOR UPDATE/); return [peers]; }};
  await assert.rejects(service.createAcademicTerm({name:'Another semester',startsOn:'2026-12-07',endsOn:'2027-04-01'},1,conn), {status:409,field:'dates'});
  await assert.rejects(service.createAcademicTerm({name:' FIRST SEMESTER ',startsOn:'2027-01-01',endsOn:'2027-04-01'},1,conn), {status:409,field:'name'});
});
test('permanent removal checks current references and refuses without deleting', async () => {
  for (const kind of ['Program','Department']) {
    const statements=[];
    const conn={async query(sql){statements.push(sql); if(sql.includes('FOR UPDATE')) return [[{id:7,name:'Referenced',is_active:1}]];return [[{users:1,holdings:0,total:1}]];}};
    await assert.rejects(repository['deleteAcademic'+kind]?.(7,1,conn,'delete') || repository.deleteDepartment(7,1,conn,'delete'),{status:409});
    assert.equal(statements.some(sql=>sql.startsWith('DELETE') || sql.startsWith('UPDATE')),false);
  }
});
test('explicit archive retains an unused department for restoration', async () => {
  const statements=[];
  const conn={async query(sql){statements.push(sql);if(sql.includes('FOR UPDATE'))return [[{id:7,name:'Unused',is_active:1}]];if(sql.startsWith('SELECT COUNT'))return [[{total:0}]];return [{affectedRows:1}];}};
  const result=await repository.deleteDepartment(7,1,conn,'archive');
  assert.equal(result.action,'archived');assert.ok(statements.some(sql=>sql.startsWith('UPDATE')));assert.equal(statements.some(sql=>sql.startsWith('DELETE')),false);
});
test('holiday imports roll back the whole batch and audit if one date conflicts', async () => {
  const originals={getConnection:repository.getConnection,createHoliday:repository.createHoliday};const events=[];let count=0;
  const conn={async beginTransaction(){events.push('BEGIN');},async commit(){events.push('COMMIT');},async rollback(){events.push('ROLLBACK');},release(){events.push('RELEASE');},async query(sql){if(sql.startsWith('SELECT'))return [[{id:1,name:'First holiday',holiday_date:'2026-12-24',is_active:1}]];return [{affectedRows:1}];}};
  repository.getConnection=async()=>conn;
  repository.createHoliday=async()=>{if(++count===2)throw Object.assign(new Error('Duplicate'),{code:'ER_DUP_ENTRY'});return {id:1,name:'First holiday'};};
  try {await assert.rejects(service.importHolidays([{name:'First',holidayDate:'2026-12-24'},{name:'Second',holidayDate:'2026-12-25'}],1),{status:409});assert.deepEqual(events,['BEGIN','ROLLBACK','RELEASE']);}
  finally {Object.assign(repository,originals);}
});
test('holiday imports reject invalid dates and oversized lists',async()=>{
  await assert.rejects(service.createHoliday({name:'Invalid',holidayDate:'2026-02-30'},1),{status:400});
  await assert.rejects(service.importHolidays([],1),{status:400});
  await assert.rejects(service.importHolidays(Array(101).fill({name:'Holiday',holidayDate:'2026-12-25'}),1),{status:400});
});

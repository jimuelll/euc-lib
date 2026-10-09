const test=require('node:test'),assert=require('node:assert/strict');
const helpers=require('../modules/analytics/audit.feed.helpers');
const db=require('../db'),audit=require('../modules/analytics/analytics.audit.service');
test('audit redaction keeps policy names and numeric diffs while masking personal and nested secrets',()=>{
 const result=helpers.redact({changes:[{field:'Policy name',before:'A',after:'B'},{field:'Fine',before:0,after:3},{field:'Name',before:'Private',after:'Other'}],nested:{token:'secret',email:'person@example.com'}});
 assert.equal(result.changes[0].after,'B');assert.equal(result.changes[1].before,0);assert.equal(result.changes[2].after,helpers.REDACTED);assert.equal(result.nested.token,helpers.REDACTED);assert.ok(!JSON.stringify(result).includes('person@example.com'));
});
test('audit filters bind actor, exact record and search, and reject reversed dates',()=>{
 const result=helpers.filters({actor:'7',record:'/api/admin/book-types/1',query:"' OR 1=1",important:'true',security:'true'});
 assert.match(result.sql,/actor_id = \?/);assert.ok(!result.sql.includes("' OR 1=1"));assert.ok(result.params.includes(7));assert.ok(result.params.includes('/api/admin/book-types/1'));
 assert.throws(()=>helpers.filters({dateFrom:'2026-10-09',dateTo:'2026-10-08'}),{status:400});assert.throws(()=>helpers.filters({actor:'invalid'}),{status:400});
 assert.throws(()=>helpers.filters({dateFrom:'2026-02-31'}),{status:400});
 const patron=helpers.filters({record:'/api/admin/users/PATRON%2F52'});assert.match(patron.sql,/target_id/);assert.ok(patron.params.includes('PATRON/52'));
});
test('feed retains captured routes after legacy enrichment and resolves policy links',async()=>{
 const query=db.query;db.query=async(sql)=>{
  if(sql.includes('MAX(id)'))return [[{total:1,latestId:12}]];
  if(sql.includes('COUNT(*)'))return [[{total:1}]];
  if(sql.includes('FROM audit_events'))return [[{id:12,actor_id:1,category:'catalog',action:'updated',occurred_at:'2026-10-09 10:00:00',route:'/api/admin/book-types/4',metadata:{changes:[{field:'Fine',before:0,after:3}]}}]];
  if(sql.includes('FROM book_types'))return [[{id:4,label:'Circulation'}]];
  return [[]];
 };
 try{const result=await require('../modules/analytics/audit.feed').getFeed();assert.equal(result.rows[0].route,'/api/admin/book-types/4');assert.equal(result.rows[0].target.url,'/admin/book-types?policyId=4');assert.equal(result.rows[0].metadata.changes[0].before,0);}finally{db.query=query;}
});
test('CSV neutralizes spreadsheet formulas',()=>{assert.equal(helpers.csvCell('=1+1'),'"\'=1+1"');assert.equal(helpers.csvCell('A"B'),'"A""B"');});
test('quick filters use server identity for Mine and reject arbitrary SQL selectors',()=>{const mine=helpers.filters({quick:'mine',currentActorId:7});assert.match(mine.sql,/actor_id = \?/);assert.deepEqual(mine.params,[7]);assert.throws(()=>helpers.filters({quick:'mine'}),{status:400});assert.throws(()=>helpers.filters({quick:'DROP TABLE'}),{status:400});for(const quick of ['money','loans','identity','auth','important','test'])assert.ok(helpers.filters({quick}).sql.length>30);});
for(const fail of [false,true])test(`export is released only after its audit succeeds: ${fail?'failure':'success'}`,async()=>{
 const query=db.query,record=audit.recordAuditEvent;let released=false,event;
 db.query=async()=>[[{id:9,occurred_at:'2026-10-09 10:00:00',actor_name:'Staff',category:'catalog',action:'updated',description:'Updated policy',route:'/policy/1',metadata:{password:'secret',changes:[{field:'Fine',before:0,after:3}]}}]];
 audit.recordAuditEvent=async value=>{event=value;if(fail)throw new Error('audit unavailable');};
 const res={locals:{},setHeader(){},send(value){released=value;},status(code){this.code=code;return this;},json(value){this.body=value;}};
 try{await require('../modules/analytics/audit.export').handleExport({user:{id:7},body:{category:'catalog'}},res);assert.equal(Boolean(released),!fail);if(!fail){assert.equal(event.actorId,7);assert.ok(!released.includes('secret'));assert.ok(released.includes('Redacted (sensitive)'));assert.equal(res.locals.auditEnqueued,true);}else assert.equal(res.code,500);}finally{db.query=query;audit.recordAuditEvent=record;}
});
test('request context is captured and sanitized on direct audit writes',async()=>{
 const query=db.query;let parameters;db.query=async(_sql,params)=>{parameters=params;return [{affectedRows:1}];};
 try{await require('../modules/analytics/audit.context').auditContext.run({request_id:'example',user_agent:'Browser'},()=>require('../modules/analytics/analytics.repository').recordAuditEvent({category:'system',action:'updated',description:'Saved',metadata:{password:'secret'}}));const metadata=JSON.parse(parameters[7]);assert.equal(metadata.request_id,'example');assert.equal(metadata.password,helpers.REDACTED);}finally{db.query=query;}
});
test('derived categories and high impact describe the changed fields, without classifying every policy',()=>{
 assert.equal(helpers.displayCategory({route:'/api/admin/users/P52',category:'catalog'}),'users');
 assert.equal(helpers.displayCategory({route:'/api/admin/book-types/12',category:'catalog'}),'settings');
 assert.match(helpers.filters({category:'users'}).sql,/CASE WHEN/);
 assert.equal(helpers.safeRow({route:'/api/admin/book-types/12',action:'updated',metadata:{changes:[{field:'Policy name',before:'A',after:'B'}]}}).significant,false);
 assert.match(helpers.safeRow({action:'updated',metadata:{changes:[{field:'Loan duration',before:'7 days',after:'8 days'}]}}).impact_reason,/loan duration/);
});
test('a contradictory patron summary cannot link to an unrelated book type policy',async()=>{
 const query=db.query;db.query=async(sql)=>{
  if(sql.includes('MAX(id)'))return [[{total:1,latestId:12}]];
  if(sql.includes('COUNT(*)'))return [[{total:1}]];
  if(sql.includes('FROM audit_events'))return [[{id:12,action:'updated',description:'Updated patron account',route:'/api/admin/book-types/4',metadata:{}}]];
  if(sql.includes('FROM book_types'))return [[{id:4,label:'Circulation'}]];
  return [[]];
 };
 try{const result=await require('../modules/analytics/audit.feed').getFeed();assert.equal(result.rows[0].target.kind,'Patron');assert.equal(result.rows[0].target.url,undefined);assert.equal(result.rows[0].target.unavailable,true);}finally{db.query=query;}
});

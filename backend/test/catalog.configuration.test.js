const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../db');
const configuration=require('../modules/catalog/catalog.configuration.service');
const schema=require('../modules/catalog/catalog.schema.service');
const middleware=require('../modules/catalog/catalog.middleware');
const base=[{key:'title',label:'Title',type:'text',required:true,locked:true,public:true,scope:'shared',order:0},{key:'author',label:'Author',type:'text',required:true,locked:true,public:true,scope:'shared',order:1},{key:'category',label:'Category',type:'select',options:['A','B'],scope:'book',order:2,archived:true}];

test('usage counts preserve zero, exclude archived records from missing counts and inspect both scopes',()=>{
 const fields=[{key:'rating',type:'number',scope:'book'},{key:'category',type:'select',scope:'book'}];
 const result=configuration.summarizeFieldUsage(fields,[{material_type:'book',metadata:{rating:0,category:'A'}},{material_type:'thesis',metadata:{category:'B'}},{material_type:'book',metadata:{category:'A'},deleted_at:'2026-10-01'},{material_type:'book',metadata:{}}]);
 assert.equal(result.rating.used,1);assert.equal(result.rating.missingBooks,1);assert.equal(result.rating.missingTheses,1);
 assert.equal(result.category.used,3);assert.equal(result.category.activeUsed,2);assert.equal(result.category.archivedUsed,1);assert.equal(result.category.thesisUsed,1);assert.equal(result.category.publicUsed,1);assert.deepEqual(result.category.options,{A:2,B:1});
});

for(const scenario of ['success','visibility change','audit failure','stale revision','used deletion','unused deletion'])test(`schema transaction: ${scenario}`,async()=>{
 const original=db.getConnection,statements=[];
 db.getConnection=async()=>({async beginTransaction(){statements.push('BEGIN');},async commit(){statements.push('COMMIT');},async rollback(){statements.push('ROLLBACK');},release(){statements.push('RELEASE');},async query(sql,params){statements.push(sql);
  if(sql.startsWith('SELECT * FROM catalog_schema'))return [base];
  if(sql.startsWith('SELECT id FROM books'))return [scenario==='used deletion'?[{id:5}]:[]];
  if(sql.includes('SELECT `key`')||sql.includes('SELECT key'))return [[{key:'title'},{key:'author'}]];
  if(sql.startsWith('INSERT INTO delivery_outbox')){if(scenario==='audit failure')throw new Error('audit unavailable');const packet=params.find(p=>typeof p==='string'&&p.startsWith('{'));const event=JSON.parse(packet);assert.equal(typeof event.metadata.changes[0].before,'string');assert.equal(typeof event.metadata.changes[0].after,'string');if(scenario==='visibility change'){const change=event.metadata.changes.find(c=>c.field.endsWith(' · public'));assert.equal(change.before,'No');assert.equal(change.after,'Yes');}return [{affectedRows:1}];}
  if(sql.startsWith('INSERT INTO catalog_schema')||sql.startsWith('DELETE FROM catalog_schema')||sql.startsWith('UPDATE catalog_schema'))return [{affectedRows:1}];
  throw new Error(`Unexpected query: ${sql}`);
 }});
 try{
  const deleting=scenario.includes('deletion'),commits=scenario==='success'||scenario==='visibility change'||scenario==='unused deletion';
  const next=deleting?base.filter(f=>f.key!=='category'):base.map(f=>f.key==='category'?scenario==='visibility change'?{...f,public:true}:{...f,label:'Subject category'}:f);
  const promise=schema.upsertSchema(next,scenario==='stale revision'?[]:base,7,deleting?['category']:[]);
  if(commits)await promise;else await assert.rejects(promise,scenario==='audit failure'?/audit unavailable/:{status:409});
  assert.equal(statements.includes('COMMIT'),commits);assert.equal(statements.includes('ROLLBACK'),!commits);assert.equal(statements.at(-1),'RELEASE');
  assert.ok(!statements.some(sql=>sql.startsWith('UPDATE books')));
  if(scenario==='used deletion')assert.ok(!statements.some(sql=>sql.startsWith('DELETE FROM catalog_schema')));
 }finally{db.getConnection=original;}
});

test('dropdown duplicates are rejected on the server',async()=>{
 let continued=false;const res={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 await middleware.validateSchemaPayload({body:{fields:base.map(f=>f.key==='category'?{...f,archived:false,options:['A',' a ']}:f)}},res,()=>continued=true);
 assert.equal(continued,false);assert.equal(res.code,400);assert.match(res.body.message,/unique/);
});

test('retired choices cannot also be active or contain duplicates',async()=>{
 for(const archived_options of [['A'],['Old','old'],['']]){
  let continued=false;const res={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await middleware.validateSchemaPayload({body:{fields:base.map(f=>f.key==='category'?{...f,archived:false,archived_options}:f)}},res,()=>continued=true);
  assert.equal(continued,false);assert.equal(res.code,400);
 }
});

test('option totals account for all stored values, including retired values',()=>{
 const result=configuration.summarizeFieldUsage([{key:'category',type:'select',scope:'book'}],[{material_type:'book',metadata:{category:'Fiction'}},{material_type:'book',metadata:{category:'Fiction'}},{material_type:'book',metadata:{category:'Old choice'}}]);
 assert.equal(result.category.used,3);assert.equal(result.category.options.Fiction,2);assert.equal(result.category.options['Old choice'],1);
 assert.equal(Object.values(result.category.options).reduce((a,b)=>a+b,0),result.category.used);
});
const configurationFilters=require('../modules/catalog/catalog.configuration-filters');
const repository=require('../modules/catalog/catalog.repository');
test('configuration record filters bind metadata keys and apply to totals and rows',async()=>{
 const original=db.query,queries=[];db.query=async(sql,params)=>{queries.push({sql,params});if(sql.includes('all_count'))return [[{all_count:59,active_count:53,archived_count:6}]];if(sql.includes('COUNT(*) AS total'))return [[{total:59}]];return [[]];};
 try{const result=await repository.searchBooksPage({fieldKey:'category',fieldUsage:'used',status:'all'});assert.equal(result.total,59);assert.equal(queries.length,3);for(const query of queries){assert.match(query.sql,/JSON_TABLE/);assert.deepEqual(query.params.slice(4,8),Array(4).fill('$."category"'));assert.ok(!query.sql.includes('$."category"'));}}finally{db.query=original;}
});
test('missing filters include absent/null/blank values and accession filter follows eligibility',()=>{
 const missing=configurationFilters.configurationFilter('rating','missing');assert.match(missing.sql,/NOT \(COALESCE/);assert.match(missing.sql,/TRIM/);
 const zero=configurationFilters.configurationFilter('copies','used');assert.match(zero.sql,/CAST\(bk.copies AS CHAR\)/);assert.deepEqual(zero.params,[]);
 const unheld=configurationFilters.configurationFilter(undefined,undefined,true);assert.match(unheld.sql,/accession_claim_voids/);assert.match(unheld.sql,/unheld_copy.is_active=1/);assert.match(unheld.sql,/unheld_copy.deleted_at IS NULL/);
});


test('required Theses fields do not block Books but are enforced for Theses',async()=>{
 const original=repository.getSchema;
 repository.getSchema=async()=>[...base.filter(f=>!f.archived),{key:'academic_year',label:'Academic Year',type:'text',scope:'thesis',required:true}];
 try{const response=()=>({status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 let accepted=false;const book=response();await middleware.validateCreateBookPayload({body:{title:'Book title',author:'Book author',material_type:'book',book_type_id:1}},book,()=>{accepted=true;});assert.equal(accepted,true);
 const thesis=response();await middleware.validateCreateBookPayload({body:{title:'Thesis title',author:'Thesis author',material_type:'thesis'}},thesis,()=>{});assert.equal(thesis.code,400);assert.match(thesis.body.message,/Academic Year/);
 }finally{repository.getSchema=original;}
});
test('required ISBN and copies apply only to books',async()=>{
 const original=repository.getSchema;
 repository.getSchema=async()=>[...base.filter(f=>!f.archived),{key:'isbn',label:'ISBN',type:'text',scope:'shared',required:true},{key:'copies',label:'Copies',type:'number',scope:'shared',required:true}];
 try {let accepted=false;const response={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await middleware.validateCreateBookPayload({body:{title:'Thesis title',author:'Thesis author',material_type:'thesis'}},response,()=>{accepted=true;});assert.equal(accepted,true);}
 finally {repository.getSchema=original;}
});
test('archive attribution is taken from captured audit transitions',async()=>{
 const original=db.query;
 db.query=async(sql,params)=>{if(sql.includes('FROM audit_events')){assert.doesNotMatch(sql,/JSON_TABLE/);assert.match(sql,/ORDER BY id DESC/);assert.deepEqual(params,['/api/admin/catalog-schema']);return [[
  {actor_name:'Unrelated editor',metadata:JSON.stringify({changes:[{field:'Publisher (publisher) · public',after:'Yes'},{field:'Other (other_publisher) · archived',after:'Yes'}]})},
  {actor_name:'Restore editor',metadata:{changes:[{field:'Publisher (publisher) · archived',after:'No'}]}},
  {metadata:'invalid legacy JSON'}, {metadata:null}, {metadata:{changes:{field:'invalid shape'}}},
  {actor_name:'Library Administrator',occurred_at:'2026-10-10T08:00:00Z',metadata:JSON.stringify({changes:[{field:'Renamed publisher (publisher) · archived',after:'Yes'}]})},
  {actor_name:'Earlier editor',occurred_at:'2026-01-01',metadata:{changes:[{field:'Publisher (publisher) · archived',after:'Yes'}]}},
 ]];}if(sql.includes('FROM catalog_schema'))return [[{key:'publisher',type:'text',scope:'book',archived:1},{key:'legacy',type:'text',scope:'book',archived:1},{key:'active',type:'text',scope:'book',archived:0}]];if(sql.includes('SELECT material_type'))return [[{material_type:'book',metadata:{publisher:'Press'}}]];return [[{total:0}]];};
 try{const result=await configuration.getConfigurationImpact();assert.equal(result.fields.publisher.archivedBy,'Library Administrator');assert.equal(result.fields.publisher.archivedAt,'2026-10-10T08:00:00Z');assert.equal(result.fields.publisher.used,1);assert.equal(result.fields.legacy.archivedBy,undefined);assert.equal(result.fields.active.archivedBy,undefined);}finally{db.query=original;}
});

test('configuration impact skips audit history when no fields are archived',async()=>{
 const original=db.query;
 db.query=async(sql)=>{assert.doesNotMatch(sql,/audit_events|JSON_TABLE/);if(sql.includes('FROM catalog_schema'))return [[{key:'title',type:'text',scope:'shared',archived:0}]];if(sql.includes('SELECT material_type'))return [[]];return [[{total:0}]];};
 try{const result=await configuration.getConfigurationImpact();assert.equal(result.fields.title.used,0);}finally{db.query=original;}
});
if(require.main===module)test.after(()=>db.end());

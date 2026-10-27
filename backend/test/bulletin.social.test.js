const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../db');
const social=require('../modules/bulletin/bulletin.social.repository');
const {normalizePostContent,contentChanged,validateImageDescriptions}=require('../modules/bulletin/bulletin.content');
const audit=require('../modules/analytics/transactional-audit');
const snapshots=require('../modules/backup/snapshot.transforms');
if(require.main===module)test.after(()=>db.end());

test('post edits distinguish published content from management and image storage metadata',()=>{
 const post={title:'Notice',content:'Body',is_pinned:0,gallery:[{url:'https://example.test/a.jpg',alt:'A',public_id:'a'}]};
 assert.equal(contentChanged(post,{...post,is_pinned:1,edited_at:'now'}),false);
 assert.equal(contentChanged(post,{...post,gallery:[{public_id:'another',alt:'A',url:'https://example.test/a.jpg'}]}),false);
 assert.equal(contentChanged(post,{...post,gallery:[{url:'https://example.test/a.jpg',alt:'A poster'}]}),true);
 assert.equal(contentChanged(post,{...post,title:'Changed'}),true);
 assert.throws(()=>normalizePostContent({...post,gallery:Array(9).fill({url:'https://example.test/a.jpg'})}),/eight/);
 assert.throws(()=>normalizePostContent({...post,image_url:'javascript:alert(1)'}),/Invalid image/);
 assert.throws(()=>normalizePostContent({...post,gallery:[{url:'https://example.test',alt:'x'.repeat(501)}]}),/descriptions/);
});

test('content updates enforce ownership and revision, preserve publication dates, and audit atomically',async()=>{
 const oldConnection=db.getConnection,oldAudit=audit.enqueueTransactionalAudit;
 let row={id:4,title:'Notice',content:'Body',gallery:'[]',content_revision:1,edited_at:null,created_at:'2026-01-01',author_id:7};
 let updates=0,audits=0,rollbacks=0,snapshot;
 const conn={beginTransaction:async()=>{snapshot={...row};},commit:async()=>{},rollback:async()=>{rollbacks++;row=snapshot;},release(){},query:async(sql,params)=>{
  if(sql.startsWith('SELECT *')){assert.match(sql,/FOR UPDATE/);return [[row]];}
  if(sql.startsWith('UPDATE bulletin_posts')){updates++;assert.doesNotMatch(sql,/created_at=/);row={...row,title:params[0],content_revision:row.content_revision+1,edited_at:'2026-10-27'};return [{affectedRows:1}];}
  if(sql.startsWith('SELECT id,content_revision'))return [[row]];
  throw new Error(sql);
 }};
 db.getConnection=async()=>conn;audit.enqueueTransactionalAudit=async()=>{audits++;};
 const payload={title:'Notice',content:'Body',gallery:[],content_revision:1};
 try{
  await assert.rejects(social.editPost(4,{id:8,role:'staff'},payload),error=>error.status===403);
  await assert.rejects(social.editPost(4,{id:7,role:'student'},payload),error=>error.status===403);
  await social.editPost(4,{id:7,role:'staff'},payload);assert.equal(updates,0);assert.equal(audits,0);
  await social.editPost(4,{id:7,role:'staff'},{...payload,title:'Updated'});assert.equal(row.content_revision,2);assert.equal(audits,1);assert.equal(row.created_at,'2026-01-01');
  await assert.rejects(social.editPost(4,{id:7,role:'staff'},payload),error=>error.status===409);
  audit.enqueueTransactionalAudit=async()=>{throw new Error('audit failed');};
  await assert.rejects(social.editPost(4,{id:1,role:'super_admin'},{...payload,content_revision:2,title:'Another edit'}),/audit failed/);
  assert.equal(row.content_revision,2);assert.ok(rollbacks>=3);
 }finally{db.getConnection=oldConnection;audit.enqueueTransactionalAudit=oldAudit;}
});

test('Helpful is one public signal and legacy Like toggles remain compatible',async()=>{
 const original=db.getConnection;let selected=false;const calls=[];
 db.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},query:async(sql,args)=>{
  calls.push(sql);if(sql.startsWith('SELECT *'))return [[{id:4,post_type:'announcement'}]];
  if(sql.startsWith('INSERT IGNORE INTO bulletin_helpful')){selected=true;return [{affectedRows:1}];}
  if(sql.startsWith('DELETE FROM bulletin_helpful')){selected=false;return [{affectedRows:1}];}
  if(sql.startsWith('SELECT user_id FROM bulletin_helpful'))return [selected?[{user_id:7}]:[]];
  if(sql.includes('AS helpful_count'))return [[{helpful_count:selected?1:0,helpful_by_me:selected?1:0,interested_count:0,interested_by_me:0,saved_by_me:0}]];
  return [{affectedRows:1}];
 }});
 try{assert.equal((await social.setReaction(4,7,'like')).helpful_by_me,true);const result=await social.setReaction(4,7,'thanks');assert.equal(result.helpful_count,1);assert.equal(result.reaction_counts.thanks,0);assert.equal((await social.setReaction(4,7,'like',true)).helpful_count,0);assert.equal((await social.setReaction(4,7,'like',true)).liked_by_me,true);await assert.rejects(social.setReaction(4,7,'angry'),e=>e.status===400);assert.ok(calls.some(sql=>sql.startsWith('INSERT IGNORE')));}finally{db.getConnection=original;}
});

test('reply insertion rejects another post, removed parents, and archived posts before writing',async()=>{
 const original=db.getConnection;let parentExists=false,postExists=true,inserted=0,rollbacks=0;
 db.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{rollbacks++;},release(){},query:async(sql,args)=>{
  if(sql.startsWith('SELECT *'))return [postExists?[{id:4}]:[]];
  if(sql.startsWith('SELECT id FROM bulletin_comments')){assert.match(sql,/post_id=\? AND deleted_at IS NULL AND hidden_at IS NULL FOR UPDATE/);assert.deepEqual(args,[22,4]);return [parentExists?[{id:22}]:[]];}
  if(sql.startsWith('INSERT INTO bulletin_comments')){inserted++;assert.deepEqual(args,[4,7,'Reply',22]);return [{insertId:23}];}
  return [[{id:23,parent_id:22,text:'Reply'}]];
 }});
 try{
  await assert.rejects(social.addReply(4,7,'Reply',22),error=>error.status===409);assert.equal(inserted,0);
  parentExists=true;assert.equal((await social.addReply(4,7,'Reply',22)).parent_id,22);
  postExists=false;await assert.rejects(social.addReply(4,7,'Reply',22),error=>error.status===404);
  assert.equal(inserted,1);assert.equal(rollbacks,2);
 }finally{db.getConnection=original;}
});

test('legacy backups acquire edited defaults, parent relationships, and Like reactions',()=>{
 const backup={format:'euc-library-backup',version:21,tables:{bulletin_posts:[{id:4}],bulletin_comments:[{id:8}],bulletin_likes:[{post_id:4,user_id:7,created_at:'2026-01-01'}]}};
 backup.integrity={algorithm:'sha256',checksum:snapshots.payloadChecksum(backup)};
 const upgraded=snapshots.upgradeBackup(backup);
 assert.equal(upgraded.version,25);assert.equal(upgraded.tables.bulletin_posts[0].edited_at,null);assert.equal(upgraded.tables.bulletin_posts[0].content_revision,1);assert.equal(upgraded.tables.bulletin_comments[0].parent_id,null);
 assert.deepEqual(upgraded.tables.bulletin_reactions,[{post_id:4,user_id:7,reaction:'like',created_at:'2026-01-01',consolidated_at:'2026-01-01'}]);assert.equal(upgraded.integrity.checksum,snapshots.payloadChecksum(upgraded));
});

test('post edit routes restrict roles and reaction writes require an active login',async()=>{
 const jwt=require('../modules/auth/jwt.util'),sessions=require('../modules/auth/authSession.service');
 const original={verify:jwt.verifyAccessToken,current:sessions.isAccessTokenCurrent,active:sessions.isUserAccessActive};
 const paths=['../modules/auth/auth.middleware','../modules/bulletin/bulletin.routes'];const cache=paths.map(path=>[require.resolve(path),require.cache[require.resolve(path)]]);
 jwt.verifyAccessToken=role=>({id:7,role});sessions.isAccessTokenCurrent=async()=>true;sessions.isUserAccessActive=async()=>true;
 for(const [path] of cache)delete require.cache[path];
 try{
  const router=require(paths[1]);
  const editGate=router.stack.find(layer=>layer.route?.path==='/:postId'&&layer.route.methods.patch).route.stack[0].handle;
  const reactionGate=router.stack.find(layer=>layer.route?.path==='/:postId/reaction'&&layer.route.methods.put).route.stack[0].handle;
  for(const role of ['student','staff','admin','super_admin']){
   let allowed=false,status;await editGate({headers:{authorization:`Bearer ${role}`}},{status(value){status=value;return this;},json(){}},()=>{allowed=true;});assert.equal(allowed,role!=='student');if(!allowed)assert.equal(status,403);
  }
  let status;await reactionGate({headers:{}},{status(value){status=value;return this;},json(){}},()=>assert.fail('anonymous reaction allowed'));assert.equal(status,401);
  for(const routePath of ['/:postId/comments/:commentId/likes','/:postId/reactions','/:postId/likes','/:postId/my-comments']){
   const gate=router.stack.find(layer=>layer.route?.path===routePath&&layer.route.methods.get).route.stack[0].handle;
   await gate({headers:{}},{status(value){status=value;return this;},json(){}},()=>assert.fail('anonymous identity/private access allowed'));assert.equal(status,401);
  }
  for(const role of ['student','staff','admin','super_admin']){
   const gate=router.stack.find(layer=>layer.route?.path==='/moderation/stats').route.stack[0].handle;let allowed=false;
   await gate({headers:{authorization:`Bearer ${role}`}},{status(value){status=value;return this;},json(){}},()=>{allowed=true;});assert.equal(allowed,['admin','super_admin'].includes(role));
  }
  const savedRoute=router.stack.find(layer=>layer.route?.path==='/saved').route;await savedRoute.stack[0].handle({headers:{}},{status(value){status=value;return this;},json(){}},()=>assert.fail('anonymous private saves allowed'));assert.equal(status,401);
  const savedRepo=require('../modules/bulletin/bulletin.saves.repository'),oldSaved=savedRepo.savedPosts;let recipient;savedRepo.savedPosts=async(userId)=>{recipient=userId;return {data:[]};};try{await savedRoute.stack[savedRoute.stack.length-1].handle({user:{id:7},query:{userId:8,page:'1'}},{json(){}},()=>{});assert.equal(recipient,7);}finally{savedRepo.savedPosts=oldSaved;}
 }finally{jwt.verifyAccessToken=original.verify;sessions.isAccessTokenCurrent=original.current;sessions.isUserAccessActive=original.active;for(const[path,value]of cache){if(value)require.cache[path]=value;else delete require.cache[path];}}
});

test('new image attachments require descriptions in public and Website Content publishing',()=>{
 const image={title:'Notice',content:'Body',image_url:'https://example.test/poster.jpg',image_alt:'',gallery:[]};
 assert.throws(()=>validateImageDescriptions(image),/description/);
 assert.doesNotThrow(()=>validateImageDescriptions({...image,image_alt:'Opening hours poster'}));
 assert.doesNotThrow(()=>validateImageDescriptions(image,image));
 assert.throws(()=>validateImageDescriptions({...image,gallery:[{url:'https://example.test/new.jpg',alt:'   '}]},image),/description/);
 const {validatePublished}=require('../modules/publishing/publishing.validation');
 assert.throws(()=>validatePublished('bulletin',{items:[{...image,post_type:'announcement'}]},{items:[]}),/description/);
});
test('comment reports verify the active post and persist an audit event in the same transaction',async()=>{
 const original=db.getConnection,oldAudit=audit.enqueueTransactionalAudit;let exists=true,event,commits=0,rollbacks=0;
 db.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>{commits++;},rollback:async()=>{rollbacks++;},release(){},query:async(sql,args)=>{
  if(sql.includes('FROM bulletin_posts'))return [[{id:4}]];
  if(sql.includes('FROM bulletin_comments')){assert.deepEqual(args,[22,4]);return [exists?[{id:22,post_id:4,user_id:8,text:'Reported text'}]:[]];}
  if(sql.startsWith('SELECT'))return [[]];
  return [{insertId:9,affectedRows:1}];
 }});audit.enqueueTransactionalAudit=async(_conn,value)=>{event=value;};
 try{await social.reportComment(4,22,{id:7,role:'student'});assert.equal(event.action,'reported');assert.equal(event.extraMetadata.commentId,22);assert.equal(commits,1);
 await assert.rejects(social.reportComment(4,22,{id:8,role:'student'}),error=>error.status===400);
 exists=false;await assert.rejects(social.reportComment(4,22,{id:7,role:'student'}),error=>error.status===404);assert.equal(rollbacks,2);
 }finally{db.getConnection=original;audit.enqueueTransactionalAudit=oldAudit;}
});

test('bulletin student names use first name and surname initial while staff retain their names',()=>{
 const {bulletinName}=require('../modules/bulletin/bulletin.identity');
 assert.equal(bulletinName('Myra Dela Cruz','student'),'Myra C.');assert.equal(bulletinName('  Ana   Santos  ','student'),'Ana S.');assert.equal(bulletinName('Lee','student'),'Lee');assert.equal(bulletinName('Library Staff Member','staff'),'Library Staff Member');
});

test('version 22 snapshots gain discussion defaults and retain current Helpful records',()=>{
 const backup={format:'euc-library-backup',version:22,tables:{bulletin_posts:[{id:4}],bulletin_comments:[{id:8}],bulletin_comment_helpful:[{comment_id:8,user_id:7}]}};backup.integrity={algorithm:'sha256',checksum:snapshots.payloadChecksum(backup)};
 const result=snapshots.upgradeBackup(backup);assert.equal(result.version,25);assert.equal(result.tables.bulletin_posts[0].comments_locked,0);assert.equal(result.tables.bulletin_comments[0].hidden_at,null);assert.equal(result.tables.bulletin_comments[0].client_request_id,null);assert.deepEqual(result.tables.bulletin_comment_helpful,[{comment_id:8,user_id:7}]);assert.equal(result.integrity.checksum,snapshots.payloadChecksum(result));
});

test('comment Helpful metadata normalizes SQL text counts and selections',()=>{
 const {publicComment}=require('../modules/bulletin/bulletin.identity');
 const empty=publicComment({author:'Myra Dela Cruz',author_role:'student',helpful_count:'0',helpful_by_me:'0'});assert.equal(empty.helpful_count,0);assert.equal(empty.helpful_by_me,false);assert.equal(empty.author,'Myra C.');
 const selected=publicComment({author:'Library Staff',author_role:'staff',helpful_count:'1',helpful_by_me:'1'});assert.equal(selected.helpful_count,1);assert.equal(selected.helpful_by_me,true);
});

test('old backup reactions consolidate once without creating private saves or losing event interest',()=>{
 const source={format:'euc-library-backup',version:23,tables:{bulletin_posts:[{id:1,post_type:'announcement'},{id:2,post_type:'event'}],bulletin_reactions:[{post_id:1,user_id:7,reaction:'thanks',created_at:'2026-01-01'},{post_id:2,user_id:7,reaction:'interested',created_at:'2026-01-02'}]}};source.integrity={algorithm:'sha256',checksum:snapshots.payloadChecksum(source)};
 const result=snapshots.upgradeBackup(source);assert.deepEqual(result.tables.bulletin_helpful,[{post_id:1,user_id:7,created_at:'2026-01-01'}]);assert.deepEqual(result.tables.bulletin_event_interest,[{post_id:2,user_id:7,created_at:'2026-01-02'}]);assert.deepEqual(result.tables.bulletin_saves,[]);assert.equal(result.tables.bulletin_reactions[0].reaction,'thanks');assert.deepEqual(snapshots.upgradeBackup(result),result);
});

test('read-only comment refreshes do not produce mutation audit events',()=>{
 const logger=require('../middlewares/auditLogger');assert.equal(logger.getAuditPolicy('POST','/api/bulletin/4/comment-snapshots'),null);assert.ok(logger.getAuditPolicy('PATCH','/api/bulletin/moderation/3'));
});


test('author withdrawal closes only pending automatic cases without reports and preserves history idempotently',async()=>{
 const moderation=require('../modules/bulletin/bulletin.moderation.repository');
 const fixtures=[
  {name:'automatic author withdrawal',comment:{},item:{},reports:0,closes:true},
  {name:'reader report',comment:{},item:{},reports:1,closes:false},
  {name:'moderator deletion',comment:{deleted_by:9},item:{},reports:0,closes:false},
  {name:'live comment',comment:{deleted_at:null},item:{},reports:0,closes:false},
  {name:'previously approved comment',comment:{moderation_status:'published'},item:{},reports:0,closes:false},
  {name:'staff case',comment:{},item:{source:'staff'},reports:0,closes:false},
  {name:'reader case',comment:{},item:{source:'report'},reports:0,closes:false},
  {name:'resolved case',comment:{},item:{status:'resolved'},reports:0,closes:false},
 ];
 for(const fixture of fixtures){
  const comment={user_id:7,deleted_by:7,deleted_at:'2026-10-28',moderation_status:'pending',...fixture.comment};
  const item={id:4,status:'open',source:'screening',...fixture.item};let updates=0,history=0;
  const conn={query:async(sql,args)=>{
   if(sql.startsWith('SELECT user_id')){assert.match(sql,/FOR UPDATE/);return [[comment]];}
   if(sql.startsWith('SELECT id,status')){assert.match(sql,/FOR UPDATE/);return [[item]];}
   if(sql.startsWith('SELECT COUNT'))return [[{total:fixture.reports}]];
   if(sql.startsWith('UPDATE bulletin_moderation_cases')){assert.match(sql,/revision=revision\+1/);assert.match(sql,/resolved_by=NULL/);item.status='withdrawn';updates++;return [{affectedRows:1}];}
   if(sql.startsWith('INSERT INTO bulletin_moderation_actions')){assert.equal(args[2],'withdrawn');assert.equal(args[1],7);history++;return [{insertId:1}];}
   throw new Error(sql);
  }};
  await moderation.withdrawAutoCase(conn,8,7);await moderation.withdrawAutoCase(conn,8,7);
  assert.equal(updates,fixture.closes?1:0,fixture.name);assert.equal(history,updates,fixture.name);
 }
});

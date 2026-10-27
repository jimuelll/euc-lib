const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const db=require('../db');
const social=require('../modules/bulletin/bulletin.social.repository');
const posts=require('../modules/bulletin/bulletin.service');
const saves=require('../modules/bulletin/bulletin.saves.repository');
const discussion=require('../modules/bulletin/bulletin.discussion.repository');
const publishing=require('../modules/publishing/publishing.service');
const {migrateBulletinSocial}=require('../scripts/migrate-bulletin-social');
const enabled=process.env.RUN_DB_INTEGRATION==='1'&&process.env.DB_NAME==='euc_bulletin_social_test';
if(require.main===module)test.after(()=>db.end());
test('database: edits, CMS conflicts, nested replies, legacy reactions and concurrent writes preserve bulletin invariants',{skip:enabled?false:'requires dedicated euc_bulletin_social_test schema'},async()=>{
 const ids=[],postIds=[],prefix=`BULLETIN-${randomUUID().slice(0,12)}`;
 try{
  for(let i=0;i<3;i++){const [user]=await db.query("INSERT INTO users(student_employee_id,username,name,password_hash,role,is_active,must_change_password) VALUES (?,?,?,'unusable','staff',1,0)",[`${prefix}-${i}`,`${prefix}-${i}`,`Bulletin fixture ${i}`]);ids.push(user.insertId);}
  const [[clock]]=await db.query('SELECT @@session.time_zone AS zone,CURRENT_TIMESTAMP() AS clock_now');assert.equal(clock.zone,'+00:00');assert.ok(Math.abs(new Date(clock.clock_now).getTime()-Date.now())<5000,'database timestamps must represent the current UTC instant');
  const actor={id:ids[0],role:'staff'},other={id:ids[1],role:'staff'};
  for(let i=0;i<2;i++){const post=await posts.createPost(actor,{title:`${prefix} ${i}`,content:'Original body',is_pinned:false,gallery:[{url:'https://example.test/image.jpg',alt:'Poster'}]});postIds.push(post.id);}
  const [id,secondId]=postIds;
  let detail=await posts.getPostById(id,actor.id);const initialDate=detail.created_at;
  const content={title:detail.title,content:detail.content,image_url:detail.image_url,image_alt:detail.image_alt,gallery:JSON.parse(detail.gallery),content_revision:1};
  await social.editPost(id,actor,content);detail=await posts.getPostById(id,actor.id);assert.equal(detail.edited_at,null);assert.equal(detail.content_revision,1);
  await assert.rejects(social.editPost(id,other,content),error=>error.status===403);
  const before=await publishing.read('bulletin');
  const edits=await Promise.allSettled([social.editPost(id,actor,{...content,title:'First edit'}),social.editPost(id,{...other,role:'admin'},{...content,title:'Second edit'})]);
  assert.equal(edits.filter(result=>result.status==='fulfilled').length,1);assert.equal(edits.filter(result=>result.status==='rejected'&&result.reason.status===409).length,1);
  detail=await posts.getPostById(id,actor.id);assert.equal(detail.content_revision,2);assert.ok(detail.edited_at);assert.deepEqual(detail.created_at,initialDate);
  await assert.rejects(publishing.mutate('bulletin','publish',{...before,itemKey:String(id),payload:{items:before.payload.items.map(item=>item.id===id?{...item,title:'Old draft'}:item)}},actor.id),error=>error.status===409);
  const current=await publishing.read('bulletin');await publishing.mutate('bulletin','publish',{...current,itemKey:String(id),payload:{items:current.payload.items.map(item=>item.id===id?{...item,title:'CMS edit'}:item)}},actor.id);
  detail=await posts.getPostById(id,actor.id);assert.equal(detail.content_revision,3);assert.equal(detail.title,'CMS edit');
  const root=await social.addReply(id,actor.id,'Root',null),child=await social.addReply(id,other.id,'Child',root.id),grandchild=await social.addReply(id,actor.id,'Grandchild',child.id);
  assert.ok(Math.abs(new Date(child.created_at).getTime()-Date.now())<5000,'a new reply must not appear hours in the future');
  await assert.rejects(social.addReply(secondId,actor.id,'Wrong post',root.id),error=>error.status===409);
  await social.reportComment(id,child.id,actor);
  const [[report]]=await db.query("SELECT payload FROM delivery_outbox WHERE event_type='audit' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.action'))='reported' ORDER BY created_at DESC LIMIT 1");assert.ok(report);const reportEvent=typeof report.payload==='string'?JSON.parse(report.payload):report.payload;assert.equal(reportEvent.metadata.commentId,child.id);
  await assert.rejects(social.reportComment(secondId,child.id,actor),error=>error.status===404);
  await social.removeComment(id,root.id,actor);const roots=await social.comments(id,null,1);assert.equal(roots.data.find(row=>row.id===root.id).text,'');assert.ok(roots.data.find(row=>row.id===root.id).deleted_at);
  assert.equal((await social.comments(id,root.id,1)).data[0].id,child.id);assert.equal((await social.comments(id,child.id,1)).data[0].id,grandchild.id);
  for(let i=0;i<11;i++)await social.addReply(id,actor.id,`Nested page ${i}`,child.id);
  assert.equal((await social.comments(id,child.id,1)).data.length,10);assert.equal((await social.comments(id,child.id,1)).hasMore,true);assert.equal((await social.comments(id,child.id,2)).data.length,2);
  await assert.rejects(social.addReply(id,actor.id,'Removed target',root.id),error=>error.status===409);
  for(let i=0;i<21;i++)await social.addReply(id,actor.id,`Page comment ${i}`,null);
  assert.equal((await social.comments(id,null,1)).data.length,20);assert.equal((await social.comments(id,null,1)).hasMore,true);assert.ok((await social.comments(id,null,2)).data.length>0);
  await db.query("INSERT INTO bulletin_likes(post_id,user_id,created_at) VALUES (?,?,'2026-01-01 00:00:00')",[secondId,actor.id]);await migrateBulletinSocial(db);
  const [[legacy]]=await db.query('SELECT reaction,created_at FROM bulletin_reactions WHERE post_id=? AND user_id=?',[secondId,actor.id]);assert.equal(legacy.reaction,'like');assert.equal(legacy.created_at.toISOString(),'2026-01-01T00:00:00.000Z');
  await Promise.all(Array.from({length:12},(_,i)=>social.setReaction(id,actor.id,['like','helpful','thanks','interested'][i%4])));
  const summary=await social.postReactionSummary(id,actor.id);assert.equal(summary.reaction_total,1);assert.equal(Object.values(summary.reaction_counts).reduce((a,b)=>a+b,0),1);
  await social.setReaction(id,actor.id,null);assert.equal((await social.postReactionSummary(id,actor.id)).reaction_total,0);

  await db.query("UPDATE users SET name='Myra Dela Cruz',role='student' WHERE id=?",[ids[2]]);
  const request=randomUUID();const studentComment=await social.addReply(id,ids[2],'Student feedback',null,request);assert.equal(studentComment.author,'Myra C.');assert.equal(studentComment.author_role,'student');
  const duplicates=await Promise.all(Array.from({length:5},()=>social.addReply(id,ids[2],'Student feedback',null,request)));assert.ok(duplicates.every(c=>c.id===studentComment.id));
  await assert.rejects(social.addReply(secondId,ids[2],'Wrong request',null,request),error=>error.status===409);
  await Promise.all(Array.from({length:5},()=>discussion.helpful(id,studentComment.id,actor.id,true)));let help=await discussion.helpful(id,studentComment.id,other.id,true);assert.equal(help.helpful_count,2);
  help=await discussion.helpful(id,studentComment.id,other.id,false);assert.equal(help.helpful_count,1);
  assert.equal((await social.comments(id,null,1,actor.id,'helpful')).data[0].id,studentComment.id);
  await assert.rejects(discussion.moderate(id,studentComment.id,{id:ids[2],role:'student'},{action:'pinned',value:true}),error=>error.status===403);
  await discussion.moderate(id,studentComment.id,actor,{action:'pinned',value:true});for(const order of ['oldest','newest','helpful'])assert.equal((await social.comments(id,null,1,actor.id,order)).data[0].id,studentComment.id);assert.equal((await social.comments(id,null,1,actor.id)).data[0].id,studentComment.id);
  await assert.rejects(discussion.moderate(id,child.id,actor,{action:'pinned',value:true}),error=>error.status===400);
  await discussion.moderate(id,child.id,actor,{action:'hidden',value:true});await assert.rejects(social.addReply(id,other.id,'Hidden target',child.id),error=>error.status===409);await assert.rejects(discussion.helpful(id,child.id,other.id,true),error=>error.status===404);let thread=await discussion.context(id,grandchild.id,actor.id);assert.equal(thread.ancestors.length,2);assert.equal(thread.ancestors[1].text,'');assert.ok(thread.ancestors[1].hidden_at);assert.equal(thread.comment.id,grandchild.id);
  await assert.rejects(discussion.context(secondId,studentComment.id,actor.id),error=>error.status===404);
  await assert.rejects(discussion.moderate(id,child.id,actor,{action:'hidden',value:false}),e=>e.status===403);await discussion.moderate(id,child.id,{...actor,role:'admin'},{action:'hidden',value:false});assert.equal((await discussion.context(id,child.id,actor.id)).comment.text,'Child');
  await assert.rejects(discussion.lockComments(id,other,true),error=>error.status===403);await discussion.lockComments(id,actor,true);
  await assert.rejects(social.addReply(id,actor.id,'Locked',null),error=>error.status===409);
  assert.equal((await social.addReply(id,ids[2],'Student feedback',null,request)).id,studentComment.id);await discussion.lockComments(id,actor,false);
  let update=await discussion.updates(id,studentComment.id,actor.id);assert.equal(Number(update.new_count),0);const freshReply=await social.addReply(id,other.id,'A new reply',studentComment.id);update=await discussion.updates(id,studentComment.id,actor.id);assert.equal(Number(update.new_count),1);assert.equal(Number(update.newest_other_id),freshReply.id);
  assert.equal((await social.comments(id,null,1,null,'newest')).data[0].id,studentComment.id);await assert.rejects(social.comments(id,null,1,null,'random'),error=>error.status===400);

  const [[legacyHelpful]]=await db.query('SELECT created_at FROM bulletin_helpful WHERE post_id=? AND user_id=?',[secondId,actor.id]);assert.equal(legacyHelpful.created_at.toISOString(),'2026-01-01T00:00:00.000Z');
  await social.setHelpful(secondId,actor.id,false);await migrateBulletinSocial(db);assert.equal((await social.postReactionSummary(secondId,actor.id)).helpful_count,0,'rerunning migration must not resurrect a removed Helpful');
  await assert.rejects(social.setInterest(id,actor.id,true),e=>e.status===400);
  await db.query("UPDATE bulletin_posts SET post_type='event' WHERE id=?",[secondId]);await Promise.all(Array.from({length:6},()=>social.setInterest(secondId,actor.id,true)));await social.setHelpful(secondId,actor.id,true);
  let eventSummary=await social.postReactionSummary(secondId,actor.id);assert.equal(eventSummary.helpful_count,1);assert.equal(eventSummary.interested_count,1);assert.equal(eventSummary.interested_by_me,true);
  await social.setHelpful(secondId,actor.id,false);assert.equal((await social.postReactionSummary(secondId,actor.id)).interested_count,1);await social.setInterest(secondId,actor.id,false);
  await Promise.all(Array.from({length:6},()=>saves.setSaved(id,actor.id,true)));assert.equal((await saves.savedPosts(actor.id,1)).data.length,1);assert.equal((await saves.savedPosts(other.id,1)).data.length,0);assert.equal((await social.postReactionSummary(id,other.id)).saved_by_me,false);assert.equal((await social.postReactionSummary(id,actor.id)).saved_by_me,true);
  await posts.deletePost(id,actor);await assert.rejects(social.addReply(id,actor.id,'Archived reply',null),error=>error.status===404);await assert.rejects(social.setReaction(id,actor.id,'thanks'),error=>error.status===404);const savedArchive=(await saves.savedPosts(actor.id,1)).data[0];assert.equal(savedArchive.unavailable,true);assert.equal(savedArchive.title,'');assert.equal(savedArchive.excerpt,'');await saves.setSaved(id,actor.id,false);assert.equal((await saves.savedPosts(actor.id,1)).data.length,0);
 }finally{
  for(const id of postIds){await db.query('DELETE a FROM bulletin_moderation_actions a JOIN bulletin_moderation_cases c ON c.id=a.case_id WHERE c.post_id=?',[id]);await db.query('DELETE r FROM bulletin_comment_reports r JOIN bulletin_moderation_cases c ON c.id=r.case_id WHERE c.post_id=?',[id]);await db.query('DELETE FROM bulletin_moderation_cases WHERE post_id=?',[id]);for(const table of ['bulletin_helpful','bulletin_saves','bulletin_event_interest'])await db.query(`DELETE FROM ${table} WHERE post_id=?`,[id]);await db.query('DELETE FROM bulletin_reactions WHERE post_id=?',[id]);await db.query('DELETE FROM bulletin_likes WHERE post_id=?',[id]);await db.query('DELETE h FROM bulletin_comment_helpful h JOIN bulletin_comments c ON c.id=h.comment_id WHERE c.post_id=?',[id]);await db.query('DELETE FROM bulletin_comments WHERE post_id=? ORDER BY id DESC',[id]);await db.query('DELETE FROM bulletin_posts WHERE id=?',[id]);}
  await db.query("DELETE FROM delivery_outbox WHERE event_type='audit'");await db.query("DELETE FROM website_content_drafts WHERE section='bulletin'");
  for(const id of ids)await db.query('DELETE FROM users WHERE id=?',[id]);
 }
});

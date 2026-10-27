import type {Pool,PoolConnection,RowDataPacket,ResultSetHeader} from 'mysql2/promise';
import {contentChanged,normalizePostContent,validateImageDescriptions} from './bulletin.content';
import {bulletinName,publicComment} from './bulletin.identity';
import {visibleComments} from './bulletin.visibility';
import {screenComment} from './bulletin.moderation.rules';
import audit = require('../analytics/transactional-audit');
const db=require('../../db') as Pool;
export const reactionKinds=['like','helpful','thanks','interested'] as const;
const fail=(message:string,status=400):never=>{throw Object.assign(new Error(message),{status});};
export async function transaction<T>(work:(conn:PoolConnection)=>Promise<T>){const conn=await db.getConnection();try{await conn.beginTransaction();const result=await work(conn);await conn.commit();return result;}catch(error){await conn.rollback();throw error;}finally{conn.release();}}
export async function lockPost(conn:PoolConnection,id:number){const [[post]]=await conn.query<RowDataPacket[]>('SELECT * FROM bulletin_posts WHERE id=? AND deleted_at IS NULL FOR UPDATE',[id]);if(!post)fail('Post not found',404);return post;}
export async function editPost(id:number,actor:{id:number;role:string},input:any){
 const content=normalizePostContent(input);
 if(!Number.isSafeInteger(input.content_revision)||input.content_revision<1)fail('Reload the post before editing.');
 return transaction(async conn=>{const before=await lockPost(conn,id);
  if(!['admin','super_admin'].includes(actor.role)&&!(actor.role==='staff'&&Number(before.author_id)===actor.id))fail('Forbidden',403);
  if(Number(before.content_revision)!==input.content_revision)fail('This post was edited by someone else. Reload the latest post before saving.',409);
  validateImageDescriptions(content,before);
  const after={...before,...content};if(!contentChanged(before,after))return {id,content_revision:before.content_revision,edited_at:before.edited_at};
  await conn.query('UPDATE bulletin_posts SET title=?,excerpt=?,content=?,image_url=?,image_public_id=?,image_alt=?,gallery=?,edited_at=UTC_TIMESTAMP(3),content_revision=content_revision+1 WHERE id=?',[content.title,content.content.slice(0,500),content.content,content.image_url,content.image_public_id,content.image_alt||null,JSON.stringify(content.gallery),id]);
  await audit.enqueueTransactionalAudit(conn,{actorId:actor.id,route:`/api/bulletin/${id}`,category:'content',description:`Edited bulletin post ${id}`,before,after});
  const [[saved]]=await conn.query<RowDataPacket[]>('SELECT id,content_revision,edited_at FROM bulletin_posts WHERE id=?',[id]);return saved;
 });
}
export async function reactionSummary(conn:Pool|PoolConnection,postId:number,userId:number|null){
 const [[row]]=await conn.query<RowDataPacket[]>(`SELECT
 (SELECT COUNT(*) FROM bulletin_helpful WHERE post_id=?) AS helpful_count,
 EXISTS(SELECT 1 FROM bulletin_helpful WHERE post_id=? AND user_id=?) AS helpful_by_me,
 (SELECT COUNT(*) FROM bulletin_event_interest WHERE post_id=?) AS interested_count,
 EXISTS(SELECT 1 FROM bulletin_event_interest WHERE post_id=? AND user_id=?) AS interested_by_me,
 EXISTS(SELECT 1 FROM bulletin_saves WHERE post_id=? AND user_id=?) AS saved_by_me`,[postId,postId,userId,postId,postId,userId,postId,userId]);
 const count=Number(row.helpful_count),interested=Number(row.interested_count),mine=Boolean(Number(row.helpful_by_me));
 return {helpful_count:count,helpful_by_me:mine,interested_count:interested,interested_by_me:Boolean(Number(row.interested_by_me)),saved_by_me:Boolean(Number(row.saved_by_me)),
  reaction_counts:{like:0,helpful:count,thanks:0,interested},reaction_total:count,my_reaction:mine?'helpful':Number(row.interested_by_me)>0?'interested':null,likes:count,liked_by_me:mine};
}
export const postReactionSummary=(postId:number,userId:number|null)=>reactionSummary(db,postId,userId);
export async function setHelpful(postId:number,userId:number,selected:boolean){return transaction(async conn=>{await lockPost(conn,postId);if(selected)await conn.query('INSERT IGNORE INTO bulletin_helpful(post_id,user_id) VALUES (?,?)',[postId,userId]);else await conn.query('DELETE FROM bulletin_helpful WHERE post_id=? AND user_id=?',[postId,userId]);return reactionSummary(conn,postId,userId);});}
export async function setInterest(postId:number,userId:number,selected:boolean){return transaction(async conn=>{const post=await lockPost(conn,postId);if(post.post_type!=='event')fail('Interest is available only on event posts.');if(selected)await conn.query('INSERT IGNORE INTO bulletin_event_interest(post_id,user_id) VALUES (?,?)',[postId,userId]);else await conn.query('DELETE FROM bulletin_event_interest WHERE post_id=? AND user_id=?',[postId,userId]);return reactionSummary(conn,postId,userId);});}
// Older Like/reaction clients continue to work; personal saves always require an explicit Save.
export async function setReaction(postId:number,userId:number,kind:string|null|undefined,toggleLike=false){
 if(kind!==null&&!reactionKinds.includes(kind as any))fail('Choose a valid reaction.');
 if(toggleLike)return transaction(async conn=>{await lockPost(conn,postId);const [[old]]=await conn.query<RowDataPacket[]>('SELECT user_id FROM bulletin_helpful WHERE post_id=? AND user_id=?',[postId,userId]);if(old)await conn.query('DELETE FROM bulletin_helpful WHERE post_id=? AND user_id=?',[postId,userId]);else await conn.query('INSERT IGNORE INTO bulletin_helpful(post_id,user_id) VALUES (?,?)',[postId,userId]);return reactionSummary(conn,postId,userId);});
 if(kind==='interested')return transaction(async conn=>{const post=await lockPost(conn,postId);const table=post.post_type==='event'?'bulletin_event_interest':'bulletin_helpful';await conn.query(`INSERT IGNORE INTO ${table}(post_id,user_id) VALUES (?,?)`,[postId,userId]);return reactionSummary(conn,postId,userId);});
 if(kind===null)return transaction(async conn=>{await lockPost(conn,postId);await conn.query('DELETE FROM bulletin_helpful WHERE post_id=? AND user_id=?',[postId,userId]);await conn.query('DELETE FROM bulletin_event_interest WHERE post_id=? AND user_id=?',[postId,userId]);return reactionSummary(conn,postId,userId);});
 return setHelpful(postId,userId,true);
}
export async function readers(postId:number,kind:string,page:number){
 const [[post]]=await db.query<RowDataPacket[]>('SELECT id,post_type FROM bulletin_posts WHERE id=? AND deleted_at IS NULL',[postId]);if(!post)fail('Post not found',404);
 if(kind!=='all'&&!reactionKinds.includes(kind as any))fail('Choose a valid reaction.');
 const interest=kind==='interested'&&post.post_type==='event',table=interest?'bulletin_event_interest':'bulletin_helpful';
 const [rows]=await db.query<RowDataPacket[]>(`SELECT u.id,u.name,u.role,r.created_at FROM ${table} r JOIN users u ON u.id=r.user_id WHERE r.post_id=? ORDER BY r.created_at DESC,r.user_id DESC LIMIT 21 OFFSET ?`,[postId,(page-1)*20]);
 return {data:rows.slice(0,20).map(row=>({...row,name:bulletinName(row.name,row.role),reaction:interest?'interested':'helpful'})),hasMore:rows.length>20,page};
}
export const commentSelect=`SELECT bc.id,bc.parent_id,bc.deleted_at,bc.hidden_at,bc.pinned_at,bc.client_request_id,bc.moderation_status,
 CASE WHEN bc.deleted_at IS NULL AND bc.hidden_at IS NULL THEN bc.text ELSE '' END AS text,bc.created_at,
 CASE WHEN bc.deleted_at IS NULL AND bc.hidden_at IS NULL THEN u.name ELSE '' END AS author,
 CASE WHEN bc.deleted_at IS NULL AND bc.hidden_at IS NULL THEN u.id ELSE NULL END AS author_id,u.role AS author_role,
 (SELECT COUNT(*) FROM bulletin_comments child WHERE child.parent_id=bc.id) AS reply_count,
 (SELECT COUNT(*) FROM bulletin_comment_helpful h WHERE h.comment_id=bc.id) AS helpful_count,
 EXISTS(SELECT 1 FROM bulletin_comment_helpful h WHERE h.comment_id=bc.id AND h.user_id=?) AS helpful_by_me
 FROM bulletin_comments bc JOIN users u ON u.id=bc.user_id`;
export async function comments(postId:number,parentId:number|null,page:number,userId:number|null=null,sort=parentId?'oldest':'helpful'){
 const [[post]]=await db.query<RowDataPacket[]>('SELECT id FROM bulletin_posts WHERE id=? AND deleted_at IS NULL',[postId]);if(!post)fail('Post not found',404);
 if(!['oldest','newest','helpful'].includes(sort))fail('Choose a valid comment order.');
 if(parentId){const [[parent]]=await db.query<RowDataPacket[]>('SELECT id FROM bulletin_comments WHERE id=? AND post_id=?',[parentId,postId]);if(!parent)fail('Comment not found',404);}
 const visibility=await visibleComments(db,postId);
 if(!visibility.ids.length)return {data:[],hasMore:false,page,latest_id:0};
 const limit=parentId?10:20;
 const order=sort==='newest'?'bc.created_at DESC,bc.id DESC':sort==='helpful'?'helpful_count DESC,bc.created_at,bc.id':'bc.created_at,bc.id';
 const [rows]=await db.query<RowDataPacket[]>(`${commentSelect} WHERE bc.post_id=? AND bc.parent_id <=> ? AND bc.id IN (?) ORDER BY bc.pinned_at IS NOT NULL DESC,${order} LIMIT ? OFFSET ?`,[userId,postId,parentId,visibility.ids,limit+1,(page-1)*limit]);
 const [[latest]]=await db.query<RowDataPacket[]>('SELECT COALESCE(MAX(id),0) AS latest_id FROM bulletin_comments WHERE post_id=?',[postId]);
 return {data:rows.slice(0,limit).map(row=>publicComment({...row,reply_count:visibility.children.get(Number(row.id))||0})),hasMore:rows.length>limit,page,latest_id:Number(latest.latest_id)};
}
export async function addReply(postId:number,userId:number,text:string,parentId:number|null,requestId?:string){
 if(typeof text!=='string'||!text.trim()||text.trim().length>1000)fail('Enter a comment of up to 1,000 characters.');
 if(requestId&&(typeof requestId!=='string'||!/^[a-zA-Z0-9-]{16,36}$/.test(requestId)))fail('Invalid submission reference.');
 return transaction(async conn=>{const post=await lockPost(conn,postId);
  if(requestId){const [[existing]]=await conn.query<RowDataPacket[]>(`${commentSelect} WHERE bc.user_id=? AND bc.client_request_id=?`,[userId,userId,requestId]);if(existing){const [[owner]]=await conn.query<RowDataPacket[]>('SELECT post_id FROM bulletin_comments WHERE id=?',[existing.id]);if(Number(owner.post_id)!==postId)fail('Submission reference belongs to another post.',409);return publicComment(existing);}}
  if(post.comments_locked)fail('Comments are locked on this post.',409);
  const screening=screenComment(text);if(screening.action==='revise')throw Object.assign(new Error(screening.reason),{status:422,code:'COMMENT_REVISION_REQUIRED'});
  if(parentId){const [[parent]]=await conn.query<RowDataPacket[]>('SELECT id FROM bulletin_comments WHERE id=? AND post_id=? AND deleted_at IS NULL AND hidden_at IS NULL FOR UPDATE',[parentId,postId]);if(!parent)fail('The comment you are replying to is no longer available.',409);}
  const [result]=await conn.query<ResultSetHeader>(requestId?'INSERT INTO bulletin_comments (post_id,user_id,text,parent_id,client_request_id) VALUES (?,?,?,?,?)':'INSERT INTO bulletin_comments (post_id,user_id,text,parent_id) VALUES (?,?,?,?)',requestId?[postId,userId,text.trim(),parentId,requestId]:[postId,userId,text.trim(),parentId]);
  if(screening.action==='hold'){await conn.query("UPDATE bulletin_comments SET hidden_at=UTC_TIMESTAMP(3),moderation_status='pending',moderation_reason=? WHERE id=?",[screening.reason,result.insertId]);const item=await require('./bulletin.moderation.repository').openCase(conn,{id:result.insertId,post_id:postId,text:text.trim()},'screening',screening.reason,screening.priority);await audit.enqueueTransactionalAudit(conn,{route:`/api/bulletin/${postId}/comments`,category:'content',action:'held',description:`Held bulletin comment ${result.insertId} for review`,type:'comment_moderation',extraMetadata:{postId,commentId:result.insertId,caseId:item.id,rule:screening.rule}});}
  const [[row]]=await conn.query<RowDataPacket[]>(`${commentSelect} WHERE bc.id=?`,[userId,result.insertId]);return publicComment(row);
 });
}
export async function removeComment(postId:number,commentId:number,actor:{id:number;role:string}){
  return transaction(async conn=>{await lockPost(conn,postId);const [[row]]=await conn.query<RowDataPacket[]>('SELECT user_id FROM bulletin_comments WHERE id=? AND post_id=? AND deleted_at IS NULL FOR UPDATE',[commentId,postId]);if(!row)fail('Comment not found',404);const isAuthor=Number(row.user_id)===Number(actor.id);if(!isAuthor&&!['admin','super_admin'].includes(actor.role))fail('Forbidden',403);await conn.query('UPDATE bulletin_comments SET deleted_at=NOW(),deleted_by=? WHERE id=?',[actor.id,commentId]);await require('./bulletin.moderation.repository').withdrawAutoCase(conn,commentId,actor.id);});
}

export async function reportComment(postId:number,commentId:number,actor:{id:number;role:string},input:any={}){return require('./bulletin.moderation.repository').report(postId,commentId,actor,input);}

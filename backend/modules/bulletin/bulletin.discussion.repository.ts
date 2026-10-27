import type {Pool,RowDataPacket} from 'mysql2/promise';
import {transaction,lockPost,commentSelect} from './bulletin.social.repository';
import {publicComment,bulletinName} from './bulletin.identity';
import {visibleComments} from './bulletin.visibility';
import audit = require('../analytics/transactional-audit');
const db=require('../../db') as Pool;
const fail=(message:string,status=400):never=>{throw Object.assign(new Error(message),{status});};
type Actor={id:number;role:string};
const staff=(actor:Actor)=>['staff','admin','super_admin'].includes(actor.role);
export async function helpful(postId:number,commentId:number,userId:number,selected:boolean){
 return transaction(async conn=>{await lockPost(conn,postId);
  const [[comment]]=await conn.query<RowDataPacket[]>('SELECT id FROM bulletin_comments WHERE id=? AND post_id=? AND deleted_at IS NULL AND hidden_at IS NULL FOR UPDATE',[commentId,postId]);if(!comment)fail('Comment unavailable',404);
  if(selected)await conn.query('INSERT IGNORE INTO bulletin_comment_helpful(comment_id,user_id) VALUES (?,?)',[commentId,userId]);
  else await conn.query('DELETE FROM bulletin_comment_helpful WHERE comment_id=? AND user_id=?',[commentId,userId]);
  const [[summary]]=await conn.query<RowDataPacket[]>('SELECT COUNT(*) AS helpful_count,EXISTS(SELECT 1 FROM bulletin_comment_helpful WHERE comment_id=? AND user_id=?) AS helpful_by_me FROM bulletin_comment_helpful WHERE comment_id=?',[commentId,userId,commentId]);return {helpful_count:Number(summary.helpful_count),helpful_by_me:Number(summary.helpful_by_me)>0};
 });
}
export async function moderate(postId:number,commentId:number,actor:Actor,input:any){
 if(!staff(actor))fail('Forbidden',403);
 if(input.action==='hidden'&&input.value===false&&!['admin','super_admin'].includes(actor.role))fail('An administrator must review a hidden comment before restoring it.',403);
 if(!['hidden','pinned'].includes(input.action)||typeof input.value!=='boolean')fail('Invalid moderation action.');
 return transaction(async conn=>{await lockPost(conn,postId);
  const [[comment]]=await conn.query<RowDataPacket[]>('SELECT * FROM bulletin_comments WHERE id=? AND post_id=? AND deleted_at IS NULL FOR UPDATE',[commentId,postId]);if(!comment)fail('Comment not found',404);
  if(input.action==='hidden'&&input.value===false&&Number(comment.user_id)===actor.id)fail('Another administrator must review your hidden comment before restoring it.',403);
  if(input.action==='pinned'&&comment.parent_id)fail('Only top-level comments can be pinned.');
  if(input.action==='hidden'&&comment.moderation_status==='pending')fail('Held comments must be reviewed in the moderation inbox.',409);
  const reason=typeof input.reason==='string'?input.reason.trim():'Hidden by library staff. Request a review if you believe this was a mistake.';if(reason.length>500)fail('Use a moderation reason of 500 characters or fewer.');
  const field=input.action==='hidden'?'hidden':'pinned';
  await conn.query(`UPDATE bulletin_comments SET ${field}_at=${input.value?'UTC_TIMESTAMP(3)':'NULL'},${field}_by=? WHERE id=?`,[input.value?actor.id:null,commentId]);
  if(input.action==='hidden'){await conn.query('UPDATE bulletin_comments SET moderation_reason=? WHERE id=?',[input.value?reason:null,commentId]);if(input.value)await require('./bulletin.moderation.repository').openCase(conn,comment,'staff',reason,'normal',actor.id);else await require('./bulletin.moderation.repository').recordVisibilityChange(conn,commentId,actor.id,'Comment made visible by library staff.');}
  await audit.enqueueTransactionalAudit(conn,{actorId:actor.id,route:`/api/bulletin/${postId}/comments/${commentId}/moderation`,category:'content',action:input.action,description:`${input.value?'Set':'Removed'} ${field} state on bulletin comment ${commentId}`,extraMetadata:{postId,commentId,value:input.value}});
  return {updated:true};
 });
}
export async function lockComments(postId:number,actor:Actor,locked:boolean){
 if(typeof locked!=='boolean')fail('Choose a valid discussion state.');
 return transaction(async conn=>{const post=await lockPost(conn,postId);
  if(!['admin','super_admin'].includes(actor.role)&&!(actor.role==='staff'&&Number(post.author_id)===actor.id))fail('Forbidden',403);
  await conn.query('UPDATE bulletin_posts SET comments_locked=? WHERE id=?',[locked,postId]);
  await audit.enqueueTransactionalAudit(conn,{actorId:actor.id,route:`/api/bulletin/${postId}/discussion`,category:'content',action:locked?'locked':'unlocked',description:`${locked?'Locked':'Unlocked'} comments on bulletin post ${postId}`,extraMetadata:{postId}});return {comments_locked:locked};
 });
}
export async function updates(postId:number,afterId:number,userId:number|null){
 const [[post]]=await db.query<RowDataPacket[]>('SELECT comments_locked FROM bulletin_posts WHERE id=? AND deleted_at IS NULL',[postId]);if(!post)fail('Post not found',404);
 const [[row]]=await db.query<RowDataPacket[]>('SELECT COALESCE(MAX(id),0) AS latest_id,COALESCE(SUM(id>? AND deleted_at IS NULL AND hidden_at IS NULL AND user_id<>?),0) AS new_count,COALESCE(MAX(CASE WHEN id>? AND deleted_at IS NULL AND hidden_at IS NULL AND user_id<>? THEN id ELSE 0 END),0) AS newest_other_id,COALESCE(SUM(deleted_at IS NULL AND hidden_at IS NULL),0) AS comment_count FROM bulletin_comments WHERE post_id=?',[afterId,userId||0,afterId,userId||0,postId]);return {latest_id:Number(row.latest_id),new_count:Number(row.new_count),newest_other_id:Number(row.newest_other_id),comment_count:Number(row.comment_count),comments_locked:Boolean(post.comments_locked)};
}
export async function context(postId:number,commentId:number,userId:number|null){
 const [[post]]=await db.query<RowDataPacket[]>('SELECT id FROM bulletin_posts WHERE id=? AND deleted_at IS NULL',[postId]);if(!post)fail('Post not found',404);
 const visibility=await visibleComments(db,postId);if(!visibility.visible.has(commentId))fail('Comment unavailable',404);
 const ancestors:any[]=[];let next:number|null=commentId;
 while(next&&ancestors.length<100){const [rows]:[RowDataPacket[],unknown]=await db.query<RowDataPacket[]>(`${commentSelect} WHERE bc.id=? AND bc.post_id=?`,[userId,next,postId]);const row:RowDataPacket=rows[0];if(!row)return fail('Comment unavailable',404);ancestors.unshift(publicComment({...row,reply_count:visibility.children.get(Number(row.id))||0}));next=row.parent_id?Number(row.parent_id):null;}
 if(next)fail('This thread is too deep to open directly.');
 return {comment:ancestors.pop(),ancestors};
}

export async function likers(postId:number,commentId:number,page:number){
 const [[comment]]=await db.query<RowDataPacket[]>('SELECT c.id FROM bulletin_comments c JOIN bulletin_posts p ON p.id=c.post_id WHERE c.id=? AND c.post_id=? AND c.deleted_at IS NULL AND c.hidden_at IS NULL AND p.deleted_at IS NULL',[commentId,postId]);if(!comment)fail('Comment unavailable',404);
 const [rows]=await db.query<RowDataPacket[]>('SELECT u.id,u.name,u.role,h.created_at FROM bulletin_comment_helpful h JOIN users u ON u.id=h.user_id WHERE h.comment_id=? ORDER BY h.created_at DESC,h.user_id DESC LIMIT 21 OFFSET ?',[commentId,(page-1)*20]);return {data:rows.slice(0,20).map(row=>({...row,name:bulletinName(row.name,row.role)})),page,hasMore:rows.length>20};
}

// Refresh only comments already loaded by this reader; never insert newly posted rows.
export async function publicSnapshots(postId:number,userId:number|null,ids:unknown){
 if(!Array.isArray(ids)||ids.length>500||ids.some(value=>!Number.isSafeInteger(value)||value<1))fail('Choose up to 500 valid comment IDs.');
 const known=ids as number[];
 return transaction(async conn=>{await lockPost(conn,postId);if(!known.length)return {data:[]};const visibility=await visibleComments(conn,postId);
  const [rows]=await conn.query<RowDataPacket[]>(`${commentSelect} WHERE bc.post_id=? AND bc.id IN (?)`,[userId,postId,known]);
  const records=new Map(rows.map(row=>[Number(row.id),row]));return {data:known.map(id=>{const row=records.get(id);return {id,comment:row&&visibility.visible.has(id)?publicComment({...row,reply_count:visibility.children.get(id)||0}):null};})};
 });
}

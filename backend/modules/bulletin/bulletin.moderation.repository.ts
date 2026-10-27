import type {Pool,PoolConnection,RowDataPacket,ResultSetHeader} from 'mysql2/promise';
import {transaction,lockPost} from './bulletin.social.repository';
import notifications = require('../notifications/notifications.service');
import audit = require('../analytics/transactional-audit');
const db=require('../../db') as Pool;
type Actor={id:number;role:string};
const fail=(message:string,status=400):never=>{throw Object.assign(new Error(message),{status});};
export const reportReasons=['harassment','hate','threat','sexual','spam','personal_information','other'] as const;
const requireReviewer=(actor:Actor)=>{if(!['admin','super_admin'].includes(actor.role))fail('Forbidden',403);};
const note=(value:unknown,max=1000)=>{if(typeof value!=='string'||value.trim().length<3||value.trim().length>max)fail(`Enter a reason of 3-${max} characters.`);return (value as string).trim();};
async function event(conn:PoolConnection,caseId:number,actorId:number|null,action:string,reason:string){await conn.query('INSERT INTO bulletin_moderation_actions(case_id,actor_id,action,reason) VALUES (?,?,?,?)',[caseId,actorId,action,reason]);}
async function alert(conn:PoolConnection,item:any){for(const role of ['admin','super_admin'])await notifications.enqueueNotification(conn,{type:'moderation',title:item.priority==='urgent'?'Priority comment review needed':'Comment awaiting review',body:item.priority==='urgent'?'A comment was flagged for a possible threat or serious harm. Review its context promptly.':'A bulletin comment is waiting in the moderation inbox.',href:`/admin/moderation?case=${item.id}`,audienceType:'role',audienceRole:role,sourceType:'bulletin_moderation',sourceId:String(item.id),deliveryKey:`moderation:${item.id}:${item.revision}:${role}`});}
export async function openCase(conn:PoolConnection,comment:any,source:string,reason:string,priority='normal',actorId:number|null=null){
 const [[existing]]=await conn.query<RowDataPacket[]>('SELECT * FROM bulletin_moderation_cases WHERE comment_id=? FOR UPDATE',[comment.id]);
 let item:any,notify=false;
 if(existing){const nextPriority=existing.status==='open'&&existing.priority==='urgent'?'urgent':priority;notify=existing.status!=='open'||(nextPriority==='urgent'&&existing.priority!=='urgent');
  await conn.query("UPDATE bulletin_moderation_cases SET status='open',priority=?,screening_reason=COALESCE(?,screening_reason),opened_at=IF(resolved_at IS NULL,opened_at,UTC_TIMESTAMP(3)),resolved_at=NULL,resolved_by=NULL,resolution_reason=NULL,revision=revision+1,updated_at=UTC_TIMESTAMP(3) WHERE id=?",[nextPriority,['screening','staff'].includes(source)?reason:null,existing.id]);
  item={...existing,status:'open',priority:nextPriority,revision:Number(existing.revision)+1};
 }else{const [result]=await conn.query<ResultSetHeader>('INSERT INTO bulletin_moderation_cases(comment_id,post_id,source,priority,snapshot_text,screening_reason) VALUES (?,?,?,?,?,?)',[comment.id,comment.post_id,source,priority,comment.text,['screening','staff'].includes(source)?reason:null]);item={id:result.insertId,revision:1,priority};notify=true;}
 await event(conn,item.id,actorId,source==='report'?'reported':source,reason);
 if(notify)await alert(conn,item);
 return item;
}
export async function report(postId:number,commentId:number,actor:Actor,input:any={}){
 const reason=input.reason||'other';if(!reportReasons.includes(reason))fail('Choose a valid report reason.');
 const details=input.details===undefined?'':String(input.details).trim();if(details.length>1000)fail('Report details must be 1,000 characters or fewer.');
 return transaction(async conn=>{await lockPost(conn,postId);
  const [[old]]=await conn.query<RowDataPacket[]>('SELECT r.id FROM bulletin_comment_reports r JOIN bulletin_moderation_cases c ON c.id=r.case_id WHERE c.comment_id=? AND c.post_id=? AND r.reporter_id=?',[commentId,postId,actor.id]);if(old)return {reported:true,duplicate:true};
  const [[comment]]=await conn.query<RowDataPacket[]>('SELECT * FROM bulletin_comments WHERE id=? AND post_id=? AND deleted_at IS NULL AND hidden_at IS NULL FOR UPDATE',[commentId,postId]);if(!comment)fail('Comment unavailable',404);
  if(Number(comment.user_id)===actor.id)fail('You can delete your own comment from its options menu.');
  const item=await openCase(conn,comment,'report',`Reader report: ${reason}`,reason==='threat'?'urgent':'normal',actor.id);
  await conn.query('INSERT INTO bulletin_comment_reports(case_id,reporter_id,reason,details) VALUES (?,?,?,?)',[item.id,actor.id,reason,details||null]);
  await audit.enqueueTransactionalAudit(conn,{actorId:actor.id,route:`/api/bulletin/${postId}/comments/${commentId}/report`,category:'content',action:'reported',description:`Reported comment ${commentId} on bulletin post ${postId}`,type:'comment_report',extraMetadata:{postId,commentId,caseId:item.id,reason,commentAuthorId:comment.user_id}});
  return {reported:true,duplicate:false};
 });
}
export async function stats(actor:Actor){requireReviewer(actor);const [[row]]=await db.query<RowDataPacket[]>("SELECT COUNT(*) AS pending,COALESCE(SUM(priority='urgent'),0) AS urgent,MIN(opened_at) AS oldest FROM bulletin_moderation_cases WHERE status='open'");return {pending:Number(row.pending),urgent:Number(row.urgent),oldest:row.oldest};}
export async function list(actor:Actor,status:string,page:number){requireReviewer(actor);if(!['open','resolved','dismissed','withdrawn','all'].includes(status))fail('Choose a valid review status.');
 const [rows]=await db.query<RowDataPacket[]>(`SELECT c.*,p.title AS post_title,u.name AS author_name,(SELECT COUNT(*) FROM bulletin_comment_reports r WHERE r.case_id=c.id) AS report_count FROM bulletin_moderation_cases c JOIN bulletin_posts p ON p.id=c.post_id JOIN bulletin_comments bc ON bc.id=c.comment_id JOIN users u ON u.id=bc.user_id ${status==='all'?'':'WHERE c.status=?'} ORDER BY (c.status='open') DESC,(c.priority='urgent') DESC,c.opened_at,c.id LIMIT 21 OFFSET ?`,[...(status==='all'?[]:[status]),(page-1)*20]);
 return {data:rows.slice(0,20).map(row=>({...row,report_count:Number(row.report_count)})),page,hasMore:rows.length>20};
}
export async function detail(actor:Actor,caseId:number){requireReviewer(actor);
 const [[item]]=await db.query<RowDataPacket[]>('SELECT c.*,p.title AS post_title,p.deleted_at AS post_archived_at,bc.user_id AS author_id,bc.parent_id,bc.deleted_at,bc.hidden_at,bc.moderation_status,bc.moderation_reason,u.name AS author_name FROM bulletin_moderation_cases c JOIN bulletin_posts p ON p.id=c.post_id JOIN bulletin_comments bc ON bc.id=c.comment_id JOIN users u ON u.id=bc.user_id WHERE c.id=?',[caseId]);if(!item)fail('Review case unavailable',404);
 const [reports]=await db.query<RowDataPacket[]>('SELECT r.*,u.name AS reporter_name FROM bulletin_comment_reports r JOIN users u ON u.id=r.reporter_id WHERE r.case_id=? ORDER BY r.created_at,r.id',[caseId]);
 const [actions]=await db.query<RowDataPacket[]>('SELECT a.*,u.name AS actor_name FROM bulletin_moderation_actions a LEFT JOIN users u ON u.id=a.actor_id WHERE a.case_id=? ORDER BY a.id DESC',[caseId]);
 const [context]=await db.query<RowDataPacket[]>('SELECT bc.id,bc.parent_id,bc.text,bc.deleted_at,bc.hidden_at,bc.created_at,u.name AS author_name FROM bulletin_comments bc JOIN users u ON u.id=bc.user_id WHERE bc.post_id=? AND (bc.id=? OR bc.id=? OR bc.parent_id=?) ORDER BY bc.created_at,bc.id LIMIT 21',[item.post_id,item.comment_id,item.parent_id,item.comment_id]);
 const own=Number(item.author_id)===actor.id;
 return {...item,can_review:!own,reports:own?reports.map(({reporter_id,...row})=>({...row,reporter_name:'Identity withheld',details:null})):reports,actions:own?actions.map(({actor_id,...row})=>row.action==='reported'?{...row,actor_name:'Identity withheld'}:row):actions,context:context.slice(0,20),context_has_more:context.length>20};
}
export async function review(actor:Actor,caseId:number,input:any){requireReviewer(actor);const reason=note(input.reason);if(!['dismiss','hide','restore'].includes(input.action))fail('Choose a valid review action.');if(!Number.isSafeInteger(input.revision))fail('Reload this case before reviewing.');
 return transaction(async conn=>{const [[reference]]=await conn.query<RowDataPacket[]>('SELECT post_id,comment_id FROM bulletin_moderation_cases WHERE id=?',[caseId]);if(!reference)fail('Review case unavailable',404);
  await conn.query('SELECT id FROM bulletin_posts WHERE id=? FOR UPDATE',[reference.post_id]);
  const [[comment]]=await conn.query<RowDataPacket[]>('SELECT * FROM bulletin_comments WHERE id=? FOR UPDATE',[reference.comment_id]);
  const [[item]]=await conn.query<RowDataPacket[]>('SELECT * FROM bulletin_moderation_cases WHERE id=? FOR UPDATE',[caseId]);if(item.status==='withdrawn')fail('This comment was withdrawn and no longer requires review.',409);if(Number(item.revision)!==input.revision)fail('This case changed. Reload it before deciding.',409);
  if(Number(comment.user_id)===actor.id)fail('Another administrator must review reports about your own comment.',403);
  if(input.action!=='dismiss'&&comment.deleted_at)fail('A deleted comment cannot be restored or hidden. You can close its report with a recorded decision.',409);
  if(input.action==='dismiss'&&comment.moderation_status==='pending'&&!comment.deleted_at)fail('Approve or hide a held comment before closing its case.');
  if(input.action!=='dismiss')await conn.query(`UPDATE bulletin_comments SET hidden_at=${input.action==='hide'?'UTC_TIMESTAMP(3)':'NULL'},hidden_by=?,moderation_status='published',moderation_reason=? WHERE id=?`,[input.action==='hide'?actor.id:null,input.action==='hide'?reason:null,comment.id]);
  await conn.query("UPDATE bulletin_moderation_cases SET status=?,resolution_reason=?,resolved_at=UTC_TIMESTAMP(3),resolved_by=?,appealed_at=NULL,revision=revision+1,updated_at=UTC_TIMESTAMP(3) WHERE id=?",[input.action==='dismiss'?'dismissed':'resolved',reason,actor.id,caseId]);
  await event(conn,caseId,actor.id,input.action,reason);
  await audit.enqueueTransactionalAudit(conn,{actorId:actor.id,route:`/api/bulletin/moderation/${caseId}`,category:'content',action:input.action,description:`Reviewed bulletin comment ${comment.id}`,extraMetadata:{postId:reference.post_id,commentId:comment.id,caseId,reason}});
  if(input.action!=='dismiss')await notifications.enqueueNotification(conn,{type:'moderation',title:'Your comment review was updated',body:input.action==='restore'?'Your comment was approved or restored. It will appear where the post is publicly available.':input.action==='hide'?`Your comment was hidden: ${reason}`:'Your comment report was reviewed.',href:`/bulletin?post=${reference.post_id}`,audienceType:'user',audienceUserId:comment.user_id,sourceType:'bulletin_moderation_decision',sourceId:String(caseId),deliveryKey:`moderation-decision:${caseId}:${input.revision}`});
  return {reviewed:true};
 });
}
export async function myComments(postId:number,userId:number,page:number){const [[post]]=await db.query<RowDataPacket[]>('SELECT id FROM bulletin_posts WHERE id=? AND deleted_at IS NULL',[postId]);if(!post)fail('Post unavailable',404);
 const [rows]=await db.query<RowDataPacket[]>("SELECT bc.id,bc.text,bc.created_at,bc.moderation_status,bc.moderation_reason,c.appealed_at,c.status AS case_status FROM bulletin_comments bc LEFT JOIN bulletin_moderation_cases c ON c.comment_id=bc.id WHERE bc.post_id=? AND bc.user_id=? AND bc.deleted_at IS NULL AND bc.hidden_at IS NOT NULL ORDER BY bc.id DESC LIMIT 21 OFFSET ?",[postId,userId,(page-1)*20]);return {data:rows.slice(0,20),page,hasMore:rows.length>20};
}
export async function reconsider(postId:number,commentId:number,actor:Actor,input:any){const reason=note(input.reason);
 return transaction(async conn=>{await lockPost(conn,postId);const [[comment]]=await conn.query<RowDataPacket[]>('SELECT * FROM bulletin_comments WHERE id=? AND post_id=? AND user_id=? AND hidden_at IS NOT NULL AND deleted_at IS NULL FOR UPDATE',[commentId,postId,actor.id]);if(!comment)fail('Comment unavailable',404);
  const [[existing]]=await conn.query<RowDataPacket[]>('SELECT * FROM bulletin_moderation_cases WHERE comment_id=? FOR UPDATE',[commentId]);if(existing?.appealed_at)return {requested:true};
  const item=await openCase(conn,comment,'appeal',reason,existing?.priority||'normal',actor.id);await conn.query('UPDATE bulletin_moderation_cases SET appealed_at=UTC_TIMESTAMP(3) WHERE id=?',[item.id]);return {requested:true};
 });
}

export async function recordVisibilityChange(conn:PoolConnection,commentId:number,actorId:number,reason:string){const [[item]]=await conn.query<RowDataPacket[]>('SELECT id FROM bulletin_moderation_cases WHERE comment_id=? FOR UPDATE',[commentId]);if(!item)return;await event(conn,item.id,actorId,'restored_by_staff',reason);await conn.query('UPDATE bulletin_moderation_cases SET revision=revision+1,updated_at=UTC_TIMESTAMP(3) WHERE id=?',[item.id]);}

// The caller holds the post lock, shared by reporting, review and deletion.
export async function withdrawAutoCase(conn:PoolConnection,commentId:number,actorId:number){
 const [[comment]]=await conn.query<RowDataPacket[]>('SELECT user_id,deleted_by,deleted_at,moderation_status FROM bulletin_comments WHERE id=? FOR UPDATE',[commentId]);
 if(!comment?.deleted_at||comment.moderation_status!=='pending'||Number(comment.user_id)!==actorId||Number(comment.deleted_by)!==actorId)return;
 const [[item]]=await conn.query<RowDataPacket[]>('SELECT id,status,source FROM bulletin_moderation_cases WHERE comment_id=? FOR UPDATE',[commentId]);
 if(!item||item.status!=='open'||item.source!=='screening')return;
 const [[reports]]=await conn.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM bulletin_comment_reports WHERE case_id=?',[item.id]);
 if(Number(reports.total))return;
 const reason='Author withdrew the automatically held comment. No reader reports require review.';
 await conn.query("UPDATE bulletin_moderation_cases SET status='withdrawn',resolution_reason=?,resolved_at=UTC_TIMESTAMP(3),resolved_by=NULL,appealed_at=NULL,revision=revision+1,updated_at=UTC_TIMESTAMP(3) WHERE id=?",[reason,item.id]);
 await event(conn,item.id,actorId,'withdrawn',reason);
}

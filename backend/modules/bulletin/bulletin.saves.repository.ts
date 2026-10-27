import type {Pool,RowDataPacket} from 'mysql2/promise';
import {transaction,lockPost} from './bulletin.social.repository';
const db=require('../../db') as Pool;
export async function setSaved(postId:number,userId:number,saved:boolean){return transaction(async conn=>{if(saved){await lockPost(conn,postId);await conn.query('INSERT IGNORE INTO bulletin_saves(post_id,user_id) VALUES (?,?)',[postId,userId]);}else await conn.query('DELETE FROM bulletin_saves WHERE post_id=? AND user_id=?',[postId,userId]);return {saved_by_me:saved};});}
export async function savedPosts(userId:number,page:number){
 const [rows]=await db.query<RowDataPacket[]>(`SELECT p.id,p.deleted_at IS NOT NULL AS unavailable,
 CASE WHEN p.deleted_at IS NULL THEN p.title ELSE '' END AS title,
 CASE WHEN p.deleted_at IS NULL THEN LEFT(p.content,240) ELSE '' END AS excerpt,
 CASE WHEN p.deleted_at IS NULL THEN p.image_url ELSE NULL END AS image_url,
 CASE WHEN p.deleted_at IS NULL THEN p.image_alt ELSE '' END AS image_alt,
 p.post_type,p.created_at,s.created_at AS saved_at FROM bulletin_saves s JOIN bulletin_posts p ON p.id=s.post_id WHERE s.user_id=? ORDER BY s.created_at DESC,s.post_id DESC LIMIT 21 OFFSET ?`,[userId,(page-1)*20]);
 return {data:rows.slice(0,20).map(row=>({...row,unavailable:Boolean(Number(row.unavailable))})),page,hasMore:rows.length>20};
}

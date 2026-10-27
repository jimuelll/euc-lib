import type {Pool,RowDataPacket} from 'mysql2/promise';
import {migrateBulletinModeration} from './migrate-bulletin-moderation';
const db=require('../db') as Pool;

// Additive and resumable: never overwrites a user's newer reaction.
export async function migrateBulletinSocial(pool:Pool=db){
 const column=async(table:string,name:string)=>{const [[row]]=await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',[table,name]);return Number(row.total)>0;};
 for(const [table,name,type] of [['bulletin_posts','edited_at','datetime(3) NULL'],['bulletin_posts','content_revision','int unsigned NOT NULL DEFAULT 1'],['bulletin_comments','parent_id','int(11) NULL'],['bulletin_posts','comments_locked','tinyint(1) NOT NULL DEFAULT 0'],['bulletin_comments','hidden_at','datetime(3) NULL'],['bulletin_comments','hidden_by','bigint(20) unsigned NULL'],['bulletin_comments','pinned_at','datetime(3) NULL'],['bulletin_comments','pinned_by','bigint(20) unsigned NULL'],['bulletin_comments','client_request_id','varchar(36) NULL']]){
  if(!await column(table,name))await pool.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
 }
 const [[index]]=await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bulletin_comments' AND INDEX_NAME='idx_bulletin_comment_thread'");
 if(!Number(index.total))await pool.query('ALTER TABLE bulletin_comments ADD KEY idx_bulletin_comment_thread (post_id,parent_id,created_at,id)');
 const [[fk]]=await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='bulletin_comments' AND CONSTRAINT_NAME='fk_bulletin_comment_parent'");
 if(!Number(fk.total))await pool.query('ALTER TABLE bulletin_comments ADD CONSTRAINT fk_bulletin_comment_parent FOREIGN KEY (parent_id) REFERENCES bulletin_comments(id)');
 await pool.query(`CREATE TABLE IF NOT EXISTS bulletin_reactions (
  post_id int(11) NOT NULL,user_id bigint(20) unsigned NOT NULL,
  reaction enum('like','helpful','thanks','interested') NOT NULL,created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (post_id,user_id),KEY idx_bulletin_reaction_kind (post_id,reaction,created_at),
  CONSTRAINT fk_bulletin_reaction_post FOREIGN KEY (post_id) REFERENCES bulletin_posts(id),
  CONSTRAINT fk_bulletin_reaction_user FOREIGN KEY (user_id) REFERENCES users(id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);
 await pool.query(`CREATE TABLE IF NOT EXISTS bulletin_comment_helpful (
  comment_id int(11) NOT NULL,user_id bigint(20) unsigned NOT NULL,created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY(comment_id,user_id),CONSTRAINT fk_comment_helpful_comment FOREIGN KEY(comment_id) REFERENCES bulletin_comments(id),
  CONSTRAINT fk_comment_helpful_user FOREIGN KEY(user_id) REFERENCES users(id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);
 const [[requestIndex]]=await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bulletin_comments' AND INDEX_NAME='uq_bulletin_comment_request'");
 if(!Number(requestIndex.total))await pool.query('ALTER TABLE bulletin_comments ADD UNIQUE KEY uq_bulletin_comment_request (user_id,client_request_id)');
 await pool.query("INSERT IGNORE INTO bulletin_reactions (post_id,user_id,reaction,created_at) SELECT post_id,user_id,'like',MIN(created_at) FROM bulletin_likes GROUP BY post_id,user_id");
 if(!await column('bulletin_reactions','consolidated_at'))await pool.query('ALTER TABLE bulletin_reactions ADD COLUMN consolidated_at datetime(3) NULL');
 for(const table of ['bulletin_helpful','bulletin_saves','bulletin_event_interest'])await pool.query(`CREATE TABLE IF NOT EXISTS ${table} (
  post_id int(11) NOT NULL,user_id bigint(20) unsigned NOT NULL,created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY(post_id,user_id),KEY idx_${table}_user(user_id,created_at,post_id),
  CONSTRAINT fk_${table}_post FOREIGN KEY(post_id) REFERENCES bulletin_posts(id),
  CONSTRAINT fk_${table}_user FOREIGN KEY(user_id) REFERENCES users(id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);
 const conn=await pool.getConnection();try{await conn.beginTransaction();
  await conn.query("INSERT IGNORE INTO bulletin_helpful(post_id,user_id,created_at) SELECT r.post_id,r.user_id,r.created_at FROM bulletin_reactions r JOIN bulletin_posts p ON p.id=r.post_id WHERE r.consolidated_at IS NULL AND (r.reaction<>'interested' OR p.post_type<>'event')");
  await conn.query("INSERT IGNORE INTO bulletin_event_interest(post_id,user_id,created_at) SELECT r.post_id,r.user_id,r.created_at FROM bulletin_reactions r JOIN bulletin_posts p ON p.id=r.post_id WHERE r.consolidated_at IS NULL AND r.reaction='interested' AND p.post_type='event'");
  await conn.query('UPDATE bulletin_reactions SET consolidated_at=UTC_TIMESTAMP(3) WHERE consolidated_at IS NULL');await conn.commit();
 }catch(error){await conn.rollback();throw error;}finally{conn.release();}

 await migrateBulletinModeration(pool);
}
if(require.main===module)migrateBulletinSocial().then(()=>console.log('Bulletin discussion, editing, and reaction schema is ready.')).catch(error=>{console.error('Bulletin migration failed:',error.code||error.message);process.exitCode=1;}).finally(()=>db.end());

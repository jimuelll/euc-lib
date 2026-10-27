import type {Pool,RowDataPacket} from 'mysql2/promise';
export async function migrateBulletinModeration(pool:Pool){
 for(const [name,type] of [['moderation_status',"varchar(20) NOT NULL DEFAULT 'published'"],['moderation_reason','varchar(1000) NULL']]){
  const [[row]]=await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=\'bulletin_comments\' AND COLUMN_NAME=?',[name]);
  if(!Number(row.total))await pool.query(`ALTER TABLE bulletin_comments ADD COLUMN ${name} ${type}`);
 }
 const [[reasonColumn]]=await pool.query<RowDataPacket[]>("SELECT CHARACTER_MAXIMUM_LENGTH AS size FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bulletin_comments' AND COLUMN_NAME='moderation_reason'");
 if(Number(reasonColumn?.size)<1000)await pool.query('ALTER TABLE bulletin_comments MODIFY COLUMN moderation_reason varchar(1000) NULL');
 const statements = `CREATE TABLE IF NOT EXISTS bulletin_moderation_cases (
 id int(11) NOT NULL AUTO_INCREMENT, comment_id int(11) NOT NULL, post_id int(11) NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'open', priority varchar(20) NOT NULL DEFAULT 'normal',
 source varchar(20) NOT NULL DEFAULT 'report', snapshot_text text NOT NULL, screening_reason varchar(500) NULL,
 resolution_reason varchar(1000) NULL, revision int unsigned NOT NULL DEFAULT 1,
 created_at datetime(3) NOT NULL DEFAULT current_timestamp(3), opened_at datetime(3) NOT NULL DEFAULT current_timestamp(3),
 updated_at datetime(3) NOT NULL DEFAULT current_timestamp(3), resolved_at datetime(3) NULL, resolved_by bigint unsigned NULL,
 appealed_at datetime(3) NULL,
 PRIMARY KEY(id), UNIQUE KEY uq_moderation_comment(comment_id), KEY idx_moderation_queue(status,priority,opened_at,id),
 CONSTRAINT fk_moderation_comment FOREIGN KEY(comment_id) REFERENCES bulletin_comments(id),
 CONSTRAINT fk_moderation_post FOREIGN KEY(post_id) REFERENCES bulletin_posts(id),
 CONSTRAINT fk_moderation_reviewer FOREIGN KEY(resolved_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS bulletin_comment_reports (
 id bigint unsigned NOT NULL AUTO_INCREMENT, case_id int(11) NOT NULL, reporter_id bigint unsigned NOT NULL,
 reason varchar(40) NOT NULL, details varchar(1000) NULL, created_at datetime(3) NOT NULL DEFAULT current_timestamp(3),
 PRIMARY KEY(id), UNIQUE KEY uq_comment_reporter(case_id,reporter_id),
 CONSTRAINT fk_report_case FOREIGN KEY(case_id) REFERENCES bulletin_moderation_cases(id),
 CONSTRAINT fk_report_user FOREIGN KEY(reporter_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS bulletin_moderation_actions (
 id bigint unsigned NOT NULL AUTO_INCREMENT, case_id int(11) NOT NULL, actor_id bigint unsigned NULL,
 action varchar(40) NOT NULL, reason varchar(1000) NOT NULL, created_at datetime(3) NOT NULL DEFAULT current_timestamp(3),
 PRIMARY KEY(id), KEY idx_case_actions(case_id,id),
 CONSTRAINT fk_moderation_action_case FOREIGN KEY(case_id) REFERENCES bulletin_moderation_cases(id),
 CONSTRAINT fk_moderation_action_user FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
 for(const statement of statements.split(';').filter(value=>value.trim()))await pool.query(statement);
 // Convert historical audit-only reports into reviewable cases. Never reopen a reviewed case on rerun.
 const [[auditTable]]=await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='audit_events'");
 const sources=[`SELECT JSON_EXTRACT(payload,'$.metadata') AS metadata,JSON_UNQUOTE(JSON_EXTRACT(payload,'$.actorId')) AS actor_id,created_at AS occurred_at FROM delivery_outbox WHERE event_type='audit' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.action'))='reported'`];
 if(Number(auditTable.total))sources.push("SELECT metadata,actor_id,occurred_at FROM audit_events WHERE action='reported' AND JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.type'))='comment_report'");
 for(const query of sources){const [events]=await pool.query<RowDataPacket[]>(query);for(const event of events){let meta:any;try{meta=typeof event.metadata==='string'?JSON.parse(event.metadata):event.metadata;}catch{continue;}
  const commentId=Number(meta?.commentId),reporterId=Number(event.actor_id);if(!commentId||!reporterId)continue;
  const [[comment]]=await pool.query<RowDataPacket[]>('SELECT id,post_id,text FROM bulletin_comments WHERE id=?',[commentId]);if(!comment)continue;
  const [[user]]=await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE id=?',[reporterId]);if(!user)continue;
  await pool.query("INSERT IGNORE INTO bulletin_moderation_cases(comment_id,post_id,snapshot_text,created_at,opened_at) VALUES (?,?,?,?,?)",[comment.id,comment.post_id,comment.text,event.occurred_at,event.occurred_at]);
  const [[item]]=await pool.query<RowDataPacket[]>('SELECT id FROM bulletin_moderation_cases WHERE comment_id=?',[commentId]);
  await pool.query("INSERT IGNORE INTO bulletin_comment_reports(case_id,reporter_id,reason,details,created_at) VALUES (?,?,'other','Imported from an earlier comment report',?)",[item.id,reporterId,event.occurred_at]);
 }}
 // Existing staff-hidden comments remain reviewable in history without creating new alerts.
 await pool.query("INSERT IGNORE INTO bulletin_moderation_cases(comment_id,post_id,status,source,snapshot_text,screening_reason,resolution_reason,resolved_at,resolved_by) SELECT id,post_id,'resolved','staff',text,'Imported staff-hidden comment','Hidden before the moderation inbox was introduced.',hidden_at,hidden_by FROM bulletin_comments WHERE hidden_at IS NOT NULL AND deleted_at IS NULL AND moderation_status='published'");
 await pool.query("UPDATE bulletin_comments SET moderation_reason='Hidden by library staff. You can request reconsideration.' WHERE hidden_at IS NOT NULL AND deleted_at IS NULL AND moderation_reason IS NULL");

 // Repair author-deleted automatic cases from before withdrawal was handled on deletion.
 const [withdrawals]=await pool.query<RowDataPacket[]>("SELECT m.comment_id,m.post_id,c.user_id FROM bulletin_moderation_cases m JOIN bulletin_comments c ON c.id=m.comment_id WHERE m.status='open' AND m.source='screening' AND c.deleted_at IS NOT NULL AND c.moderation_status='pending' AND c.deleted_by=c.user_id AND NOT EXISTS (SELECT 1 FROM bulletin_comment_reports r WHERE r.case_id=m.id)");
 for(const row of withdrawals){const conn=await pool.getConnection();try{await conn.beginTransaction();await conn.query('SELECT id FROM bulletin_posts WHERE id=? FOR UPDATE',[row.post_id]);await require('../modules/bulletin/bulletin.moderation.repository').withdrawAutoCase(conn,Number(row.comment_id),Number(row.user_id));await conn.commit();}catch(error){await conn.rollback();throw error;}finally{conn.release();}}

}

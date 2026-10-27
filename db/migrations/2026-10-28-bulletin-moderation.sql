-- Existing databases: use npm run migrate-bulletin-social for resumable schema setup and report backfill.
ALTER TABLE bulletin_comments ADD COLUMN moderation_status varchar(20) NOT NULL DEFAULT 'published', ADD COLUMN moderation_reason varchar(1000) NULL;
CREATE TABLE IF NOT EXISTS bulletin_moderation_cases (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

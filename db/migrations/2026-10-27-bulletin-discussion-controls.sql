-- For existing installations, run npm run migrate-bulletin-social instead to resume safely.
ALTER TABLE bulletin_posts ADD COLUMN comments_locked tinyint(1) NOT NULL DEFAULT 0;
ALTER TABLE bulletin_comments ADD COLUMN hidden_at datetime(3) NULL, ADD COLUMN hidden_by bigint(20) unsigned NULL,
 ADD COLUMN pinned_at datetime(3) NULL, ADD COLUMN pinned_by bigint(20) unsigned NULL,
 ADD COLUMN client_request_id varchar(36) NULL, ADD UNIQUE KEY uq_bulletin_comment_request (user_id,client_request_id);
CREATE TABLE bulletin_comment_helpful (
 comment_id int(11) NOT NULL,user_id bigint(20) unsigned NOT NULL,created_at timestamp NOT NULL DEFAULT current_timestamp(),
 PRIMARY KEY(comment_id,user_id),
 CONSTRAINT fk_comment_helpful_comment FOREIGN KEY(comment_id) REFERENCES bulletin_comments(id),
 CONSTRAINT fk_comment_helpful_user FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

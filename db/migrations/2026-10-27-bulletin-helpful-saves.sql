-- Prefer npm run migrate-bulletin-social for a resumable existing installation.

ALTER TABLE bulletin_reactions ADD COLUMN consolidated_at datetime(3) NULL;
CREATE TABLE bulletin_helpful (
 post_id int(11) NOT NULL,user_id bigint(20) unsigned NOT NULL,created_at timestamp NOT NULL DEFAULT current_timestamp(),
 PRIMARY KEY(post_id,user_id),KEY idx_bulletin_helpful_user(user_id,created_at,post_id),
 CONSTRAINT fk_bulletin_helpful_post FOREIGN KEY(post_id) REFERENCES bulletin_posts(id),
 CONSTRAINT fk_bulletin_helpful_user FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE bulletin_saves (
 post_id int(11) NOT NULL,user_id bigint(20) unsigned NOT NULL,created_at timestamp NOT NULL DEFAULT current_timestamp(),
 PRIMARY KEY(post_id,user_id),KEY idx_bulletin_saves_user(user_id,created_at,post_id),
 CONSTRAINT fk_bulletin_saves_post FOREIGN KEY(post_id) REFERENCES bulletin_posts(id),
 CONSTRAINT fk_bulletin_saves_user FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE bulletin_event_interest (
 post_id int(11) NOT NULL,user_id bigint(20) unsigned NOT NULL,created_at timestamp NOT NULL DEFAULT current_timestamp(),
 PRIMARY KEY(post_id,user_id),KEY idx_bulletin_event_interest_user(user_id,created_at,post_id),
 CONSTRAINT fk_bulletin_event_interest_post FOREIGN KEY(post_id) REFERENCES bulletin_posts(id),
 CONSTRAINT fk_bulletin_event_interest_user FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
INSERT IGNORE INTO bulletin_helpful(post_id,user_id,created_at) SELECT r.post_id,r.user_id,r.created_at FROM bulletin_reactions r JOIN bulletin_posts p ON p.id=r.post_id WHERE r.consolidated_at IS NULL AND (r.reaction<>'interested' OR p.post_type<>'event');
INSERT IGNORE INTO bulletin_event_interest(post_id,user_id,created_at) SELECT r.post_id,r.user_id,r.created_at FROM bulletin_reactions r JOIN bulletin_posts p ON p.id=r.post_id WHERE r.consolidated_at IS NULL AND r.reaction='interested' AND p.post_type='event';
UPDATE bulletin_reactions SET consolidated_at=UTC_TIMESTAMP(3) WHERE consolidated_at IS NULL;

-- Apply once before deploying the bulletin discussion and editing release.
ALTER TABLE bulletin_posts
  ADD COLUMN edited_at datetime(3) NULL,
  ADD COLUMN content_revision int unsigned NOT NULL DEFAULT 1;
ALTER TABLE bulletin_comments
  ADD COLUMN parent_id int(11) NULL,
  ADD KEY idx_bulletin_comment_thread (post_id,parent_id,created_at,id),
  ADD CONSTRAINT fk_bulletin_comment_parent FOREIGN KEY (parent_id) REFERENCES bulletin_comments(id);
CREATE TABLE bulletin_reactions (
  post_id int(11) NOT NULL,
  user_id bigint(20) unsigned NOT NULL,
  reaction enum('like','helpful','thanks','interested') NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (post_id,user_id),
  KEY idx_bulletin_reaction_kind (post_id,reaction,created_at),
  CONSTRAINT fk_bulletin_reaction_post FOREIGN KEY (post_id) REFERENCES bulletin_posts(id),
  CONSTRAINT fk_bulletin_reaction_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
INSERT INTO bulletin_reactions (post_id,user_id,reaction,created_at)
SELECT post_id,user_id,'like',MIN(created_at) FROM bulletin_likes GROUP BY post_id,user_id;

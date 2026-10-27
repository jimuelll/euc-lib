ALTER TABLE notifications MODIFY COLUMN audience_type enum('all','user','role','users') NOT NULL DEFAULT 'all';

CREATE TABLE IF NOT EXISTS notification_recipients (
  notification_id bigint(20) UNSIGNED NOT NULL,
  user_id bigint(20) UNSIGNED NOT NULL,
  PRIMARY KEY (notification_id,user_id),
  KEY idx_notification_recipients_user (user_id,notification_id),
  CONSTRAINT fk_notification_recipients_notice FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_recipients_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

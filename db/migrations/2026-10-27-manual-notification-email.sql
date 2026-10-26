-- Apply once after the account-email migration, before deploying this release.
-- Existing notifications remain in-app only. No historical email is queued.
ALTER TABLE notifications
  ADD COLUMN email_requested tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN email_batch_id char(36) DEFAULT NULL,
  ADD COLUMN email_expires_at datetime DEFAULT NULL;
ALTER TABLE email_deliveries
  ADD COLUMN notification_id bigint(20) UNSIGNED DEFAULT NULL,
  ADD KEY idx_email_notification (notification_id,status);
-- No foreign key: delivery controls survive application restores independently.

-- Run after 2026-09-23-copy-holdings-and-catalog-visibility.sql.
-- Older loans deliberately receive an unknown policy label. A book's current
-- policy cannot establish which policy was in force when a historical loan
-- was created.
ALTER TABLE `borrowings`
  ADD COLUMN `loan_policy_id_snapshot` bigint(20) UNSIGNED DEFAULT NULL AFTER `copy_id`,
  ADD COLUMN `loan_policy_name_snapshot` varchar(255) NOT NULL DEFAULT 'Unknown historical policy' AFTER `loan_policy_id_snapshot`;

-- Preserve the latest current term if duplicate current flags exist;
-- otherwise make the latest term current. Keep only one current term before
-- adding the unique generated key.
UPDATE `academic_terms` t
JOIN (
  SELECT id FROM (
    SELECT id
    FROM `academic_terms`
    WHERE is_current = 1
    ORDER BY starts_on DESC, id DESC
    LIMIT 1
  ) latest_current
) keeper ON t.is_current = 1 AND t.id <> keeper.id
SET t.is_current = 0;

UPDATE `academic_terms` t
JOIN (
  SELECT id FROM (
    SELECT id FROM `academic_terms` ORDER BY starts_on DESC, id DESC LIMIT 1
  ) latest_term
) latest ON latest.id = t.id
SET t.is_current = 1
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT id FROM `academic_terms` WHERE is_current = 1) current_term
);

ALTER TABLE `academic_terms`
  ADD COLUMN `current_term_key` tinyint(1) GENERATED ALWAYS AS (CASE WHEN `is_current` = 1 THEN 1 ELSE NULL END) STORED,
  ADD UNIQUE KEY `uq_academic_terms_single_current` (`current_term_key`);

ALTER TABLE `notifications`
  ADD COLUMN `delivery_key` varchar(64) DEFAULT NULL,
  ADD UNIQUE KEY `uq_notifications_delivery_key` (`delivery_key`);

ALTER TABLE `audit_events`
  ADD COLUMN `event_key` varchar(64) DEFAULT NULL,
  ADD UNIQUE KEY `uq_audit_events_event_key` (`event_key`);

CREATE TABLE `delivery_outbox` (
  `id` char(36) NOT NULL,
  `event_type` enum('notification','audit') NOT NULL,
  `payload` json NOT NULL,
  `status` enum('pending','delivered') NOT NULL DEFAULT 'pending',
  `attempts` smallint(5) UNSIGNED NOT NULL DEFAULT 0,
  `available_at` datetime NOT NULL DEFAULT current_timestamp(),
  `locked_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `last_error` varchar(1000) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_delivery_outbox_pending` (`status`,`available_at`,`locked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

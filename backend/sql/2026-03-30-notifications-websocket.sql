CREATE TABLE `notifications` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `type` varchar(50) NOT NULL DEFAULT 'announcement',
  `title` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `href` varchar(255) DEFAULT NULL,
  `audience_type` enum('all','user','role') NOT NULL DEFAULT 'all',
  `audience_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `audience_role` enum('employee','alumni','student','scanner','staff','admin','super_admin') DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_notifications_active_created` (`is_active`,`created_at`),
  KEY `idx_notifications_audience_user` (`audience_type`,`audience_user_id`),
  KEY `idx_notifications_audience_role` (`audience_type`,`audience_role`),
  KEY `fk_notifications_created_by` (`created_by`),
  CONSTRAINT `fk_notifications_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_notifications_audience_user` FOREIGN KEY (`audience_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `notification_reads` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `notification_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `read_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notification_reads` (`notification_id`,`user_id`),
  KEY `idx_notification_reads_user` (`user_id`,`read_at`),
  CONSTRAINT `fk_notification_reads_notification` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notification_reads_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `backup_snapshots` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `cloudinary_public_id` varchar(255) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `size_bytes` bigint unsigned NOT NULL,
  `kind` enum('manual','pre_restore') NOT NULL DEFAULT 'manual',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_backup_snapshots_cloudinary_public_id` (`cloudinary_public_id`),
  KEY `idx_backup_snapshots_created_at` (`created_at`),
  KEY `idx_backup_snapshots_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

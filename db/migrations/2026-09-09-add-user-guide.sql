-- Adds editable, role-aware user-guide modules.
-- Draft content is stored separately from the published copy so unfinished
-- edits never replace the guide currently visible to staff.

CREATE TABLE IF NOT EXISTS `user_guide_modules` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` varchar(120) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `draft_content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`draft_content`)),
  `published_content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (`published_content` IS NULL OR json_valid(`published_content`)),
  `is_published` tinyint(1) NOT NULL DEFAULT 0,
  `published_at` datetime DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_guide_slug` (`slug`),
  KEY `idx_user_guide_published_order` (`is_published`,`deleted_at`,`sort_order`),
  KEY `fk_user_guide_created_by` (`created_by`),
  KEY `fk_user_guide_updated_by` (`updated_by`),
  CONSTRAINT `fk_user_guide_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_user_guide_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The application inserts the default guide modules the first time this table
-- is read. Existing content is never overwritten after the first insert.

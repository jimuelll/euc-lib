CREATE TABLE `copy_holdings` (
  `copy_id` int(11) NOT NULL,
  `accession_number` varchar(64) NOT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `program_id` bigint(20) UNSIGNED DEFAULT NULL,
  `course_code` varchar(64) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `date_acquired` date DEFAULT NULL,
  `distributor` varchar(255) DEFAULT NULL,
  `invoice_reference` varchar(128) DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`copy_id`),
  UNIQUE KEY `uq_copy_holdings_accession_number` (`accession_number`),
  KEY `idx_copy_holdings_program` (`program_id`),
  CONSTRAINT `fk_copy_holdings_copy` FOREIGN KEY (`copy_id`) REFERENCES `book_copies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_copy_holdings_program` FOREIGN KEY (`program_id`) REFERENCES `academic_programs` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_copy_holdings_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_copy_holdings_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `catalog_settings` (
  `id` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `show_unheld_in_opac` tinyint(1) NOT NULL DEFAULT 1,
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_catalog_settings_updated_by` (`updated_by`),
  CONSTRAINT `fk_catalog_settings_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `catalog_settings` (`id`, `show_unheld_in_opac`) VALUES (1, 1)
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

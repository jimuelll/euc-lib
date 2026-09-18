CREATE TABLE `departments` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL, `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL, `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(), `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`), UNIQUE KEY `uq_departments_name` (`name`),
  CONSTRAINT `fk_departments_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_departments_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `users`
  ADD COLUMN `library_card_number` varchar(64) DEFAULT NULL AFTER `student_employee_id`,
  ADD COLUMN `student_number` varchar(64) DEFAULT NULL AFTER `library_card_number`,
  ADD COLUMN `employee_number` varchar(64) DEFAULT NULL AFTER `student_number`,
  ADD COLUMN `username` varchar(64) DEFAULT NULL AFTER `employee_number`,
  ADD COLUMN `year_level` enum('1st Year','2nd Year','3rd Year','4th Year','Other') DEFAULT NULL AFTER `program_id`,
  ADD COLUMN `department_id` bigint(20) UNSIGNED DEFAULT NULL AFTER `year_level`,
  ADD COLUMN `remarks` text DEFAULT NULL AFTER `department_id`,
  ADD KEY `idx_users_department` (`department_id`),
  ADD CONSTRAINT `fk_users_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE `users` SET `library_card_number` = `student_employee_id` WHERE `role` IN ('student', 'staff', 'alumni');
UPDATE `users` SET `employee_number` = `student_employee_id` WHERE `role` = 'employee';
UPDATE `users` SET `username` = `student_employee_id` WHERE `role` IN ('admin', 'super_admin', 'scanner');

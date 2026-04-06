-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 02, 2026 at 05:14 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `library`
--

-- --------------------------------------------------------

--
-- Table structure for table `about_settings`
--

CREATE TABLE `about_settings` (
  `id` int(11) NOT NULL,
  `library_name` varchar(255) NOT NULL DEFAULT 'Enverga-Candelaria Library',
  `established` year(4) DEFAULT NULL,
  `mission_title` varchar(255) DEFAULT NULL,
  `mission_text` text DEFAULT NULL,
  `history_title` varchar(255) DEFAULT NULL,
  `history_text` text DEFAULT NULL,
  `policies` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`policies`)),
  `facilities` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`facilities`)),
  `staff` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`staff`)),
  `spaces` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`spaces`)),
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `about_settings`
--


-- --------------------------------------------------------

--
-- Table structure for table `academic_subscriptions`
--

CREATE TABLE `academic_subscriptions` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `url` varchar(2048) NOT NULL,
  `description` text DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `image_url` varchar(2048) DEFAULT NULL,
  `image_public_id` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `academic_subscriptions`
--


-- --------------------------------------------------------

--
-- Table structure for table `attendance_logs`
--

CREATE TABLE `attendance_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `scanned_id` varchar(50) NOT NULL,
  `type` enum('check_in','check_out') NOT NULL,
  `purpose` enum('entry_exit','borrowing') NOT NULL DEFAULT 'entry_exit',
  `borrowing_id` int(11) DEFAULT NULL,
  `scanned_by` bigint(20) UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `attendance_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `auth_refresh_sessions`
--

CREATE TABLE `auth_refresh_sessions` (
  `id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `jti` varchar(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `auth_refresh_sessions`
--


-- --------------------------------------------------------

--
-- Table structure for table `books`
--

CREATE TABLE `books` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `author` varchar(255) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `isbn` varchar(20) DEFAULT NULL,
  `edition` varchar(50) DEFAULT NULL,
  `publication_year` year(4) DEFAULT NULL,
  `copies` int(11) DEFAULT 1,
  `created_by` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `location` text DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL,
  `try` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `books`
--


-- --------------------------------------------------------

--
-- Table structure for table `book_copies`
--

CREATE TABLE `book_copies` (
  `id` int(11) NOT NULL,
  `book_id` int(11) NOT NULL,
  `barcode` varchar(64) NOT NULL,
  `condition` enum('good','damaged','lost') NOT NULL DEFAULT 'good',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `book_copies`
--


-- --------------------------------------------------------

--
-- Table structure for table `borrowings`
--

CREATE TABLE `borrowings` (
  `id` int(11) NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `book_id` int(11) NOT NULL,
  `copy_id` int(11) DEFAULT NULL,
  `borrowed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `due_date` datetime NOT NULL,
  `returned_at` timestamp NULL DEFAULT NULL,
  `status` enum('borrowed','returned','overdue') NOT NULL DEFAULT 'borrowed',
  `notes` text DEFAULT NULL,
  `issued_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_overdue_notification_at` datetime DEFAULT NULL,
  `settled_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `settled_at` datetime DEFAULT NULL,
  `settled_by` bigint(20) UNSIGNED DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `borrowings`
--


-- --------------------------------------------------------

--
-- Table structure for table `bulletin_comments`
--

CREATE TABLE `bulletin_comments` (
  `id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `text` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bulletin_comments`
--


-- --------------------------------------------------------

--
-- Table structure for table `bulletin_likes`
--

CREATE TABLE `bulletin_likes` (
  `id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bulletin_likes`
--


-- --------------------------------------------------------

--
-- Table structure for table `bulletin_posts`
--

CREATE TABLE `bulletin_posts` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `excerpt` varchar(500) NOT NULL,
  `content` text NOT NULL,
  `image_url` varchar(512) DEFAULT NULL,
  `image_public_id` varchar(512) DEFAULT NULL,
  `author_id` bigint(20) UNSIGNED NOT NULL,
  `is_pinned` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bulletin_posts`
--


-- --------------------------------------------------------

--
-- Table structure for table `catalog_schema`
--

CREATE TABLE `catalog_schema` (
  `id` int(11) NOT NULL,
  `key` varchar(64) NOT NULL,
  `label` varchar(255) NOT NULL,
  `type` enum('text','textarea','number','date','select') NOT NULL DEFAULT 'text',
  `options` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`options`)),
  `required` tinyint(1) NOT NULL DEFAULT 0,
  `locked` tinyint(1) NOT NULL DEFAULT 0,
  `order` int(11) NOT NULL DEFAULT 0,
  `public` tinyint(1) NOT NULL DEFAULT 0,
  `archived` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = field removed from active schema but data retained in books table'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `catalog_schema`
--

INSERT INTO `catalog_schema` (`id`, `key`, `label`, `type`, `options`, `required`, `locked`, `order`, `public`, `archived`) VALUES
(87, 'title', 'Book Title', 'text', NULL, 1, 1, 0, 1, 0),
(88, 'author', 'Author', 'text', NULL, 1, 1, 1, 1, 0),
(89, 'isbn', 'ISBN', 'text', NULL, 0, 0, 2, 1, 0),
(90, 'category', 'Category', 'select', '[\"Computer Science\",\"Engineering\",\"Mathematics\",\"Science\",\"Literature\",\"History\",\"Business\",\"Other\"]', 0, 0, 3, 1, 0),
(91, 'edition', 'Edition', 'text', NULL, 0, 0, 6, 1, 1),
(92, 'publication_year', 'Publication Year', 'number', NULL, 0, 0, 7, 1, 1),
(93, 'copies', 'Copies', 'number', NULL, 0, 0, 4, 1, 0),
(94, 'location', 'Location', 'text', NULL, 0, 0, 5, 0, 0),
(103, 'try', 'try', 'text', NULL, 0, 0, 8, 1, 1);


-- --------------------------------------------------------

--
-- Table structure for table `library_circulation_settings`
--

CREATE TABLE `library_circulation_settings` (
  `id` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `overdue_fine_per_hour` decimal(10,2) NOT NULL DEFAULT 1.00,
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ;

--
-- Dumping data for table `library_circulation_settings`
--


-- --------------------------------------------------------

--
-- Table structure for table `library_holidays`
--

CREATE TABLE `library_holidays` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `holiday_date` date NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'announcement',
  `title` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `href` varchar(255) DEFAULT NULL,
  `audience_type` enum('all','user','role') NOT NULL DEFAULT 'all',
  `audience_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `audience_role` enum('scanner','employee','alumni','student','staff','admin','super_admin') DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `source_type` varchar(50) DEFAULT NULL,
  `source_id` bigint(20) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--


-- --------------------------------------------------------

--
-- Table structure for table `notification_reads`
--

CREATE TABLE `notification_reads` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `notification_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `read_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notification_reads`
--


-- --------------------------------------------------------

--
-- Table structure for table `reservations`
--

CREATE TABLE `reservations` (
  `id` int(11) NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `book_id` int(11) NOT NULL,
  `status` enum('pending','ready','cancelled','expired','fulfilled') NOT NULL DEFAULT 'pending',
  `reserved_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL,
  `fulfilled_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `reservations`
--


-- --------------------------------------------------------

--
-- Table structure for table `site_daily_visits`
--

CREATE TABLE `site_daily_visits` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `visit_date` date NOT NULL,
  `visitor_id` varchar(64) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `first_path` varchar(255) DEFAULT NULL,
  `last_path` varchar(255) DEFAULT NULL,
  `first_visited_at` datetime NOT NULL DEFAULT current_timestamp(),
  `last_visited_at` datetime NOT NULL DEFAULT current_timestamp(),
  `hit_count` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `site_daily_visits`
--


-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `student_employee_id` varchar(50) NOT NULL,
  `barcode` varchar(64) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `profile_picture` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('scanner','employee','alumni','student','staff','admin','super_admin') NOT NULL DEFAULT 'student',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `must_change_password` tinyint(1) NOT NULL DEFAULT 1,
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `address` varchar(100) NOT NULL DEFAULT '',
  `contact` varchar(11) NOT NULL DEFAULT '',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL,
  `_unique_sid` varchar(80) GENERATED ALWAYS AS (if(`deleted_at` is null,`student_employee_id`,concat('__deleted__',`student_employee_id`,'_',`deleted_at`))) STORED,
  `_unique_email` varchar(280) GENERATED ALWAYS AS (if(`deleted_at` is null,`email`,concat('__deleted__',`email`,'_',`deleted_at`))) STORED,
  `_unique_barcode` varchar(90) GENERATED ALWAYS AS (if(`deleted_at` is null,`barcode`,concat('__deleted__',`barcode`,'_',`deleted_at`))) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `student_employee_id`, `barcode`, `email`, `profile_picture`, `name`, `password_hash`, `role`, `is_active`, `must_change_password`, `last_login`, `created_at`, `updated_at`, `address`, `contact`, `deleted_at`, `deleted_by`) VALUES
(5, 'SA0001', NULL, NULL, NULL, 'Initial SuperAdmin', '$2b$12$85a3/NrWKHjMobGWqufeSe1BANBRnvZkQw2n3Oty2qK9K.s9uIA1a', 'super_admin', 1, 0, '2026-04-02 03:03:14', '2026-03-18 08:03:59', '2026-04-02 03:03:14', '', '0', NULL, NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `about_settings`
--
ALTER TABLE `about_settings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_about_updated_by` (`updated_by`);

--
-- Indexes for table `academic_subscriptions`
--
ALTER TABLE `academic_subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_active_order` (`is_active`,`sort_order`),
  ADD KEY `fk_sub_created_by` (`created_by`),
  ADD KEY `fk_sub_updated_by` (`updated_by`);

--
-- Indexes for table `attendance_logs`
--
ALTER TABLE `attendance_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_date` (`user_id`,`created_at`),
  ADD KEY `idx_purpose` (`purpose`),
  ADD KEY `fk_att_borrowing` (`borrowing_id`),
  ADD KEY `fk_att_scanned_by` (`scanned_by`),
  ADD KEY `idx_purpose_date` (`purpose`,`created_at`,`id`);

--
-- Indexes for table `auth_refresh_sessions`
--
ALTER TABLE `auth_refresh_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `jti` (`jti`),
  ADD KEY `idx_auth_refresh_sessions_user_id` (`user_id`),
  ADD KEY `idx_auth_refresh_sessions_expires_at` (`expires_at`);

--
-- Indexes for table `books`
--
ALTER TABLE `books`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_books_deleted` (`deleted_at`);

--
-- Indexes for table `book_copies`
--
ALTER TABLE `book_copies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_barcode` (`barcode`),
  ADD KEY `idx_book_id` (`book_id`),
  ADD KEY `idx_copies_deleted` (`deleted_at`);

--
-- Indexes for table `borrowings`
--
ALTER TABLE `borrowings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_borrowings_user` (`user_id`),
  ADD KEY `fk_borrowings_book` (`book_id`),
  ADD KEY `fk_borrowings_issued_by` (`issued_by`),
  ADD KEY `idx_user_status` (`user_id`,`status`),
  ADD KEY `idx_book_id` (`book_id`),
  ADD KEY `fk_borrowings_copy` (`copy_id`),
  ADD KEY `idx_borrowings_deleted` (`deleted_at`);

--
-- Indexes for table `bulletin_comments`
--
ALTER TABLE `bulletin_comments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_post_id` (`post_id`),
  ADD KEY `fk_bc_user` (`user_id`),
  ADD KEY `idx_bulletin_comments_deleted` (`deleted_at`);

--
-- Indexes for table `bulletin_likes`
--
ALTER TABLE `bulletin_likes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_like` (`post_id`,`user_id`),
  ADD KEY `fk_bl_user` (`user_id`);

--
-- Indexes for table `bulletin_posts`
--
ALTER TABLE `bulletin_posts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `fk_bp_author` (`author_id`),
  ADD KEY `idx_bulletin_posts_deleted` (`deleted_at`);

--
-- Indexes for table `catalog_schema`
--
ALTER TABLE `catalog_schema`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_key` (`key`),
  ADD UNIQUE KEY `uq_catalog_schema_key` (`key`);

--
-- Indexes for table `library_circulation_settings`
--
ALTER TABLE `library_circulation_settings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_library_circulation_settings_updated_by` (`updated_by`);

--
-- Indexes for table `library_holidays`
--
ALTER TABLE `library_holidays`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_library_holidays_date` (`holiday_date`),
  ADD KEY `idx_library_holidays_active_date` (`is_active`,`holiday_date`),
  ADD KEY `fk_library_holidays_created_by` (`created_by`),
  ADD KEY `fk_library_holidays_updated_by` (`updated_by`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notifications_active_created` (`is_active`,`created_at`),
  ADD KEY `idx_notifications_audience_user` (`audience_type`,`audience_user_id`),
  ADD KEY `idx_notifications_audience_role` (`audience_type`,`audience_role`),
  ADD KEY `fk_notifications_created_by` (`created_by`),
  ADD KEY `fk_notifications_audience_user` (`audience_user_id`);

--
-- Indexes for table `notification_reads`
--
ALTER TABLE `notification_reads`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_notification_reads` (`notification_id`,`user_id`),
  ADD KEY `idx_notification_reads_user` (`user_id`,`read_at`);

--
-- Indexes for table `reservations`
--
ALTER TABLE `reservations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_status` (`user_id`,`status`),
  ADD KEY `idx_book_status` (`book_id`,`status`),
  ADD KEY `idx_reservations_deleted` (`deleted_at`);

--
-- Indexes for table `site_daily_visits`
--
ALTER TABLE `site_daily_visits`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_site_daily_visits_date_visitor` (`visit_date`,`visitor_id`),
  ADD KEY `idx_site_daily_visits_user_date` (`user_id`,`visit_date`),
  ADD KEY `idx_site_daily_visits_last_visited_at` (`last_visited_at`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_active_sid` (`_unique_sid`),
  ADD UNIQUE KEY `uq_active_email` (`_unique_email`),
  ADD UNIQUE KEY `uq_active_barcode` (`_unique_barcode`),
  ADD KEY `idx_users_deleted` (`deleted_at`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `about_settings`
--
ALTER TABLE `about_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `academic_subscriptions`
--
ALTER TABLE `academic_subscriptions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `attendance_logs`
--
ALTER TABLE `attendance_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `auth_refresh_sessions`
--
ALTER TABLE `auth_refresh_sessions`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `books`
--
ALTER TABLE `books`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `book_copies`
--
ALTER TABLE `book_copies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `borrowings`
--
ALTER TABLE `borrowings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `bulletin_comments`
--
ALTER TABLE `bulletin_comments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `bulletin_likes`
--
ALTER TABLE `bulletin_likes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `bulletin_posts`
--
ALTER TABLE `bulletin_posts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `catalog_schema`
--
ALTER TABLE `catalog_schema`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `library_holidays`
--
ALTER TABLE `library_holidays`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `notification_reads`
--
ALTER TABLE `notification_reads`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `reservations`
--
ALTER TABLE `reservations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `site_daily_visits`
--
ALTER TABLE `site_daily_visits`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `about_settings`
--
ALTER TABLE `about_settings`
  ADD CONSTRAINT `fk_about_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `academic_subscriptions`
--
ALTER TABLE `academic_subscriptions`
  ADD CONSTRAINT `fk_sub_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sub_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `attendance_logs`
--
ALTER TABLE `attendance_logs`
  ADD CONSTRAINT `fk_att_borrowing` FOREIGN KEY (`borrowing_id`) REFERENCES `borrowings` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_att_scanned_by` FOREIGN KEY (`scanned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_att_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `book_copies`
--
ALTER TABLE `book_copies`
  ADD CONSTRAINT `fk_copy_book` FOREIGN KEY (`book_id`) REFERENCES `books` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `borrowings`
--
ALTER TABLE `borrowings`
  ADD CONSTRAINT `fk_borrowings_book` FOREIGN KEY (`book_id`) REFERENCES `books` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_borrowings_copy` FOREIGN KEY (`copy_id`) REFERENCES `book_copies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_borrowings_issued_by` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_borrowings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `bulletin_comments`
--
ALTER TABLE `bulletin_comments`
  ADD CONSTRAINT `fk_bc_post` FOREIGN KEY (`post_id`) REFERENCES `bulletin_posts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_bc_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `bulletin_likes`
--
ALTER TABLE `bulletin_likes`
  ADD CONSTRAINT `fk_bl_post` FOREIGN KEY (`post_id`) REFERENCES `bulletin_posts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_bl_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `bulletin_posts`
--
ALTER TABLE `bulletin_posts`
  ADD CONSTRAINT `fk_bp_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `library_circulation_settings`
--
ALTER TABLE `library_circulation_settings`
  ADD CONSTRAINT `fk_library_circulation_settings_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `library_holidays`
--
ALTER TABLE `library_holidays`
  ADD CONSTRAINT `fk_library_holidays_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_library_holidays_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notifications_audience_user` FOREIGN KEY (`audience_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_notifications_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `notification_reads`
--
ALTER TABLE `notification_reads`
  ADD CONSTRAINT `fk_notification_reads_notification` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_notification_reads_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `reservations`
--
ALTER TABLE `reservations`
  ADD CONSTRAINT `fk_res_book` FOREIGN KEY (`book_id`) REFERENCES `books` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_res_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

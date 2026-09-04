-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 03, 2026 at 07:48 PM
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

CREATE TABLE `library_events` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `library_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_library_events_starts_at` (`starts_at`),
  ADD KEY `fk_library_events_creator` (`created_by`);

ALTER TABLE `library_events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

CREATE TABLE `site_content_settings` (
  `id` tinyint NOT NULL,
  `hero_kicker` varchar(255) NOT NULL,
  `hero_title` varchar(255) NOT NULL,
  `hero_highlight` varchar(255) NOT NULL,
  `hero_description` text NOT NULL,
  `hero_image_url` varchar(2048) DEFAULT NULL,
  `hero_stats` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`hero_stats`)),
  `hours` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`hours`)),
  `address` varchar(500) NOT NULL,
  `contact_email` varchar(255) NOT NULL,
  `contact_phone` varchar(100) NOT NULL,
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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

-- --------------------------------------------------------

--
-- Table structure for table `auth_audit_events`
--

CREATE TABLE `auth_audit_events` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `event_type` enum('login','logout','password_changed') NOT NULL,
  `device_type` enum('desktop','mobile','tablet','unknown') NOT NULL DEFAULT 'unknown',
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- --------------------------------------------------------

--
-- Table structure for table `backup_snapshots`
--

CREATE TABLE `backup_snapshots` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `cloudinary_public_id` varchar(255) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `size_bytes` bigint(20) UNSIGNED NOT NULL,
  `kind` enum('manual','pre_restore') NOT NULL DEFAULT 'manual',
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `books`
--

CREATE TABLE `books` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `material_type` enum('book','thesis') NOT NULL DEFAULT 'book',
  `book_type_id` bigint(20) UNSIGNED NOT NULL,
  `author` varchar(255) DEFAULT NULL,
  `thesis_program` varchar(255) DEFAULT NULL,
  `thesis_adviser` varchar(255) DEFAULT NULL,
  `academic_year` varchar(32) DEFAULT NULL,
  `thesis_abstract` text DEFAULT NULL,
  `thesis_keywords` text DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `isbn` varchar(20) DEFAULT NULL,
  `accession_number` varchar(100) DEFAULT NULL,
  `edition` varchar(50) DEFAULT NULL,
  `publication_year` year(4) DEFAULT NULL,
  `copies` int(11) DEFAULT 1,
  `created_by` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `location` text DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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

-- --------------------------------------------------------

--
-- Table structure for table `book_types`
--

CREATE TABLE `book_types` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `default_borrow_days` int(11) NOT NULL,
  `fine_per_hour` decimal(10,2) NOT NULL,
  `fine_interval` enum('hour','day') NOT NULL DEFAULT 'hour',
  `initial_fine` decimal(10,2) NOT NULL DEFAULT 0.00,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
  `fine_per_hour` decimal(10,2) DEFAULT NULL,
  `fine_interval` enum('hour','day') DEFAULT NULL,
  `initial_fine` decimal(10,2) DEFAULT NULL,
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
  `post_type` enum('announcement','event') NOT NULL DEFAULT 'announcement',
  `event_starts_at` datetime DEFAULT NULL,
  `event_ends_at` datetime DEFAULT NULL,
  `event_location` varchar(255) DEFAULT NULL,
  `event_registration_url` varchar(512) DEFAULT NULL,
  `author_id` bigint(20) UNSIGNED NOT NULL,
  `is_pinned` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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

-- --------------------------------------------------------

--
-- Table structure for table `clearance_transactions`
--

CREATE TABLE `clearance_transactions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `receipt_number` varchar(48) DEFAULT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `transaction_type` enum('payment','adjustment','reversal') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_method` enum('cash') DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `reverses_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `clearance_transaction_items`
--

CREATE TABLE `clearance_transaction_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `transaction_id` bigint(20) UNSIGNED NOT NULL,
  `borrowing_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
  `program_id` bigint(20) UNSIGNED DEFAULT NULL,
  `academic_term_id` bigint(20) UNSIGNED DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL,
  `_unique_sid` varchar(80) GENERATED ALWAYS AS (if(`deleted_at` is null,`student_employee_id`,concat('__deleted__',`student_employee_id`,'_',`deleted_at`))) STORED,
  `_unique_email` varchar(280) GENERATED ALWAYS AS (if(`deleted_at` is null,`email`,concat('__deleted__',`email`,'_',`deleted_at`))) STORED,
  `_unique_barcode` varchar(90) GENERATED ALWAYS AS (if(`deleted_at` is null,`barcode`,concat('__deleted__',`barcode`,'_',`deleted_at`))) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `academic_programs`
--

CREATE TABLE `academic_programs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `academic_terms` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `starts_on` date NOT NULL,
  `ends_on` date NOT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

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
-- Indexes for table `auth_audit_events`
--
ALTER TABLE `auth_audit_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_auth_audit_user_time` (`user_id`,`created_at`);

--
-- Indexes for table `auth_refresh_sessions`
--
ALTER TABLE `auth_refresh_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `jti` (`jti`),
  ADD KEY `idx_auth_refresh_sessions_user_id` (`user_id`),
  ADD KEY `idx_auth_refresh_sessions_expires_at` (`expires_at`);

--
-- Indexes for table `backup_snapshots`
--
ALTER TABLE `backup_snapshots`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_backup_snapshots_cloudinary_public_id` (`cloudinary_public_id`),
  ADD KEY `idx_backup_snapshots_created_at` (`created_at`),
  ADD KEY `idx_backup_snapshots_created_by` (`created_by`);

--
-- Indexes for table `books`
--
ALTER TABLE `books`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_books_accession_number` (`accession_number`),
  ADD KEY `idx_books_deleted` (`deleted_at`),
  ADD KEY `idx_books_material_type` (`material_type`),
  ADD KEY `fk_books_book_type` (`book_type_id`);

--
-- Indexes for table `book_copies`
--
ALTER TABLE `book_copies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_barcode` (`barcode`),
  ADD KEY `idx_book_id` (`book_id`),
  ADD KEY `idx_copies_deleted` (`deleted_at`);

--
-- Indexes for table `book_types`
--
ALTER TABLE `book_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_book_types_name` (`name`);

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
  ADD KEY `idx_bulletin_posts_deleted` (`deleted_at`),
  ADD KEY `idx_bulletin_events_upcoming` (`post_type`, `event_starts_at`);

--
-- Indexes for table `catalog_schema`
--
ALTER TABLE `catalog_schema`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_key` (`key`),
  ADD UNIQUE KEY `uq_catalog_schema_key` (`key`);

--
-- Indexes for table `clearance_transactions`
--
ALTER TABLE `clearance_transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_clearance_receipt_number` (`receipt_number`),
  ADD KEY `idx_clearance_user_created` (`user_id`,`created_at`),
  ADD KEY `idx_clearance_reversal` (`reverses_transaction_id`),
  ADD KEY `fk_clearance_created_by` (`created_by`);

--
-- Indexes for table `clearance_transaction_items`
--
ALTER TABLE `clearance_transaction_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_clearance_item_borrowing` (`borrowing_id`),
  ADD KEY `idx_clearance_item_transaction` (`transaction_id`);

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
  ADD KEY `idx_users_deleted` (`deleted_at`),
  ADD KEY `idx_users_program` (`program_id`),
  ADD KEY `idx_users_academic_term` (`academic_term_id`);

ALTER TABLE `academic_programs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_academic_program_name` (`name`);

ALTER TABLE `academic_terms`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `about_settings`
--
ALTER TABLE `about_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `academic_subscriptions`
--
ALTER TABLE `academic_subscriptions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `attendance_logs`
--
ALTER TABLE `attendance_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auth_audit_events`
--
ALTER TABLE `auth_audit_events`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auth_refresh_sessions`
--
ALTER TABLE `auth_refresh_sessions`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `backup_snapshots`
--
ALTER TABLE `backup_snapshots`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `books`
--
ALTER TABLE `books`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `book_copies`
--
ALTER TABLE `book_copies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `book_types`
--
ALTER TABLE `book_types`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `borrowings`
--
ALTER TABLE `borrowings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bulletin_comments`
--
ALTER TABLE `bulletin_comments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bulletin_likes`
--
ALTER TABLE `bulletin_likes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bulletin_posts`
--
ALTER TABLE `bulletin_posts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `catalog_schema`
--
ALTER TABLE `catalog_schema`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `clearance_transactions`
--
ALTER TABLE `clearance_transactions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `clearance_transaction_items`
--
ALTER TABLE `clearance_transaction_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `library_holidays`
--
ALTER TABLE `library_holidays`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notification_reads`
--
ALTER TABLE `notification_reads`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `reservations`
--
ALTER TABLE `reservations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `site_daily_visits`
--
ALTER TABLE `site_daily_visits`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `academic_programs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `academic_terms`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

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
-- Constraints for table `auth_audit_events`
--
ALTER TABLE `auth_audit_events`
  ADD CONSTRAINT `fk_auth_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_program` FOREIGN KEY (`program_id`) REFERENCES `academic_programs` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_academic_term` FOREIGN KEY (`academic_term_id`) REFERENCES `academic_terms` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `books`
--
ALTER TABLE `books`
  ADD CONSTRAINT `fk_books_book_type` FOREIGN KEY (`book_type_id`) REFERENCES `book_types` (`id`);

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
-- Constraints for table `clearance_transactions`
--
ALTER TABLE `clearance_transactions`
  ADD CONSTRAINT `fk_clearance_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_clearance_reverses` FOREIGN KEY (`reverses_transaction_id`) REFERENCES `clearance_transactions` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_clearance_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `clearance_transaction_items`
--
ALTER TABLE `clearance_transaction_items`
  ADD CONSTRAINT `fk_clearance_item_borrowing` FOREIGN KEY (`borrowing_id`) REFERENCES `borrowings` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_clearance_item_transaction` FOREIGN KEY (`transaction_id`) REFERENCES `clearance_transactions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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

-- Development bootstrap configuration. Change the starter password on first login.
CREATE TABLE `auth_restore_state` (
  `id` tinyint NOT NULL,
  `invalid_before` datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `restore_audit_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `snapshot_id` bigint unsigned DEFAULT NULL,
  `snapshot_kind` varchar(32) DEFAULT NULL,
  `restored_by` bigint unsigned DEFAULT NULL,
  `pre_restore_snapshot_id` bigint unsigned DEFAULT NULL,
  `restored_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_restore_audit_time` (`restored_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `users` (`student_employee_id`, `name`, `password_hash`, `role`, `is_active`, `must_change_password`, `address`, `contact`)
VALUES ('SA0001', 'Development Super Admin', '$2b$12$buA8cKPLUl3yVNMs01sibeSWY4/0AFzv/FNPNUa61RLI3CryzEHpG', 'super_admin', 1, 0, '', '');

INSERT INTO `about_settings` (`id`, `library_name`, `mission_title`, `mission_text`, `history_title`, `history_text`, `policies`, `facilities`, `staff`, `spaces`)
VALUES (1, 'Enverga-Candelaria Library', 'Empowering Academic Growth', '', '', '', '[]', '[]', '[]', '[]');

INSERT INTO `book_types` (`name`, `default_borrow_days`, `fine_per_hour`, `fine_interval`, `initial_fine`, `is_active`)
VALUES ('General collection', 7, 1.00, 'hour', 0.00, 1);

INSERT INTO `catalog_schema` (`key`, `label`, `type`, `options`, `required`, `locked`, `order`, `public`, `archived`) VALUES
('title', 'Book Title', 'text', NULL, 1, 1, 0, 1, 0),
('author', 'Author', 'text', NULL, 1, 1, 1, 1, 0),
('isbn', 'ISBN', 'text', NULL, 0, 0, 2, 1, 0),
('category', 'Category', 'select', '["Computer Science","Engineering","Mathematics","Science","Literature","History","Business","Other"]', 0, 0, 3, 1, 0),
('copies', 'Copies', 'number', NULL, 0, 0, 4, 1, 0),
('edition', 'Edition', 'text', NULL, 0, 0, 5, 1, 0),
('publication_year', 'Publication Year', 'number', NULL, 0, 0, 6, 1, 0),
('location', 'Location', 'text', NULL, 0, 0, 7, 0, 0);

INSERT INTO `library_circulation_settings` (`id`, `overdue_fine_per_hour`) VALUES (1, 1.00);
INSERT INTO `site_content_settings` (`id`, `hero_kicker`, `hero_title`, `hero_highlight`, `hero_description`, `hours`, `hero_stats`, `address`, `contact_email`, `contact_phone`) VALUES
(1, 'Manuel S. Enverga University Foundation — Candelaria Inc.', 'Enverga-Candelaria', 'Library', 'Digitalized inventory tracking, book reservations, and seamless access to library services — built for academic excellence.', '[{"day":"Monday – Friday","time":"7:00 AM – 9:00 PM","open":true},{"day":"Saturday","time":"8:00 AM – 5:00 PM","open":true},{"day":"Sunday","time":"Closed","open":false}]', '[{"value":"12,000+","label":"Volumes"},{"value":"400+","label":"Journals"},{"value":"24/7","label":"Digital Access"}]', '123 University Avenue, Building C, 2nd Floor', 'library@college.edu', '(555) 123-4567');
INSERT INTO `auth_restore_state` (`id`) VALUES (1);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

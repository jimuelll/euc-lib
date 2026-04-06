-- Portable import cleaned from phpMyAdmin MariaDB dump
-- Target: MySQL-compatible providers such as Aiven MySQL or TiDB
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

--




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
  `established` YEAR DEFAULT NULL,
  `mission_title` varchar(255) DEFAULT NULL,
  `mission_text` text DEFAULT NULL,
  `history_title` varchar(255) DEFAULT NULL,
  `history_text` text DEFAULT NULL,
  `policies` LONGTEXT DEFAULT NULL,
  `facilities` LONGTEXT DEFAULT NULL,
  `staff` LONGTEXT DEFAULT NULL,
  `spaces` LONGTEXT DEFAULT NULL,
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `about_settings`
--

INSERT INTO `about_settings` (`id`, `library_name`, `established`, `mission_title`, `mission_text`, `history_title`, `history_text`, `policies`, `facilities`, `staff`, `spaces`, `updated_by`, `created_at`, `updated_at`) VALUES
(1, 'Enverga-Candelaria Library', '2010', 'Empowering Academic Growth', 'Our mission is to empower every student and faculty member with seamless access to knowledge resources. We envision a fully digitalized, efficient library ecosystem that promotes academic research, lifelong learning, and intellectual growth.', 'Est. 2010', 'Established in 2010, our library has grown from a small reading room with 500 volumes to a modern facility housing over ????? titles, digital subscriptions, and state-of-the-art study spaces.', '[\"Borrowing period: 14 days for students, 30 days for faculty\",\"Maximum of 5 books at a time\",\"Late fees apply after the due date\",\"Library cards must be presented for all transactions\",\"Quiet zones must be respected at all times\"]', '[\"3 reading halls with 200+ seating capacity\",\"Dedicated computer lab with internet access\",\"Group study rooms (reservable)\",\"Print and photocopy services\",\"Accessibility-friendly facilities\"]', '[{\"name\":\"Maam Jocelyn G. Villangca\",\"role\":\"Chief Librarian\",\"image_url\":\"https://res.cloudinary.com/dqkmwu5ti/image/upload/v1774590267/library/bulletin/kl8afthwae6ezlowthux.webp\"},{\"name\":\"Mr. James Reyes\",\"role\":\"Systems Librarian\",\"image_url\":\"\"},{\"name\":\"Ms. Ana Cruz\",\"role\":\"Cataloguing Specialist\",\"image_url\":\"\"},{\"name\":\"Mr. Carlos Rivera\",\"role\":\"Circulation Desk Officer\",\"image_url\":\"\"}]', '[{\"name\":\"Main Reading Hall\",\"description\":\"A quiet, spacious area with 200+ seats for focused reading and study.\",\"image_url\":\"https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=400&h=250&fit=crop\"},{\"name\":\"Computer Lab\",\"description\":\"Equipped with internet-connected workstations for research and digital access.\",\"image_url\":\"https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&h=250&fit=crop\"},{\"name\":\"Group Study Rooms\",\"description\":\"Reservable rooms for collaborative projects and group discussions.\",\"image_url\":\"https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&h=250&fit=crop\"},{\"name\":\"Periodicals Section\",\"description\":\"Current newspapers, magazines, and journal archives.\",\"image_url\":\"https://res.cloudinary.com/dqkmwu5ti/image/upload/v1774585254/library/bulletin/xmqyqje5tvspso1b7htb.webp\"},{\"name\":\"Library Business Area\",\"description\":\"-\",\"image_url\":\"https://res.cloudinary.com/dqkmwu5ti/image/upload/v1774585406/library/bulletin/e1w3xtmghn5i5zc6i6wt.webp\"}]', 5, '2026-03-26 13:15:11', '2026-03-27 05:44:29');

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
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `academic_subscriptions`
--

INSERT INTO `academic_subscriptions` (`id`, `title`, `url`, `description`, `category`, `image_url`, `image_public_id`, `is_active`, `sort_order`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at`, `deleted_by`) VALUES
(7, 'AccessEngineering', 'https://www.accessengineeringlibrary.com/front', 'The award-winning engineering reference platform for academics, students, and professionals.', 'Engineering', 'https://res.cloudinary.com/dqkmwu5ti/image/upload/v1774700897/library/bulletin/txaaxzw1vo0pjcibzthw.png', 'library/bulletin/txaaxzw1vo0pjcibzthw', 1, 1, 5, 5, '2026-03-28 12:16:08', '2026-03-28 12:29:03', NULL, NULL),
(8, 'Business Expert Press', 'https://www.businessexpertpress.com/', 'Business Expert Press has been providing business students and professionals with precise, business information written by experts in their fields.', 'Business', 'https://res.cloudinary.com/dqkmwu5ti/image/upload/v1774710769/library/bulletin/tqekq6e1kfuqzwx9peb8.webp', 'library/bulletin/tqekq6e1kfuqzwx9peb8', 1, 2, 5, 5, '2026-03-28 15:12:49', '2026-03-30 06:41:39', NULL, NULL);

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
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `attendance_logs`
--

INSERT INTO `attendance_logs` (`id`, `user_id`, `scanned_id`, `type`, `purpose`, `borrowing_id`, `scanned_by`, `ip_address`, `created_at`) VALUES
(1, 18, 'LIB-USER-000018', 'check_in', 'entry_exit', NULL, 8, '::1', '2026-03-27 15:09:56');

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
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `auth_refresh_sessions`
--

INSERT INTO `auth_refresh_sessions` (`id`, `user_id`, `jti`, `expires_at`, `revoked_at`, `created_at`) VALUES
(1, 5, '02999ee9-4150-4172-9395-6f38ab9a4cfc', '2026-04-06 10:33:34', '2026-03-30 18:35:11', '2026-03-30 18:33:34'),
(2, 5, '2e52ddcb-e94a-4920-9ce4-cd5f71ea10ca', '2026-04-06 10:35:18', '2026-03-30 18:35:20', '2026-03-30 18:35:18'),
(3, 5, '87e709b3-13dd-4829-a122-4ef16e91f2f2', '2026-04-06 10:35:18', '2026-03-30 18:35:23', '2026-03-30 18:35:20'),
(4, 5, '4eea53d6-1df7-40e1-966d-a900ab33db37', '2026-04-06 10:42:50', '2026-03-30 18:42:51', '2026-03-30 18:42:50'),
(5, 5, 'b68d0b42-bb54-4d27-b7e7-0ece0c314607', '2026-04-06 10:43:06', '2026-03-30 18:43:42', '2026-03-30 18:43:06'),
(6, 21, '0ea56f7d-6523-4efa-b89d-c036d265333b', '2026-04-06 10:43:46', '2026-03-30 18:44:02', '2026-03-30 18:43:46'),
(7, 21, 'c9bb3a3d-0bc6-411d-bb5c-8e9d5578b1f2', '2026-04-06 10:44:02', '2026-03-30 18:44:42', '2026-03-30 18:44:02'),
(8, 22, 'ba8a8cce-00fc-4728-9415-365d5555dca1', '2026-04-06 10:44:53', '2026-03-30 18:45:00', '2026-03-30 18:44:53'),
(9, 22, 'caf2af7a-703d-4eda-92f3-3de4c2db6914', '2026-04-06 10:45:00', '2026-03-30 18:45:24', '2026-03-30 18:45:00'),
(10, 5, 'b3fc444f-91f2-4873-a479-8a69a314ed5a', '2026-04-06 11:07:05', '2026-03-30 19:07:14', '2026-03-30 19:07:05'),
(11, 5, '631ba8ff-36f1-4083-af8d-dc59ea6eb3e5', '2026-04-06 11:07:05', '2026-03-30 19:07:16', '2026-03-30 19:07:14'),
(12, 5, '5ef1e0d9-cffe-44ea-bc94-3926c0c03762', '2026-04-06 11:07:14', '2026-03-30 19:08:22', '2026-03-30 19:07:16'),
(13, 5, '59265f11-6152-4741-b89b-11b5599e23d5', '2026-04-06 11:07:16', '2026-03-30 19:10:43', '2026-03-30 19:08:22'),
(14, 5, '47dd2398-2110-499c-8939-d9bf405ae544', '2026-04-06 11:08:22', '2026-03-30 19:15:04', '2026-03-30 19:10:44'),
(15, 5, '923423ca-bd0c-45eb-af40-bee795d600c0', '2026-04-06 11:10:44', '2026-03-30 19:15:53', '2026-03-30 19:15:04'),
(16, 5, '476483ec-16f1-4f94-b14e-a265940dc801', '2026-04-06 11:15:04', '2026-03-30 23:43:34', '2026-03-30 19:15:53'),
(17, 5, 'fb9af4ff-b412-4645-b4a3-174175ae6433', '2026-04-06 11:15:53', '2026-03-30 23:43:40', '2026-03-30 23:43:34'),
(18, 5, 'afe43a52-fd4a-4c01-8df3-00031b69d0ee', '2026-04-06 15:43:43', '2026-03-30 23:48:54', '2026-03-30 23:43:43'),
(19, 5, 'f9738d5c-fe2a-4e54-ba6b-38e0586e8bc6', '2026-04-06 15:43:43', '2026-03-30 23:49:01', '2026-03-30 23:48:54'),
(20, 5, 'e33de396-66b5-4ed6-864c-f4fe7b121638', '2026-04-06 15:48:54', '2026-03-30 23:52:07', '2026-03-30 23:49:01'),
(21, 5, '0d614618-4751-4b5b-8fda-7c62e698a8bf', '2026-04-06 15:49:01', '2026-03-30 23:59:30', '2026-03-30 23:52:07'),
(22, 5, 'ebeed561-6019-4ad5-ae64-72d8ed8d334b', '2026-04-06 15:52:07', '2026-03-31 00:01:22', '2026-03-30 23:59:30'),
(23, 5, 'dd811a30-a361-4037-8723-3e82dda445ce', '2026-04-06 15:59:30', '2026-03-31 00:03:18', '2026-03-31 00:01:22'),
(24, 5, 'f0cc33d3-a336-4460-8be5-2a6601573735', '2026-04-06 16:01:22', '2026-03-31 00:04:40', '2026-03-31 00:03:18'),
(25, 5, '34260a06-1811-487a-8b1d-a13b1992cfe9', '2026-04-06 16:03:18', '2026-03-31 00:05:32', '2026-03-31 00:04:40'),
(26, 5, '8ae9349e-e4a9-4353-ae53-6794e9e21832', '2026-04-06 16:04:40', '2026-03-31 00:06:24', '2026-03-31 00:05:32'),
(27, 5, '9c35ac30-19c5-43fa-9f8f-265e40bcb415', '2026-04-06 16:05:32', '2026-03-31 00:10:44', '2026-03-31 00:06:24'),
(28, 5, '3a762749-33a8-464a-95b6-9964cde31303', '2026-04-06 16:06:24', '2026-03-31 00:24:28', '2026-03-31 00:10:44'),
(29, 5, '52a4f586-0f76-4393-a965-2db166df4576', '2026-04-06 16:10:44', '2026-03-31 00:37:50', '2026-03-31 00:24:28'),
(30, 5, '9509d519-5ac4-4dcb-8dac-41088685231b', '2026-04-06 16:24:28', '2026-03-31 00:43:25', '2026-03-31 00:37:50'),
(31, 5, '4997fbf6-a444-4024-8f70-04d15151b568', '2026-04-07 04:20:49', '2026-03-31 12:32:02', '2026-03-31 12:20:49'),
(32, 5, 'e3b8b378-f911-45c9-a423-2d8844b371a0', '2026-04-07 04:20:49', '2026-03-31 12:32:03', '2026-03-31 12:32:02'),
(33, 5, 'b466ef19-6613-4eb8-bc2c-342bee2526cb', '2026-04-07 04:32:02', '2026-03-31 12:42:35', '2026-03-31 12:32:03'),
(34, 5, 'e4796167-a25d-4b48-8de1-5d9f22a433f1', '2026-04-07 04:32:03', '2026-03-31 12:42:37', '2026-03-31 12:42:35'),
(35, 5, 'b8812211-4314-4f4e-b300-ea5745b35cb2', '2026-04-07 04:42:35', '2026-03-31 12:57:56', '2026-03-31 12:42:37'),
(36, 5, 'a7d43dc9-a48f-4f0d-a8d7-c0b7c5d2014e', '2026-04-07 04:42:37', '2026-03-31 12:58:44', '2026-03-31 12:57:56'),
(37, 22, 'cb1315ff-0451-4896-a487-6223aed8e71f', '2026-04-07 04:58:51', '2026-03-31 13:14:17', '2026-03-31 12:58:51'),
(38, 22, '1619dada-1d12-4b77-a719-67768aff6c70', '2026-04-07 04:58:51', '2026-03-31 13:17:09', '2026-03-31 13:14:17'),
(39, 21, '501ee8a6-152c-4a04-a04c-e694fd7d3247', '2026-04-07 05:17:13', '2026-03-31 13:17:53', '2026-03-31 13:17:13'),
(40, 22, '81f1556e-06f4-4754-ab4d-9dd002f0c7d6', '2026-04-07 05:17:57', '2026-03-31 13:26:30', '2026-03-31 13:17:57'),
(41, 22, '458b9e4c-995c-4573-a929-df351106ef07', '2026-04-07 05:17:57', '2026-03-31 13:27:28', '2026-03-31 13:26:30'),
(42, 21, '2607a733-2e09-4ea5-85e0-8b87016ef542', '2026-04-07 05:27:34', '2026-03-31 13:49:21', '2026-03-31 13:27:34'),
(43, 21, '6465c3f0-5251-42ea-9e5c-74a888983b38', '2026-04-07 05:27:34', '2026-03-31 13:49:38', '2026-03-31 13:49:21'),
(44, 22, '5af9c917-d42f-486e-bce2-744caa09ade2', '2026-04-07 05:49:44', '2026-03-31 13:50:09', '2026-03-31 13:49:44'),
(45, 5, 'dacb1929-0fee-492d-bfce-dd5ab4ef9d5e', '2026-04-07 05:50:16', '2026-03-31 13:51:39', '2026-03-31 13:50:16'),
(46, 22, '79c5bd00-1236-47f3-bb7e-87e6450335b7', '2026-04-07 05:51:44', '2026-03-31 13:51:58', '2026-03-31 13:51:44'),
(47, 5, '800e779a-8447-4de1-8404-338806993e04', '2026-04-07 06:13:28', NULL, '2026-03-31 14:13:28');

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
  `publication_year` YEAR DEFAULT NULL,
  `copies` int(11) DEFAULT 1,
  `created_by` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `location` text DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL,
  `try` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `books`
--

INSERT INTO `books` (`id`, `title`, `author`, `category`, `isbn`, `edition`, `publication_year`, `copies`, `created_by`, `created_at`, `updated_at`, `location`, `deleted_at`, `deleted_by`, `try`) VALUES
(1, '', NULL, NULL, NULL, NULL, NULL, 1, NULL, '2026-03-19 14:19:02', '2026-03-30 07:11:47', NULL, NULL, NULL, NULL),
(2, 'Noli Me Tangere', 'Jose Rizal', 'History', '12342515', '1st', '1911', 2, NULL, '2026-03-19 14:25:51', '2026-03-29 06:12:31', 'Dewey Decimal 100-200 (test)', NULL, NULL, NULL),
(4, 'El Filibusterismo', 'Jose Rizal', NULL, NULL, NULL, NULL, 2, NULL, '2026-03-27 06:50:36', '2026-03-27 09:19:19', NULL, NULL, NULL, NULL),
(5, 'test', NULL, NULL, NULL, NULL, NULL, 1, NULL, '2026-03-27 09:05:26', '2026-03-27 09:05:26', NULL, NULL, NULL, NULL),
(6, 'test', NULL, NULL, NULL, NULL, NULL, 1, NULL, '2026-03-30 06:41:05', '2026-03-30 06:41:05', NULL, NULL, NULL, NULL),
(7, '', NULL, NULL, NULL, NULL, NULL, 1, NULL, '2026-03-30 07:11:47', '2026-03-30 07:11:47', NULL, NULL, NULL, NULL);

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
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `book_copies`
--

INSERT INTO `book_copies` (`id`, `book_id`, `barcode`, `condition`, `is_active`, `notes`, `created_at`, `updated_at`, `deleted_at`, `deleted_by`) VALUES
(1, 2, 'LIB-000002-001', 'good', 1, NULL, '2026-03-27 06:16:56', '2026-03-29 06:12:31', NULL, NULL),
(2, 2, 'LIB-000002-002', 'good', 1, NULL, '2026-03-27 06:16:56', '2026-03-29 06:12:31', NULL, NULL),
(4, 4, 'LIB-000004-001', 'good', 1, NULL, '2026-03-27 06:50:36', '2026-03-27 06:50:36', NULL, NULL),
(5, 5, 'LIB-000005-001', 'good', 1, NULL, '2026-03-27 09:05:26', '2026-03-27 09:05:26', NULL, NULL),
(6, 4, 'LIB-000004-002', 'good', 1, NULL, '2026-03-27 09:19:19', '2026-03-27 09:19:19', NULL, NULL),
(7, 6, 'LIB-000006-001', 'good', 1, NULL, '2026-03-30 06:41:05', '2026-03-30 06:41:05', NULL, NULL),
(8, 7, 'LIB-000007-001', 'good', 1, NULL, '2026-03-30 07:11:47', '2026-03-30 07:11:47', NULL, NULL);

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
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `borrowings`
--

INSERT INTO `borrowings` (`id`, `user_id`, `book_id`, `copy_id`, `borrowed_at`, `due_date`, `returned_at`, `status`, `notes`, `issued_by`, `created_at`, `updated_at`, `last_overdue_notification_at`, `deleted_at`, `deleted_by`) VALUES
(3, 14, 2, NULL, '2026-03-22 05:48:12', '2026-03-29 23:59:59', '2026-03-22 05:48:46', 'returned', NULL, 5, '2026-03-22 05:48:12', '2026-03-31 04:18:53', NULL, NULL, NULL),
(4, 14, 2, 1, '2026-03-27 07:27:37', '2026-03-28 23:59:59', '2026-03-27 07:41:41', 'returned', NULL, 5, '2026-03-27 07:27:37', '2026-03-31 04:18:53', NULL, NULL, NULL),
(5, 14, 5, 5, '2026-03-27 09:11:21', '2026-04-03 23:59:59', '2026-03-27 09:15:42', 'returned', NULL, 5, '2026-03-27 09:11:21', '2026-03-31 04:18:53', NULL, NULL, NULL);

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
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bulletin_comments`
--

INSERT INTO `bulletin_comments` (`id`, `post_id`, `user_id`, `text`, `created_at`, `deleted_at`, `deleted_by`) VALUES
(1, 1, 14, 'hi', '2026-03-24 11:35:56', '2026-03-30 07:11:47', 5),
(2, 4, 5, 'pogi ni dude', '2026-03-28 15:55:07', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `bulletin_likes`
--

CREATE TABLE `bulletin_likes` (
  `id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bulletin_likes`
--

INSERT INTO `bulletin_likes` (`id`, `post_id`, `user_id`, `created_at`) VALUES
(2, 1, 14, '2026-03-24 11:35:53'),
(3, 2, 5, '2026-03-25 11:00:56'),
(4, 4, 5, '2026-03-28 15:55:10'),
(5, 4, 14, '2026-03-28 15:55:21'),
(11, 4, 19, '2026-03-30 09:36:17'),
(13, 3, 5, '2026-03-30 09:46:21'),
(14, 4, 20, '2026-03-30 10:10:05');

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
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bulletin_posts`
--

INSERT INTO `bulletin_posts` (`id`, `title`, `excerpt`, `content`, `image_url`, `image_public_id`, `author_id`, `is_pinned`, `created_at`, `updated_at`, `deleted_at`, `deleted_by`) VALUES
(1, 'Test Post#1', 'Try this new Anime', 'In the deadly battle at the Watergate City of Priestella, Subaru and his allies barely emerged victoriousâ€”but their triumph came at a great cost. Through the \"Authority of Gluttony,\" Rem was put into suspended animation, while Crusch\'s memories and even Juliusâ€™s name were devoured. As he searches for a way to save them, Subaru learns of the \"wise man\" Shaulaâ€”an all-seeing being said to possess every form of knowledge. His next destination is the Pleiades Watchtower, home to a wise man, the farthest tower standing in the vast, uncharted desert known as the Auguria Dunesâ€”a place so perilous that even the mightiest \"Sword Saint,\" Reinhard, failed to conquer it. The fury of nature, unknown magical beasts, and unimaginable dangers lie ahead. Together with his friends, Subaru embarks on a life-risking journey to reclaim what was lost.', 'https://res.cloudinary.com/dqkmwu5ti/image/upload/v1774352133/library/bulletin/etoeslsf9iboewi7rpai.jpg', NULL, 5, 0, '2026-03-24 11:35:32', '2026-03-30 07:11:47', NULL, NULL),
(2, 'Another Test Post', 'Cool art', 'Demon Lord Rimuru\'s dream of creating an alliance between humans and monsters takes a step closer to being realized. As Tempest continues to prosper, Granville Rozzo and his granddaughter, Maribel Rozzo, clash with Demon Lord Rimuru over their plan to protect mankind by ruling over them. Meanwhile, in El Dorado, Demon Lord Leon works toward goals of his own. The awakening of a new Hero draws near!', 'https://res.cloudinary.com/dqkmwu5ti/image/upload/v1774352705/library/bulletin/jjmhydihbtxpgvqmrasz.png', NULL, 5, 0, '2026-03-24 11:45:04', '2026-03-24 11:45:04', NULL, NULL),
(3, 'Test', 'test', 'test', NULL, NULL, 5, 0, '2026-03-24 12:24:26', '2026-03-24 12:24:26', NULL, NULL),
(4, 'try', 'try', 'try', 'https://res.cloudinary.com/dqkmwu5ti/image/upload/v1774438812/library/bulletin/pfcjzeyh0smebscejsin.jpg', 'library/bulletin/pfcjzeyh0smebscejsin', 5, 1, '2026-03-25 11:40:10', '2026-03-29 06:55:06', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `catalog_schema`
--

CREATE TABLE `catalog_schema` (
  `id` int(11) NOT NULL,
  `key` varchar(64) NOT NULL,
  `label` varchar(255) NOT NULL,
  `type` enum('text','textarea','number','date','select') NOT NULL DEFAULT 'text',
  `options` LONGTEXT DEFAULT NULL,
  `required` tinyint(1) NOT NULL DEFAULT 0,
  `locked` tinyint(1) NOT NULL DEFAULT 0,
  `order` int(11) NOT NULL DEFAULT 0,
  `public` tinyint(1) NOT NULL DEFAULT 0,
  `archived` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = field removed from active schema but data retained in books table',
  PRIMARY KEY (`id`)
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
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ;

--
-- Dumping data for table `library_circulation_settings`
--

INSERT INTO `library_circulation_settings` (`id`, `overdue_fine_per_hour`, `updated_by`, `created_at`, `updated_at`) VALUES
(1, 3.00, 5, '2026-03-31 04:18:54', '2026-03-31 04:55:32');

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
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
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
  `audience_role` enum('employee','alumni','student','scanner','staff','admin','super_admin') DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `type`, `title`, `body`, `href`, `audience_type`, `audience_user_id`, `audience_role`, `expires_at`, `created_by`, `is_active`, `created_at`) VALUES
(1, 'announcement', 'test announcement', 'The library will be closed for maintenance', NULL, 'all', NULL, NULL, NULL, 5, 1, '2026-03-30 16:11:55'),
(2, 'announcement', 'test 2', 'the library will actually be open', NULL, 'all', NULL, NULL, NULL, 5, 1, '2026-03-30 16:15:11');

-- --------------------------------------------------------

--
-- Table structure for table `notification_reads`
--

CREATE TABLE `notification_reads` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `notification_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `read_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notification_reads`
--

INSERT INTO `notification_reads` (`id`, `notification_id`, `user_id`, `read_at`) VALUES
(1, 1, 5, '2026-03-31 00:12:13'),
(2, 2, 5, '2026-03-31 00:15:14'),
(3, 2, 22, '2026-03-31 12:58:59'),
(4, 1, 22, '2026-03-31 12:58:59');

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
  `deleted_by` bigint(20) UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `reservations`
--

INSERT INTO `reservations` (`id`, `user_id`, `book_id`, `status`, `reserved_at`, `expires_at`, `fulfilled_at`, `cancelled_at`, `notes`, `deleted_at`, `deleted_by`) VALUES
(1, 5, 2, 'cancelled', '2026-03-20 19:51:57', '2026-03-22 11:51:57', NULL, '2026-03-20 19:52:26', NULL, NULL, NULL),
(2, 5, 2, 'cancelled', '2026-03-20 20:55:08', '2026-03-22 12:55:08', NULL, '2026-03-20 20:55:16', NULL, NULL, NULL),
(3, 5, 2, 'cancelled', '2026-03-20 20:55:19', '2026-03-22 12:55:19', NULL, '2026-03-20 20:55:24', NULL, NULL, NULL),
(4, 5, 2, 'cancelled', '2026-03-23 10:54:57', '2026-03-25 02:54:57', NULL, '2026-03-23 11:06:00', NULL, NULL, NULL),
(5, 14, 2, 'fulfilled', '2026-03-23 11:09:33', '2026-03-25 03:09:33', '2026-03-23 11:31:30', NULL, NULL, NULL, NULL),
(6, 5, 2, 'fulfilled', '2026-03-29 06:12:36', '2026-03-30 22:12:36', '2026-03-29 06:12:47', NULL, NULL, '2026-03-29 06:12:54', 5),
(7, 5, 1, 'cancelled', '2026-03-30 07:11:47', '2026-03-31 23:11:47', NULL, '2026-03-30 09:28:21', NULL, NULL, NULL);

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
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `site_daily_visits`
--

INSERT INTO `site_daily_visits` (`id`, `visit_date`, `visitor_id`, `user_id`, `first_path`, `last_path`, `first_visited_at`, `last_visited_at`, `hit_count`, `ip_address`, `user_agent`, `created_at`, `updated_at`) VALUES
(1, '2026-03-30', 'visitor_ea141c8e-e00e-4e90-a1ca-573cffdc4048', 5, '/', '/login', '2026-03-30 19:05:09', '2026-03-30 23:43:40', 6, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-30 19:05:09', '2026-03-30 23:43:40'),
(7, '2026-03-31', 'visitor_ea141c8e-e00e-4e90-a1ca-573cffdc4048', 21, '/', '/login', '2026-03-31 00:03:18', '2026-03-31 13:49:38', 10, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-31 00:03:18', '2026-03-31 13:49:38');

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
  `role` enum('employee','alumni','student','scanner','staff','admin','super_admin') NOT NULL DEFAULT 'student',
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
  `_unique_barcode` varchar(90) GENERATED ALWAYS AS (if(`deleted_at` is null,`barcode`,concat('__deleted__',`barcode`,'_',`deleted_at`))) STORED,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `student_employee_id`, `barcode`, `email`, `profile_picture`, `name`, `password_hash`, `role`, `is_active`, `must_change_password`, `last_login`, `created_at`, `updated_at`, `address`, `contact`, `deleted_at`, `deleted_by`) VALUES
(5, 'SA0001', NULL, NULL, NULL, 'Initial SuperAdmin', '$2b$12$85a3/NrWKHjMobGWqufeSe1BANBRnvZkQw2n3Oty2qK9K.s9uIA1a', 'super_admin', 1, 0, '2026-03-31 06:13:28', '2026-03-18 08:03:59', '2026-03-31 06:13:28', '', '0', NULL, NULL),
(8, 'scanner', NULL, NULL, NULL, 'Scanner Test', '$2b$12$8UOwDD5O0nhsIUb0htPdhOQNoJ8k26iYv00cGSfykSTAzjZAyuQFa', 'scanner', 1, 0, '2026-03-28 04:52:31', '2026-03-18 13:35:58', '2026-03-28 04:52:31', '', '0', NULL, NULL),
(10, 'A23-0255', NULL, NULL, NULL, 'Jaztin Abram Contreras', '$2b$12$Bd5JelxU1g2mlBY7O/Z5SejGJZqsqDFN4vl.6U.c6mcADWHHXWpdS', 'student', 1, 0, '2026-03-19 04:33:32', '2026-03-18 16:10:31', '2026-03-19 04:33:32', 'sariaya, quezon', '93209424', NULL, NULL),
(12, 'A23-0333', NULL, NULL, NULL, 'John Anthony Kapalaran', '$2b$12$hZiRdG0FTOi966Hb5MPrbu8UPfpgsckgItmyJj0i/vXYUp9js6Y72', 'student', 1, 1, NULL, '2026-03-19 01:27:47', '2026-03-29 06:33:15', 'Candelaria, Quezon', '09123491412', NULL, NULL),
(14, 'A23-0121', NULL, NULL, NULL, 'Jimuel Jean Untalan', '$2b$12$d6/I.g8GHmHSrZEbYvQDBuENjpoCoMqJwgVPNmfBGMHJdtgoJV1Ku', 'student', 1, 0, '2026-03-28 15:55:15', '2026-03-19 03:35:41', '2026-03-28 15:55:15', 'candelaria, quezon', '09197736004', NULL, NULL),
(15, 'STAFF001', NULL, NULL, NULL, 'Staff Test 1', '$2b$12$W3/xqP.YS5sj/nSTUlhRWuOMHxfjhLTJe/5LeavPOcQ/31PbzjzVa', 'staff', 1, 0, '2026-03-27 13:09:27', '2026-03-19 14:28:27', '2026-03-27 13:09:27', 'test', 'test', NULL, NULL),
(16, 'A23-0202', NULL, NULL, NULL, 'Ivy Mae Aguila', '$2b$12$IE5oLqnbtWTnZMYMrLt2C.0iD3PiudaTN9KmlFuHDS0kBGtbE1Xs6', 'student', 1, 1, NULL, '2026-03-20 09:03:54', '2026-03-20 09:03:54', 'San Isidro, Candelaria, Quezon', '09xxxxxxx', NULL, NULL),
(18, 'A23-0000', 'LIB-USER-000018', NULL, NULL, 'Test Attendance', '$2b$12$UoXR6Z2O1vShF3ROmprL6urcKIYDd2KCGOPkPjMPZyP/lwtKYrsYq', 'student', 1, 0, NULL, '2026-03-27 14:40:11', '2026-03-27 14:48:31', 'test', 'test', NULL, NULL),
(19, 'A23-0002', 'LIB-USER-000019', NULL, NULL, 'Daniel Dave Umali', '$2b$12$NVNJ2iArsqitmKz7fooiC.x2qVr5iVAbrZqTyQe5YMqeO1htHjLW.', 'student', 1, 0, NULL, '2026-03-30 09:31:04', '2026-03-30 09:32:30', 'test', 'test', NULL, NULL),
(20, 'test-000', 'LIB-USER-000020', NULL, NULL, 'changepasswordtest', '$2b$12$wd51QKGm6MbAfZHI8HLbxOlQxfRgiSG/RTf7hHlGNvct7GKaDif5S', 'student', 1, 0, NULL, '2026-03-30 10:09:14', '2026-03-30 10:09:54', 'test', 'test', NULL, NULL),
(21, 'ADMIN-001', 'LIB-USER-000021', NULL, NULL, 'Admin Account #1', '$2b$12$CnHxVEIg77g8cJXd3VqYK.fpu0C30Jq18PV4vBSIY3as0znesO8ce', 'admin', 1, 0, '2026-03-31 05:27:34', '2026-03-30 10:43:38', '2026-03-31 05:27:34', 'test', 'test', NULL, NULL),
(22, 'STAFF-001', 'LIB-USER-000022', NULL, NULL, 'Staff Account #1', '$2b$12$a3CEk8TO74DE3DDi1.TjbuqXHl7h4Iv8nYGRNoo8AqlvnFkb1jhky', 'staff', 1, 0, '2026-03-31 05:51:44', '2026-03-30 10:44:40', '2026-03-31 05:51:44', 'test', 'test', NULL, NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `about_settings`
--
ALTER TABLE `about_settings`
  ADD KEY `fk_about_updated_by` (`updated_by`);

--
-- Indexes for table `academic_subscriptions`
--
ALTER TABLE `academic_subscriptions`
  ADD KEY `idx_active_order` (`is_active`,`sort_order`),
  ADD KEY `fk_sub_created_by` (`created_by`),
  ADD KEY `fk_sub_updated_by` (`updated_by`);

--
-- Indexes for table `attendance_logs`
--
ALTER TABLE `attendance_logs`
  ADD KEY `idx_user_date` (`user_id`,`created_at`),
  ADD KEY `idx_purpose` (`purpose`),
  ADD KEY `fk_att_borrowing` (`borrowing_id`),
  ADD KEY `fk_att_scanned_by` (`scanned_by`),
  ADD KEY `idx_purpose_date` (`purpose`,`created_at`,`id`);

--
-- Indexes for table `auth_refresh_sessions`
--
ALTER TABLE `auth_refresh_sessions`
  ADD UNIQUE KEY `jti` (`jti`),
  ADD KEY `idx_auth_refresh_sessions_user_id` (`user_id`),
  ADD KEY `idx_auth_refresh_sessions_expires_at` (`expires_at`);

--
-- Indexes for table `books`
--
ALTER TABLE `books`
  ADD KEY `idx_books_deleted` (`deleted_at`);

--
-- Indexes for table `book_copies`
--
ALTER TABLE `book_copies`
  ADD UNIQUE KEY `uq_barcode` (`barcode`),
  ADD KEY `idx_book_id` (`book_id`),
  ADD KEY `idx_copies_deleted` (`deleted_at`);

--
-- Indexes for table `borrowings`
--
ALTER TABLE `borrowings`
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
  ADD KEY `idx_post_id` (`post_id`),
  ADD KEY `fk_bc_user` (`user_id`),
  ADD KEY `idx_bulletin_comments_deleted` (`deleted_at`);

--
-- Indexes for table `bulletin_likes`
--
ALTER TABLE `bulletin_likes`
  ADD UNIQUE KEY `uq_like` (`post_id`,`user_id`),
  ADD KEY `fk_bl_user` (`user_id`);

--
-- Indexes for table `bulletin_posts`
--
ALTER TABLE `bulletin_posts`
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `fk_bp_author` (`author_id`),
  ADD KEY `idx_bulletin_posts_deleted` (`deleted_at`);

--
-- Indexes for table `catalog_schema`
--
ALTER TABLE `catalog_schema`
  ADD UNIQUE KEY `uq_key` (`key`),
  ADD UNIQUE KEY `uq_catalog_schema_key` (`key`);

--
-- Indexes for table `library_circulation_settings`
--
ALTER TABLE `library_circulation_settings`
  ADD KEY `fk_library_circulation_settings_updated_by` (`updated_by`);

--
-- Indexes for table `library_holidays`
--
ALTER TABLE `library_holidays`
  ADD UNIQUE KEY `uq_library_holidays_date` (`holiday_date`),
  ADD KEY `idx_library_holidays_active_date` (`is_active`,`holiday_date`),
  ADD KEY `fk_library_holidays_created_by` (`created_by`),
  ADD KEY `fk_library_holidays_updated_by` (`updated_by`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD KEY `idx_notifications_active_created` (`is_active`,`created_at`),
  ADD KEY `idx_notifications_audience_user` (`audience_type`,`audience_user_id`),
  ADD KEY `idx_notifications_audience_role` (`audience_type`,`audience_role`),
  ADD KEY `fk_notifications_created_by` (`created_by`),
  ADD KEY `fk_notifications_audience_user` (`audience_user_id`);

--
-- Indexes for table `notification_reads`
--
ALTER TABLE `notification_reads`
  ADD UNIQUE KEY `uq_notification_reads` (`notification_id`,`user_id`),
  ADD KEY `idx_notification_reads_user` (`user_id`,`read_at`);

--
-- Indexes for table `reservations`
--
ALTER TABLE `reservations`
  ADD KEY `idx_user_status` (`user_id`,`status`),
  ADD KEY `idx_book_status` (`book_id`,`status`),
  ADD KEY `idx_reservations_deleted` (`deleted_at`);

--
-- Indexes for table `site_daily_visits`
--
ALTER TABLE `site_daily_visits`
  ADD UNIQUE KEY `uq_site_daily_visits_date_visitor` (`visit_date`,`visitor_id`),
  ADD KEY `idx_site_daily_visits_user_date` (`user_id`,`visit_date`),
  ADD KEY `idx_site_daily_visits_last_visited_at` (`last_visited_at`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `academic_subscriptions`
--
ALTER TABLE `academic_subscriptions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `attendance_logs`
--
ALTER TABLE `attendance_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `auth_refresh_sessions`
--
ALTER TABLE `auth_refresh_sessions`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=48;

--
-- AUTO_INCREMENT for table `books`
--
ALTER TABLE `books`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `book_copies`
--
ALTER TABLE `book_copies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `borrowings`
--
ALTER TABLE `borrowings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `bulletin_comments`
--
ALTER TABLE `bulletin_comments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `bulletin_likes`
--
ALTER TABLE `bulletin_likes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `bulletin_posts`
--
ALTER TABLE `bulletin_posts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `catalog_schema`
--
ALTER TABLE `catalog_schema`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=131;

--
-- AUTO_INCREMENT for table `library_holidays`
--
ALTER TABLE `library_holidays`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `notification_reads`
--
ALTER TABLE `notification_reads`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `reservations`
--
ALTER TABLE `reservations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `site_daily_visits`
--
ALTER TABLE `site_daily_visits`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

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


SET FOREIGN_KEY_CHECKS = 1;

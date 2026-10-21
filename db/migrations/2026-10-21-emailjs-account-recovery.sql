-- Run with a client that stops on errors. DDL auto-commits in MySQL/MariaDB.
-- Preflight does not rewrite historical email addresses.
-- Use one connection and stop on the first error. No DELIMITER command is needed.
-- This temporary unique key rejects duplicate normalized addresses before any DDL.
-- If INSERT reports a duplicate key, resolve those email conflicts before retrying.
DROP TEMPORARY TABLE IF EXISTS email_accounts_preflight;
CREATE TEMPORARY TABLE email_accounts_preflight (
  email varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY
) ENGINE=InnoDB;
INSERT INTO email_accounts_preflight(email)
 SELECT LOWER(TRIM(email)) FROM users
 WHERE deleted_at IS NULL AND NULLIF(TRIM(email), '') IS NOT NULL;
DROP TEMPORARY TABLE email_accounts_preflight;

ALTER TABLE users
  ADD COLUMN setup_pending tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN email_verified_at datetime NULL,
  ADD COLUMN pending_email varchar(255) NULL,
  ADD COLUMN session_version int UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE delivery_outbox MODIFY event_type enum('notification','audit','email') NOT NULL;

CREATE TABLE email_address_claims (
  email varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
  user_id bigint UNSIGNED NOT NULL,
  KEY idx_email_claim_user (user_id)
) ENGINE=InnoDB;
INSERT INTO email_address_claims(email,user_id)
 SELECT LOWER(TRIM(email)),id FROM users WHERE deleted_at IS NULL AND NULLIF(TRIM(email),'') IS NOT NULL;

CREATE TABLE account_challenges (
  id char(36) NOT NULL PRIMARY KEY,
  user_id bigint UNSIGNED NOT NULL,
  purpose enum('setup','verify_email','recovery','reset') NOT NULL,
  email varchar(255) NOT NULL,
  secret_hash char(64) NOT NULL,
  attempts tinyint UNSIGNED NOT NULL DEFAULT 0,
  expires_at datetime NOT NULL,
  consumed_at datetime NULL,
  created_at datetime NOT NULL DEFAULT current_timestamp(),
  KEY idx_account_challenges_user (user_id,purpose,consumed_at),
  KEY idx_account_challenges_secret (secret_hash,purpose)
) ENGINE=InnoDB;

-- Operational tables below survive application-data restores.
CREATE TABLE email_request_limits (
  request_key char(64) NOT NULL PRIMARY KEY,
  window_start datetime NOT NULL,
  last_request_at datetime NOT NULL,
  requests int UNSIGNED NOT NULL
) ENGINE=InnoDB;
CREATE TABLE email_deliveries (
  id char(36) NOT NULL PRIMARY KEY,
  user_id bigint UNSIGNED NOT NULL,
  recipient varchar(255) NOT NULL,
  purpose varchar(50) NOT NULL,
  dedupe_key varchar(191) NOT NULL UNIQUE,
  challenge_id char(36) NULL,
  priority tinyint NOT NULL DEFAULT 0,
  content_encrypted mediumtext NULL,
  context_json json NULL,
  status enum('queued','processing','accepted','failed','cancelled','unknown') NOT NULL DEFAULT 'queued',
  attempts int UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at datetime NOT NULL DEFAULT current_timestamp(),
  expires_at datetime NOT NULL,
  started_at datetime NULL,
  accepted_at datetime NULL,
  last_error varchar(255) NULL,
  created_at datetime NOT NULL DEFAULT current_timestamp(),
  KEY idx_email_dispatch (status,priority,next_attempt_at)
) ENGINE=InnoDB;
CREATE TABLE email_dispatch_state (
  id tinyint NOT NULL PRIMARY KEY,
  next_send_at datetime(3) NULL
) ENGINE=InnoDB;
INSERT INTO email_dispatch_state(id) VALUES (1);
CREATE TABLE email_quota_usage (
  period_start date NOT NULL PRIMARY KEY,
  period_end date NOT NULL,
  requests_used int UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- Apply before deploying support for weeded/discarded copies.
-- Existing conditions and default are preserved. Safe to run again.
ALTER TABLE book_copies
  MODIFY COLUMN `condition` ENUM('good','damaged','lost','weeded','discarded') NOT NULL DEFAULT 'good';

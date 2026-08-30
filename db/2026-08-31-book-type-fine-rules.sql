-- Run after 2026-08-31-book-types-and-copy-conditions.sql.
ALTER TABLE book_types
  ADD COLUMN fine_interval ENUM('hour','day') NOT NULL DEFAULT 'hour' AFTER fine_per_hour,
  ADD COLUMN initial_fine DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER fine_interval;

ALTER TABLE borrowings
  ADD COLUMN fine_interval ENUM('hour','day') NULL AFTER fine_per_hour,
  ADD COLUMN initial_fine DECIMAL(10,2) NULL AFTER fine_interval;

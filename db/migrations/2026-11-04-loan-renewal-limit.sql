-- Track how many times each loan has been renewed so renewals can be capped.
-- Existing loans start at 0; earlier renewals were never recorded.
-- Deploy the matching release at the same time: snapshots refuse to run while
-- the live tables and the application's table registry disagree.

ALTER TABLE borrowings
  ADD COLUMN renewal_count int(11) NOT NULL DEFAULT 0 AFTER due_date;

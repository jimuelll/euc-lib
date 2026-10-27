-- Remove fine-ledger metadata columns that the application no longer uses.
-- Run once against an existing installation after taking its normal backup.
ALTER TABLE fine_accounts
  DROP COLUMN imported_at;

ALTER TABLE fine_ledger_entries
  DROP COLUMN source_note;

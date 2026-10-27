-- Apply before deploying the prospective fine assessment code.
ALTER TABLE fine_accounts
  ADD COLUMN policy_due_date DATETIME NULL,
  ADD COLUMN policy_rate DECIMAL(12,2) NULL,
  ADD COLUMN policy_interval VARCHAR(16) NULL,
  ADD COLUMN policy_initial DECIMAL(12,2) NULL,
  ADD COLUMN policy_baseline DECIMAL(12,2) NULL;

-- Apply this schema to an existing database before deploying the new server.
-- Existing borrowing records must have matching fine accounts and ledger
-- entries before the new server handles dashboard, clearance, or fine views.
ALTER TABLE book_types
  ADD COLUMN loan_duration_minutes INT NULL AFTER default_borrow_days,
  ADD COLUMN loan_duration_unit ENUM('day', 'hour') NOT NULL DEFAULT 'day' AFTER loan_duration_minutes,
  MODIFY COLUMN default_borrow_days INT NULL;

UPDATE book_types SET loan_duration_minutes = default_borrow_days * 1440, loan_duration_unit = 'day'
WHERE loan_duration_minutes IS NULL;
ALTER TABLE book_types MODIFY COLUMN loan_duration_minutes INT NOT NULL;

ALTER TABLE borrowings
  ADD COLUMN loan_duration_minutes INT NULL AFTER due_date,
  ADD COLUMN loan_duration_unit ENUM('day', 'hour') NULL AFTER loan_duration_minutes;

CREATE TABLE fine_accounts (
  borrowing_id INT NOT NULL PRIMARY KEY,
  charged_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  cycle_base_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  assessed_through_at DATETIME NULL,
  imported_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fine_account_borrowing FOREIGN KEY (borrowing_id) REFERENCES borrowings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE fine_ledger_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  borrowing_id INT NOT NULL,
  kind ENUM('charge','payment','adjustment','reversal','legacy_charge','legacy_credit') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  effective_at DATETIME NOT NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  transaction_item_id BIGINT UNSIGNED NULL,
  source_note VARCHAR(160) NULL,
  KEY idx_fine_entry_borrowing (borrowing_id, id),
  KEY idx_fine_entry_effective (kind, effective_at),
  UNIQUE KEY uq_fine_entry_transaction_item (transaction_item_id),
  CONSTRAINT fk_fine_entry_account FOREIGN KEY (borrowing_id) REFERENCES fine_accounts(borrowing_id) ON DELETE CASCADE,
  CONSTRAINT fk_fine_entry_item FOREIGN KEY (transaction_item_id) REFERENCES clearance_transaction_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

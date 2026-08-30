-- Clearance workflow migration for the library-clevercloud database.
-- Apply once, after importing db/library-clevercloud.sql.  It is additive:
-- existing borrowing settlement values and data are preserved.

CREATE TABLE IF NOT EXISTS clearance_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  receipt_number VARCHAR(48) NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  transaction_type ENUM('payment', 'adjustment', 'reversal') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash') NULL,
  reason TEXT NULL,
  reverses_transaction_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_clearance_receipt_number (receipt_number),
  KEY idx_clearance_user_created (user_id, created_at),
  KEY idx_clearance_reversal (reverses_transaction_id),
  CONSTRAINT fk_clearance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_clearance_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_clearance_reverses FOREIGN KEY (reverses_transaction_id) REFERENCES clearance_transactions(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clearance_transaction_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transaction_id BIGINT UNSIGNED NOT NULL,
  borrowing_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_clearance_item_borrowing (borrowing_id),
  KEY idx_clearance_item_transaction (transaction_id),
  CONSTRAINT fk_clearance_item_transaction FOREIGN KEY (transaction_id) REFERENCES clearance_transactions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_clearance_item_borrowing FOREIGN KEY (borrowing_id) REFERENCES borrowings(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

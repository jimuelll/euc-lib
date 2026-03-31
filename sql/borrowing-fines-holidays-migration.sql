ALTER TABLE borrowings
  MODIFY due_date DATETIME NOT NULL,
  ADD COLUMN last_overdue_notification_at DATETIME NULL AFTER updated_at;

UPDATE borrowings
SET due_date = CONCAT(DATE(due_date), ' 23:59:59')
WHERE due_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS library_circulation_settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  overdue_fine_per_hour DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  updated_by BIGINT(20) UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_library_circulation_settings_singleton CHECK (id = 1),
  CONSTRAINT fk_library_circulation_settings_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

INSERT INTO library_circulation_settings (id, overdue_fine_per_hour)
VALUES (1, 1.00)
ON DUPLICATE KEY UPDATE overdue_fine_per_hour = overdue_fine_per_hour;

CREATE TABLE IF NOT EXISTS library_holidays (
  id INT(11) NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  holiday_date DATE NOT NULL,
  description TEXT DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT(20) UNSIGNED DEFAULT NULL,
  updated_by BIGINT(20) UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_library_holidays_date (holiday_date),
  KEY idx_library_holidays_active_date (is_active, holiday_date),
  CONSTRAINT fk_library_holidays_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_library_holidays_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

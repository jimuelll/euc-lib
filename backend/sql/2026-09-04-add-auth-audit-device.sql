ALTER TABLE auth_audit_events
  MODIFY COLUMN event_type ENUM('login', 'logout', 'password_changed') NOT NULL,
  ADD COLUMN device_type ENUM('desktop', 'mobile', 'tablet', 'unknown') NOT NULL DEFAULT 'unknown'
  AFTER event_type;

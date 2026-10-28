-- Stop the application and email dispatcher while applying this migration.
-- Preserve Scanner identities/password hashes; unfinished setups need an admin reset.
ALTER TABLE users MODIFY role enum('scanner','opac','employee','alumni','student','staff','admin','super_admin') NOT NULL DEFAULT 'student';
ALTER TABLE notifications MODIFY audience_role enum('scanner','opac','employee','alumni','student','staff','admin','super_admin') DEFAULT NULL;
START TRANSACTION;
UPDATE email_deliveries d JOIN users u ON u.id=d.user_id
SET d.status='cancelled',d.content_encrypted=NULL,d.last_error='Library Operations accounts do not use email'
WHERE u.role='scanner' AND d.status IN ('queued','processing');
UPDATE account_challenges c JOIN users u ON u.id=c.user_id
SET c.consumed_at=COALESCE(c.consumed_at,UTC_TIMESTAMP()) WHERE u.role='scanner';
DELETE c FROM email_address_claims c JOIN users u ON u.id=c.user_id WHERE u.role='scanner';
UPDATE auth_refresh_sessions s JOIN users u ON u.id=s.user_id
SET s.revoked_at=COALESCE(s.revoked_at,UTC_TIMESTAMP()) WHERE u.role='scanner';
UPDATE users SET email=NULL,pending_email=NULL,email_verified_at=NULL,setup_pending=0,must_change_password=0,session_version=session_version+1 WHERE role='scanner';
COMMIT;

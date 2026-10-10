-- Additive control metadata; excluded from application-data restores.
ALTER TABLE backup_snapshots
 ADD COLUMN IF NOT EXISTS label varchar(120) DEFAULT NULL,
 ADD COLUMN IF NOT EXISTS notes varchar(500) DEFAULT NULL,
 ADD COLUMN IF NOT EXISTS pinned tinyint(1) NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS checksum varchar(64) DEFAULT NULL,
 ADD COLUMN IF NOT EXISTS snapshot_version int DEFAULT NULL,
 ADD COLUMN IF NOT EXISTS verification_status enum('unverified','verified','failed') NOT NULL DEFAULT 'unverified',
 ADD COLUMN IF NOT EXISTS verified_at datetime DEFAULT NULL;
CREATE TABLE IF NOT EXISTS backup_schedule (
 id tinyint NOT NULL PRIMARY KEY,
 enabled tinyint(1) NOT NULL DEFAULT 0,
 frequency enum('daily','weekly') NOT NULL DEFAULT 'daily',
 hour tinyint NOT NULL DEFAULT 2, weekday tinyint NOT NULL DEFAULT 1,
 next_run datetime DEFAULT NULL,last_run datetime DEFAULT NULL,
 last_result varchar(20) DEFAULT NULL,last_error varchar(255) DEFAULT NULL,
 updated_by bigint unsigned DEFAULT NULL
);
INSERT IGNORE INTO backup_schedule(id) VALUES(1);
ALTER TABLE backup_snapshots MODIFY COLUMN kind enum('manual','scheduled','pre_restore') NOT NULL DEFAULT 'manual';

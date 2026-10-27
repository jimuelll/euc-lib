-- Apply before deploying notification image support. Existing records stay text-only.
ALTER TABLE notifications
 ADD COLUMN image_url varchar(1024) DEFAULT NULL,
 ADD COLUMN image_public_id varchar(191) DEFAULT NULL,
 ADD COLUMN image_alt varchar(250) DEFAULT NULL;

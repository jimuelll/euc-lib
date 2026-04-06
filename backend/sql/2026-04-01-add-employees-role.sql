ALTER TABLE `users`
  MODIFY COLUMN `role` enum('employee','alumni','student','scanner','staff','admin','super_admin') NOT NULL DEFAULT 'student';

ALTER TABLE `notifications`
  MODIFY COLUMN `audience_role` enum('employee','alumni','student','scanner','staff','admin','super_admin') DEFAULT NULL;

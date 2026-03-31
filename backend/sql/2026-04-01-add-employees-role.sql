ALTER TABLE `users`
  MODIFY COLUMN `role` enum('scanner','student','employee','staff','admin','super_admin') NOT NULL DEFAULT 'student';

ALTER TABLE `notifications`
  MODIFY COLUMN `audience_role` enum('scanner','student','employee','staff','admin','super_admin') DEFAULT NULL;

ALTER TABLE `books`
  ADD COLUMN `image_url` varchar(2048) DEFAULT NULL AFTER `metadata`,
  ADD COLUMN `image_public_id` varchar(255) DEFAULT NULL AFTER `image_url`;

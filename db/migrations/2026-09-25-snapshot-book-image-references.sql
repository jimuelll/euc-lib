ALTER TABLE `backup_snapshots`
  ADD COLUMN `book_image_public_ids` json DEFAULT NULL AFTER `size_bytes`;

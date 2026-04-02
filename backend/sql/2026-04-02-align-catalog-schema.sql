INSERT INTO `catalog_schema` (`key`, `label`, `type`, `options`, `required`, `locked`, `order`, `public`, `archived`)
VALUES
  ('title', 'Book Title', 'text', NULL, 1, 1, 0, 1, 0),
  ('author', 'Author', 'text', NULL, 1, 1, 1, 1, 0),
  ('isbn', 'ISBN', 'text', NULL, 0, 0, 2, 1, 0),
  ('category', 'Category', 'select', '["Computer Science","Engineering","Mathematics","Science","Literature","History","Business","Other"]', 0, 0, 3, 1, 0),
  ('copies', 'Copies', 'number', NULL, 0, 0, 4, 1, 0),
  ('location', 'Location', 'text', NULL, 0, 0, 5, 0, 0),
  ('edition', 'Edition', 'text', NULL, 0, 0, 6, 1, 1),
  ('publication_year', 'Publication Year', 'number', NULL, 0, 0, 7, 1, 1),
  ('try', 'try', 'text', NULL, 0, 0, 8, 1, 1)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  type = VALUES(type),
  options = VALUES(options),
  required = VALUES(required),
  locked = VALUES(locked),
  `order` = VALUES(`order`),
  `public` = VALUES(`public`),
  archived = VALUES(archived);

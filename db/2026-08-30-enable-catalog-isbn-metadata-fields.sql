-- Run once after the catalog-materials migration.
-- Makes ISBN metadata fields visible and optional in the Catalog form builder.
INSERT INTO catalog_schema
  (`key`, label, type, options, required, locked, `public`, `order`, archived)
VALUES
  ('edition', 'Edition', 'text', NULL, 0, 0, 1, 6, 0),
  ('publication_year', 'Publication Year', 'number', NULL, 0, 0, 1, 7, 0)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  type = VALUES(type),
  required = 0,
  `public` = 1,
  `order` = VALUES(`order`),
  archived = 0;

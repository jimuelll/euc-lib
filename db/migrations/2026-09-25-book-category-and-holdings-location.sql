-- Add the configurable book Category field and retire the duplicate title-level Location field.
-- Subjects remain free-form metadata. Holdings remain the source of physical locations.

START TRANSACTION;

UPDATE books
SET metadata = JSON_REMOVE(COALESCE(metadata, JSON_OBJECT()), '$.location')
WHERE material_type = 'book'
  AND JSON_EXTRACT(metadata, '$.location') IS NOT NULL;

-- Retain values already supported by the new dropdown; remove legacy values so
-- the public Category filter only exposes configured choices.
UPDATE books
SET metadata = JSON_REMOVE(COALESCE(metadata, JSON_OBJECT()), '$.category')
WHERE material_type = 'book'
  AND JSON_EXTRACT(metadata, '$.category') IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.category')) NOT IN (
    'Circulation', 'Reserved', 'New Arrival', 'Filipiniana',
    'General Reference', 'Special Collection', 'Cultural', 'Fiction'
  );

INSERT INTO catalog_schema (`key`, `label`, `type`, `options`, `required`, `locked`, `order`, `public`, `archived`, `scope`)
VALUES (
  'category', 'Category', 'select',
  JSON_ARRAY('Circulation', 'Reserved', 'New Arrival', 'Filipiniana', 'General Reference', 'Special Collection', 'Cultural', 'Fiction'),
  0, 0, 8, 1, 0, 'book'
)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `type` = VALUES(`type`),
  `options` = VALUES(`options`),
  `required` = VALUES(`required`),
  `locked` = VALUES(`locked`),
  `order` = VALUES(`order`),
  `public` = VALUES(`public`),
  `archived` = VALUES(`archived`),
  `scope` = VALUES(`scope`);

UPDATE catalog_schema
SET archived = 1
WHERE `key` = 'location';

COMMIT;

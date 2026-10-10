-- Retain retired choices independently of active choices. Existing record values are unchanged.
ALTER TABLE catalog_schema ADD COLUMN archived_options JSON NULL AFTER options;

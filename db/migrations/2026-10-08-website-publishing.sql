-- Section drafts stay private until publication updates the public records.
CREATE TABLE IF NOT EXISTS website_content_drafts (
  section varchar(32) NOT NULL PRIMARY KEY,
  draft_json longtext DEFAULT NULL CHECK (draft_json IS NULL OR json_valid(draft_json)),
  base_json longtext DEFAULT NULL CHECK (base_json IS NULL OR json_valid(base_json)),
  revision int unsigned NOT NULL DEFAULT 0,
  saved_at datetime DEFAULT NULL,
  published_at datetime DEFAULT NULL,
  updated_by bigint unsigned DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

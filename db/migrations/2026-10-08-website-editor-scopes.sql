ALTER TABLE website_content_drafts ADD COLUMN IF NOT EXISTS item_meta_json longtext DEFAULT NULL CHECK (item_meta_json IS NULL OR json_valid(item_meta_json));
ALTER TABLE site_content_settings ADD COLUMN IF NOT EXISTS hero_image_alt varchar(500) DEFAULT NULL;
ALTER TABLE academic_subscriptions ADD COLUMN IF NOT EXISTS image_alt varchar(500) DEFAULT NULL;
ALTER TABLE bulletin_posts ADD COLUMN IF NOT EXISTS image_alt varchar(500) DEFAULT NULL, ADD COLUMN IF NOT EXISTS gallery longtext DEFAULT NULL CHECK (gallery IS NULL OR json_valid(gallery));

-- Adds optional event metadata while preserving existing bulletin announcements.
ALTER TABLE bulletin_posts
  ADD COLUMN post_type ENUM('announcement', 'event') NOT NULL DEFAULT 'announcement' AFTER image_public_id,
  ADD COLUMN event_starts_at DATETIME NULL AFTER post_type,
  ADD COLUMN event_ends_at DATETIME NULL AFTER event_starts_at,
  ADD COLUMN event_location VARCHAR(255) NULL AFTER event_ends_at,
  ADD COLUMN event_registration_url VARCHAR(512) NULL AFTER event_location,
  ADD KEY idx_bulletin_events_upcoming (post_type, event_starts_at);

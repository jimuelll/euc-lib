CREATE TABLE IF NOT EXISTS site_content_settings (
  id TINYINT NOT NULL PRIMARY KEY,
  hero_kicker VARCHAR(255) NOT NULL,
  hero_title VARCHAR(255) NOT NULL,
  hero_highlight VARCHAR(255) NOT NULL,
  hero_description TEXT NOT NULL,
  hero_image_url VARCHAR(2048) NULL,
  hero_stats JSON NOT NULL,
  hours JSON NOT NULL,
  address VARCHAR(500) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(100) NOT NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_site_content_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE site_content_settings ADD COLUMN IF NOT EXISTS hero_stats JSON NULL AFTER hero_image_url;
UPDATE site_content_settings
SET hero_stats = '[{"value":"12,000+","label":"Volumes"},{"value":"400+","label":"Journals"},{"value":"24/7","label":"Digital Access"}]'
WHERE hero_stats IS NULL;

INSERT INTO site_content_settings (id, hero_kicker, hero_title, hero_highlight, hero_description, hero_image_url, hours, hero_stats, address, contact_email, contact_phone)
VALUES (1, 'Manuel S. Enverga University Foundation — Candelaria Inc.', 'Enverga-Candelaria', 'Library', 'Digitalized inventory tracking, book reservations, and seamless access to library services — built for academic excellence.', NULL, '[{"day":"Monday – Friday","time":"7:00 AM – 9:00 PM","open":true},{"day":"Saturday","time":"8:00 AM – 5:00 PM","open":true},{"day":"Sunday","time":"Closed","open":false}]', '[{"value":"12,000+","label":"Volumes"},{"value":"400+","label":"Journals"},{"value":"24/7","label":"Digital Access"}]', '123 University Avenue, Building C, 2nd Floor', 'library@college.edu', '(555) 123-4567')
ON DUPLICATE KEY UPDATE id=id;

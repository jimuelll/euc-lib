CREATE TABLE IF NOT EXISTS site_daily_visits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  visit_date DATE NOT NULL,
  visitor_id VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED DEFAULT NULL,
  first_path VARCHAR(255) DEFAULT NULL,
  last_path VARCHAR(255) DEFAULT NULL,
  first_visited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_visited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hit_count INT UNSIGNED NOT NULL DEFAULT 1,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_site_daily_visits_date_visitor (visit_date, visitor_id),
  KEY idx_site_daily_visits_user_date (user_id, visit_date),
  KEY idx_site_daily_visits_last_visited_at (last_visited_at)
);

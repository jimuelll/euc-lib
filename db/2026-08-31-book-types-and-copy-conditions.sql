-- Run after the existing catalog migrations.
CREATE TABLE IF NOT EXISTS book_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  default_borrow_days INT NOT NULL,
  fine_per_hour DECIMAL(10,2) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_book_types_name (name)
);
INSERT INTO book_types (name, default_borrow_days, fine_per_hour) VALUES ('General collection', 7, 1.00) ON DUPLICATE KEY UPDATE name = VALUES(name);
ALTER TABLE books ADD COLUMN book_type_id BIGINT UNSIGNED NULL AFTER material_type;
UPDATE books SET book_type_id = (SELECT id FROM book_types WHERE name = 'General collection' LIMIT 1) WHERE book_type_id IS NULL;
ALTER TABLE books MODIFY book_type_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE books ADD CONSTRAINT fk_books_book_type FOREIGN KEY (book_type_id) REFERENCES book_types(id);
ALTER TABLE borrowings ADD COLUMN fine_per_hour DECIMAL(10,2) NULL AFTER due_date;

-- Catalog materials migration
-- Apply once after importing library-clevercloud.sql.
-- Existing books remain material_type = 'book'.

ALTER TABLE books
  ADD COLUMN material_type ENUM('book','thesis') NOT NULL DEFAULT 'book' AFTER title,
  ADD COLUMN thesis_program VARCHAR(255) DEFAULT NULL AFTER author,
  ADD COLUMN thesis_adviser VARCHAR(255) DEFAULT NULL AFTER thesis_program,
  ADD COLUMN academic_year VARCHAR(32) DEFAULT NULL AFTER thesis_adviser,
  ADD COLUMN thesis_abstract TEXT DEFAULT NULL AFTER academic_year,
  ADD COLUMN thesis_keywords TEXT DEFAULT NULL AFTER thesis_abstract,
  ADD COLUMN accession_number VARCHAR(100) DEFAULT NULL AFTER isbn;

ALTER TABLE books
  ADD KEY idx_books_material_type (material_type),
  ADD UNIQUE KEY uq_books_accession_number (accession_number);

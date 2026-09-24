-- Run after 2026-09-23-copy-holdings-and-catalog-visibility.sql and
-- 2026-09-23-cross-system-invariants.sql. This registry has no copy/user FK:
-- it survives archive, hard-delete attempts, and application-data restore.
CREATE TABLE `accession_claims` (
  `accession_number` varchar(64) NOT NULL,
  `copy_barcode` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `copy_id` int(11) NOT NULL,
  `book_id` int(11) NOT NULL,
  `book_title` varchar(255) NOT NULL,
  `claimed_by` bigint(20) unsigned DEFAULT NULL,
  `claimed_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`accession_number`),
  KEY `idx_accession_claims_barcode` (`copy_barcode`),
  KEY `idx_accession_claims_book_sequence` (`book_id`, `copy_barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `accession_claim_corrections` (
  `correction_id` char(36) NOT NULL,
  `copy_barcode` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `copy_id` int(11) NOT NULL,
  `book_id` int(11) NOT NULL,
  `book_title` varchar(255) NOT NULL,
  `old_accession_number` varchar(64) NOT NULL,
  `new_accession_number` varchar(64) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `corrected_by` bigint(20) unsigned DEFAULT NULL,
  `corrected_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`correction_id`),
  UNIQUE KEY `uq_accession_corrections_old` (`old_accession_number`),
  UNIQUE KEY `uq_accession_corrections_new` (`new_accession_number`),
  KEY `idx_accession_corrections_barcode` (`copy_barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `accession_claims`
  (`accession_number`, `copy_barcode`, `copy_id`, `book_id`, `book_title`, `claimed_by`, `claimed_at`)
SELECT h.accession_number, bc.barcode, bc.id, bc.book_id, COALESCE(b.title, CONCAT('Book ID ', bc.book_id)),
       COALESCE(h.created_by, h.updated_by), COALESCE(h.created_at, UTC_TIMESTAMP())
  FROM copy_holdings h
  JOIN book_copies bc ON bc.id = h.copy_id
  LEFT JOIN books b ON b.id = bc.book_id;

DELIMITER //
CREATE TRIGGER `trg_accession_claims_identity_insert`
BEFORE INSERT ON `accession_claims` FOR EACH ROW
BEGIN
  IF COALESCE(@allow_accession_restore, 0) <> 1 AND NOT EXISTS (
    SELECT 1 FROM book_copies bc
     WHERE bc.id = NEW.copy_id AND bc.barcode = NEW.copy_barcode AND bc.book_id = NEW.book_id
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Accession claim must identify an existing physical copy';
  END IF;
END//
CREATE TRIGGER `trg_accession_claims_no_update`
BEFORE UPDATE ON `accession_claims` FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Accession claims are immutable';
END//
CREATE TRIGGER `trg_accession_claims_no_delete`
BEFORE DELETE ON `accession_claims` FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Accession claims cannot be deleted';
END//
CREATE TRIGGER `trg_accession_corrections_no_update`
BEFORE UPDATE ON `accession_claim_corrections` FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Accession correction history is immutable';
END//
CREATE TRIGGER `trg_accession_corrections_no_delete`
BEFORE DELETE ON `accession_claim_corrections` FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Accession correction history cannot be deleted';
END//
CREATE TRIGGER `trg_accession_corrections_validate_insert`
BEFORE INSERT ON `accession_claim_corrections` FOR EACH ROW
BEGIN
  IF BINARY NEW.old_accession_number = BINARY NEW.new_accession_number
     OR NOT EXISTS (
       SELECT 1 FROM accession_claims old_claim
        WHERE old_claim.accession_number = NEW.old_accession_number
          AND old_claim.copy_barcode = NEW.copy_barcode AND old_claim.book_id = NEW.book_id
     )
     OR NOT EXISTS (
       SELECT 1 FROM accession_claims new_claim
        WHERE new_claim.accession_number = NEW.new_accession_number
          AND new_claim.copy_barcode = NEW.copy_barcode AND new_claim.book_id = NEW.book_id
     ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Accession correction claims must belong to the same physical copy';
  END IF;
END//
CREATE TRIGGER `trg_copy_holdings_claim_insert`
BEFORE INSERT ON `copy_holdings` FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM accession_claims ac JOIN book_copies bc ON bc.id = NEW.copy_id
     WHERE ac.accession_number = NEW.accession_number
       AND ac.copy_barcode = bc.barcode AND ac.book_id = bc.book_id
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Create the permanent accession claim before assigning the holding';
  END IF;
END//
CREATE TRIGGER `trg_copy_holdings_claim_update`
BEFORE UPDATE ON `copy_holdings` FOR EACH ROW
BEGIN
  IF NEW.copy_id <> OLD.copy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A holding cannot be transferred to another physical copy';
  END IF;
  IF BINARY NEW.accession_number <> BINARY OLD.accession_number THEN
    IF NOT EXISTS (
      SELECT 1 FROM accession_claims ac JOIN book_copies bc ON bc.id = NEW.copy_id
       JOIN accession_claim_corrections cc ON cc.copy_barcode = bc.barcode
         AND cc.old_accession_number = OLD.accession_number
         AND cc.new_accession_number = NEW.accession_number
       JOIN accession_claims old_claim ON old_claim.accession_number = OLD.accession_number
         AND old_claim.copy_barcode = bc.barcode AND old_claim.book_id = bc.book_id
       WHERE ac.accession_number = NEW.accession_number
         AND ac.copy_barcode = bc.barcode AND ac.book_id = bc.book_id
    ) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Accession changes require a permanent correction record';
    END IF;
  ELSEIF NOT EXISTS (
    SELECT 1 FROM accession_claims ac JOIN book_copies bc ON bc.id = NEW.copy_id
     WHERE ac.accession_number = NEW.accession_number
       AND ac.copy_barcode = bc.barcode AND ac.book_id = bc.book_id
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Holding accession does not match its permanent claim';
  END IF;
END//
CREATE TRIGGER `trg_copy_holdings_claim_delete`
BEFORE DELETE ON `copy_holdings` FOR EACH ROW
BEGIN
  IF COALESCE(@allow_accession_restore, 0) <> 1 AND EXISTS (
    SELECT 1 FROM accession_claims ac WHERE ac.accession_number = OLD.accession_number
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A claimed accession cannot be removed from holdings';
  END IF;
END//
-- Cascaded child deletes do not fire child-table triggers in MySQL/MariaDB.
-- Guard the book row too, so a hard delete cannot cascade around the copy guard.
CREATE TRIGGER `trg_books_accession_claim_delete`
BEFORE DELETE ON `books` FOR EACH ROW
BEGIN
  IF COALESCE(@allow_accession_restore, 0) <> 1 AND EXISTS (
    SELECT 1 FROM book_copies bc JOIN accession_claims ac ON ac.copy_barcode = bc.barcode
     WHERE bc.book_id = OLD.id
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A book with a claimed accession cannot be hard-deleted';
  END IF;
END//
CREATE TRIGGER `trg_books_accession_claim_identity`
BEFORE UPDATE ON `books` FOR EACH ROW
BEGIN
  IF NEW.id <> OLD.id AND EXISTS (
    SELECT 1 FROM book_copies bc JOIN accession_claims ac ON ac.copy_barcode = bc.barcode
     WHERE bc.book_id = OLD.id
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A book with a claimed accession cannot change identity';
  END IF;
END//
CREATE TRIGGER `trg_book_copies_claim_delete`
BEFORE DELETE ON `book_copies` FOR EACH ROW
BEGIN
  IF COALESCE(@allow_accession_restore, 0) <> 1
     AND EXISTS (SELECT 1 FROM accession_claims ac WHERE ac.copy_barcode = OLD.barcode) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A copy with a claimed accession cannot be hard-deleted';
  END IF;
END//
CREATE TRIGGER `trg_book_copies_claim_identity`
BEFORE UPDATE ON `book_copies` FOR EACH ROW
BEGIN
  IF (NEW.id <> OLD.id OR BINARY NEW.barcode <> BINARY OLD.barcode OR NEW.book_id <> OLD.book_id)
     AND EXISTS (SELECT 1 FROM accession_claims ac WHERE ac.copy_barcode = OLD.barcode AND ac.book_id = OLD.book_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A copy with a claimed accession cannot change physical identity';
  END IF;
END//
DELIMITER ;

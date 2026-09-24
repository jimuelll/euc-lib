-- Apply after 2026-09-24-accession-lifecycle.sql.
-- Accession numbers stay attached to their original physical copy forever.
-- A mistaken number is voided by an append-only event; staff must add a new
-- physical copy before assigning the correct number.
CREATE TABLE `accession_claim_voids` (
  `accession_number` varchar(64) NOT NULL,
  `copy_barcode` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `copy_id` int(11) NOT NULL,
  `book_id` int(11) NOT NULL,
  `book_title` varchar(255) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `voided_by` bigint(20) unsigned DEFAULT NULL,
  `voided_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`accession_number`),
  KEY `idx_accession_claim_voids_barcode` (`copy_barcode`),
  KEY `idx_accession_claim_voids_book` (`book_id`, `copy_barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate numbers voided by the now-retired correction flow.
INSERT IGNORE INTO `accession_claim_voids`
  (`accession_number`, `copy_barcode`, `copy_id`, `book_id`, `book_title`, `reason`, `voided_by`, `voided_at`)
SELECT old_claim.accession_number, old_claim.copy_barcode, old_claim.copy_id,
       old_claim.book_id, old_claim.book_title,
       CONCAT('Legacy correction: ', correction.reason), correction.corrected_by, correction.corrected_at
  FROM accession_claim_corrections correction
  JOIN accession_claims old_claim ON old_claim.accession_number = correction.old_accession_number
 WHERE old_claim.copy_barcode = correction.copy_barcode
   AND old_claim.book_id = correction.book_id;

DELIMITER //
CREATE TRIGGER `trg_accession_claim_voids_validate_insert`
BEFORE INSERT ON `accession_claim_voids` FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM accession_claims claim
     WHERE claim.accession_number = NEW.accession_number
       AND claim.copy_barcode = NEW.copy_barcode
       AND claim.book_id = NEW.book_id
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only the original physical copy may void its permanently claimed accession';
  END IF;
END//
CREATE TRIGGER `trg_accession_claim_voids_no_update`
BEFORE UPDATE ON `accession_claim_voids` FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Accession void events are immutable';
END//
CREATE TRIGGER `trg_accession_claim_voids_no_delete`
BEFORE DELETE ON `accession_claim_voids` FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Accession void events cannot be deleted';
END//

DROP TRIGGER IF EXISTS `trg_book_copies_claim_identity_insert`//
CREATE TRIGGER `trg_book_copies_claim_identity_insert`
BEFORE INSERT ON `book_copies` FOR EACH ROW
BEGIN
  IF COALESCE(@allow_accession_restore, 0) <> 1 AND EXISTS (
    SELECT 1 FROM accession_claims claim WHERE claim.copy_barcode = NEW.barcode
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A barcode reserved by permanent accession history cannot be reused';
  END IF;
END//

DROP TRIGGER IF EXISTS `trg_copy_holdings_claim_update`//
CREATE TRIGGER `trg_copy_holdings_claim_update`
BEFORE UPDATE ON `copy_holdings` FOR EACH ROW
BEGIN
  IF NEW.copy_id <> OLD.copy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A holding cannot be transferred to another physical copy';
  END IF;
  IF BINARY NEW.accession_number <> BINARY OLD.accession_number THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An assigned accession number is permanent and cannot be changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM accession_claims claim JOIN book_copies copy ON copy.id = NEW.copy_id
     WHERE claim.accession_number = NEW.accession_number
       AND claim.copy_barcode = copy.barcode
       AND claim.book_id = copy.book_id
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Holding accession does not match its permanent claim';
  END IF;
END//

DROP TRIGGER IF EXISTS `trg_accession_corrections_validate_insert`//
CREATE TRIGGER `trg_accession_corrections_validate_insert`
BEFORE INSERT ON `accession_claim_corrections` FOR EACH ROW
BEGIN
  IF COALESCE(@allow_accession_restore, 0) <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Accession correction events are legacy history and cannot be created';
  END IF;
END//
DELIMITER ;

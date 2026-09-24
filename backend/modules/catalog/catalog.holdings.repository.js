const db = require("../../db");
const { availableToBorrow, hasActiveBookPolicy } = require("./copyEligibility");

const holdingSelect = `
  SELECT bc.id AS copy_id, bc.book_id, bc.barcode, bc.condition, bc.is_active,
         bk.title, bk.author, bk.isbn, bk.deleted_at AS book_deleted_at,
         bt.name AS book_type, (bk.material_type = 'book' AND NOT ${hasActiveBookPolicy("bk")}) AS needs_policy,
         ${availableToBorrow("bc")} AS borrow_eligible,
         h.accession_number, (voided_accession.accession_number IS NOT NULL) AS accession_voided,
         h.price, h.program_id, ap.name AS course, ap.is_active AS program_is_active,
         h.course_code, h.location, h.date_acquired, h.distributor,
         h.invoice_reference,
         CASE WHEN br.id IS NOT NULL THEN 'borrowed'
              WHEN rr.id IS NOT NULL THEN 'reserved'
              ELSE 'available' END AS circulation_status,
         br.due_date, borrower.name AS borrower_name,
         EXISTS(SELECT 1 FROM borrowings ab WHERE ab.copy_id = bc.id AND ab.deleted_at IS NULL AND ab.status IN ('borrowed','overdue')) AS has_active_loan,
         EXISTS(SELECT 1 FROM reservations ar WHERE ar.reserved_copy_id = bc.id AND ar.status = 'ready' AND ar.deleted_at IS NULL AND (ar.expires_at IS NULL OR ar.expires_at > NOW())) AS has_ready_reservation
    FROM book_copies bc
    JOIN books bk ON bk.id = bc.book_id
    LEFT JOIN book_types bt ON bt.id = bk.book_type_id
    LEFT JOIN copy_holdings h ON h.copy_id = bc.id
    LEFT JOIN accession_claim_voids voided_accession ON voided_accession.accession_number = h.accession_number
    LEFT JOIN academic_programs ap ON ap.id = h.program_id
    LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.deleted_at IS NULL AND br.status IN ('borrowed','overdue')
    LEFT JOIN users borrower ON borrower.id = br.user_id
    LEFT JOIN reservations rr ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL AND (rr.expires_at IS NULL OR rr.expires_at > NOW())`;

const getBookHoldings = async (bookId) => {
  const [rows] = await db.query(
    `${holdingSelect} WHERE bc.book_id = ? AND bc.deleted_at IS NULL AND bk.deleted_at IS NULL ORDER BY bc.id ASC`,
    [bookId],
  );
  return rows;
};

const searchHoldings = async ({ query = "", programId = null, status = "all", completion = "all", page = 1, limit = 25 } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const like = `%${String(query).trim()}%`;
  const where = ["bc.deleted_at IS NULL", "bk.deleted_at IS NULL"];
  const params = [];
  if (query.trim()) {
    where.push("(bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ? OR bc.barcode LIKE ? OR h.accession_number LIKE ? OR h.course_code LIKE ? OR h.location LIKE ?)");
    params.push(like, like, like, like, like, like, like);
  }
  if (programId) { where.push("h.program_id = ?"); params.push(programId); }
  if (completion === "complete") where.push("h.accession_number IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accession_claim_voids completion_void WHERE completion_void.accession_number = h.accession_number)");
  if (completion === "missing") where.push("(h.accession_number IS NULL OR EXISTS (SELECT 1 FROM accession_claim_voids completion_void WHERE completion_void.accession_number = h.accession_number))");
  if (status === "inactive") where.push("bc.is_active = 0");
  else if (status === "voided") where.push("EXISTS (SELECT 1 FROM accession_claim_voids status_void WHERE status_void.accession_number = h.accession_number)");
  else if (status === "borrowed") where.push("br.id IS NOT NULL");
  else if (status === "reserved") where.push("br.id IS NULL AND rr.id IS NOT NULL");
  else if (status === "available") where.push(availableToBorrow("bc"));
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const fromSql = `FROM book_copies bc JOIN books bk ON bk.id = bc.book_id
    LEFT JOIN copy_holdings h ON h.copy_id = bc.id
    LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.deleted_at IS NULL AND br.status IN ('borrowed','overdue')
    LEFT JOIN reservations rr ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL AND (rr.expires_at IS NULL OR rr.expires_at > NOW())`;
  const [[{ total }]] = await db.query(`SELECT COUNT(DISTINCT bc.id) AS total ${fromSql} ${whereSql}`, params);
  const [rows] = await db.query(
    `${holdingSelect} ${whereSql} ORDER BY bk.title ASC, bc.id ASC LIMIT ? OFFSET ?`,
    [...params, safeLimit, (safePage - 1) * safeLimit],
  );
  return { rows, total: Number(total), page: safePage, limit: safeLimit };
};

const getCopyForUpdate = async (copyId, conn) => {
  const [[row]] = await conn.query(
    `SELECT bc.id, bc.book_id, bc.barcode, bc.condition, bc.is_active, bc.notes,
       bk.title, bk.deleted_at AS book_deleted_at,
       h.accession_number, EXISTS(SELECT 1 FROM accession_claim_voids voided_accession WHERE voided_accession.accession_number = h.accession_number) AS accession_voided,
       h.price, h.program_id, h.course_code, h.location,
       h.date_acquired, h.distributor, h.invoice_reference,
       EXISTS(SELECT 1 FROM borrowings b WHERE b.copy_id = bc.id AND b.deleted_at IS NULL AND b.status IN ('borrowed','overdue')) AS has_active_loan,
       EXISTS(SELECT 1 FROM reservations r WHERE r.reserved_copy_id = bc.id AND r.status = 'ready' AND r.deleted_at IS NULL AND (r.expires_at IS NULL OR r.expires_at > NOW())) AS has_ready_reservation
     FROM book_copies bc JOIN books bk ON bk.id = bc.book_id LEFT JOIN copy_holdings h ON h.copy_id = bc.id
     WHERE bc.id = ? AND bc.deleted_at IS NULL FOR UPDATE`,
    [copyId],
  );
  return row || null;
};

const findProgram = async (programId, conn) => {
  const [[row]] = await conn.query("SELECT id, is_active FROM academic_programs WHERE id = ? FOR UPDATE", [programId]);
  return row || null;
};

const insertAccessionClaim = async (copy, accessionNumber, userId, conn) => {
  await conn.query(
    `INSERT INTO accession_claims
       (accession_number, copy_barcode, copy_id, book_id, book_title, claimed_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [accessionNumber, copy.barcode, copy.id, copy.book_id, copy.title, userId ?? null],
  );
};

const getCopyBookIdentity = async (copyId, conn) => {
  const [[row]] = await conn.query("SELECT book_id FROM book_copies WHERE id = ? AND deleted_at IS NULL", [copyId]);
  return row || null;
};

const insertAccessionVoid = async (copy, reason, userId, conn) => {
  await conn.query(
    `INSERT INTO accession_claim_voids
       (accession_number, copy_barcode, copy_id, book_id, book_title, reason, voided_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [copy.accession_number, copy.barcode, copy.id, copy.book_id, copy.title, reason, userId ?? null],
  );
};

const countPendingReservations = async (bookId, conn) => {
  const [[row]] = await conn.query(
    "SELECT COUNT(*) AS total FROM reservations WHERE book_id = ? AND status = 'pending' AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())",
    [bookId],
  );
  return Number(row.total);
};

const countEligibleCopies = async (bookId, excludedCopyId, conn) => {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS total FROM book_copies bc
       JOIN books bk ON bk.id = bc.book_id
      WHERE bc.book_id = ? AND ${availableToBorrow("bc")}
        AND (? IS NULL OR bc.id <> ?)`,
    [bookId, excludedCopyId, excludedCopyId],
  );
  return Number(row.total);
};

const insertHolding = async (copyId, value, userId, conn) => {
  await conn.query(
    `INSERT INTO copy_holdings
       (copy_id, accession_number, price, program_id, course_code, location, date_acquired, distributor, invoice_reference, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [copyId, value.accessionNumber, value.price, value.programId, value.courseCode, value.location, value.dateAcquired,
      value.distributor, value.invoiceReference, userId ?? null, userId ?? null],
  );
};

const updateHoldingDetails = async (copyId, value, userId, conn) => {
  const [result] = await conn.query(
    `UPDATE copy_holdings SET price = ?, program_id = ?, course_code = ?, location = ?,
       date_acquired = ?, distributor = ?, invoice_reference = ?, updated_by = ?
     WHERE copy_id = ?`,
    [value.price, value.programId, value.courseCode, value.location, value.dateAcquired,
      value.distributor, value.invoiceReference, userId ?? null, copyId],
  );
  return Number(result.affectedRows);
};

const getHoldingForCopy = async (copyId, conn) => {
  const [[row]] = await conn.query(
    `SELECT bc.id, bc.book_id, bc.barcode, bk.title, h.accession_number,
       EXISTS(SELECT 1 FROM accession_claim_voids voided_accession WHERE voided_accession.accession_number = h.accession_number) AS accession_voided, h.price, h.program_id,
       h.course_code, h.location, h.date_acquired, h.distributor, h.invoice_reference
     FROM book_copies bc JOIN books bk ON bk.id = bc.book_id
     LEFT JOIN copy_holdings h ON h.copy_id = bc.id WHERE bc.id = ?`,
    [copyId],
  );
  return row || null;
};

module.exports = {
  getBookHoldings, searchHoldings, getCopyForUpdate, getCopyBookIdentity, findProgram,
  insertAccessionClaim, insertAccessionVoid, countPendingReservations, countEligibleCopies,
  insertHolding, updateHoldingDetails, getHoldingForCopy,
};

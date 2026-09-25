const db = require("../../db");
const { catalogDisplayColumns } = require("../catalog/catalog.projection");
const { availableToBorrow, hasAccession, hasActiveBookPolicy } = require("../catalog/copyEligibility");

const findActiveBorrows = async (userId) => {
  const [rows] = await db.query(
    `SELECT b.id, bk.title, bk.author,
            b.borrowed_at, b.due_date, b.returned_at, b.status, b.notes,
            COALESCE(b.settled_amount, 0) AS settled_amount,
            bc.id AS copy_id, bc.barcode AS copy_barcode, h.accession_number, bc.condition AS copy_condition
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id
     LEFT JOIN book_copies bc ON bc.id = b.copy_id
     LEFT JOIN copy_holdings h ON h.copy_id = bc.id
      WHERE b.user_id = ? AND b.deleted_at IS NULL AND b.status IN ('borrowed', 'overdue')
     ORDER BY b.due_date ASC`,
    [userId],
  );
  return rows;
};

const countBorrowHistory = async (userId) => {
  const [[{ total }]] = await db.query(
    "SELECT COUNT(*) AS total FROM borrowings WHERE user_id = ? AND status = 'returned' AND deleted_at IS NULL",
    [userId],
  );
  return Number(total);
};

const findBorrowHistory = async (userId, { limit, offset } = {}) => {
  const paged = Number.isFinite(limit) && Number.isFinite(offset);
  const [rows] = await db.query(
    `SELECT b.id, bk.title, bk.author,
            b.borrowed_at, b.returned_at, b.due_date, b.status,
            COALESCE(b.settled_amount, 0) AS settled_amount,
            bc.id AS copy_id, bc.barcode AS copy_barcode, h.accession_number
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id
     LEFT JOIN book_copies bc ON bc.id = b.copy_id
     LEFT JOIN copy_holdings h ON h.copy_id = bc.id
     WHERE b.user_id = ? AND b.status = 'returned'
     ORDER BY b.returned_at DESC${paged ? " LIMIT ? OFFSET ?" : " LIMIT 50"}`,
    paged ? [userId, limit, offset] : [userId],
  );
  return rows;
};

const searchCatalogueWithAvailability = async (query, { showUnheldInOpac = true } = {}) => {
  const like = `%${query}%`;
  const visibilityFilter = showUnheldInOpac ? "" : `AND EXISTS (
    SELECT 1 FROM book_copies visible_bc
    WHERE visible_bc.book_id = bk.id AND visible_bc.deleted_at IS NULL
      AND visible_bc.is_active = 1 AND visible_bc.condition IN ('good','damaged')
      AND ${hasAccession("visible_bc")}
  )`;
  const [rows] = await db.query(
    `SELECT
       bk.id, bk.title, bk.author,
       ${catalogDisplayColumns("bk", ["category"])},
       GROUP_CONCAT(DISTINCT NULLIF(TRIM(ch.location), '') ORDER BY ch.location SEPARATOR ', ') AS location,
       bk.isbn, bk.copies, bk.material_type,
       COUNT(DISTINCT CASE WHEN ${hasAccession("bc", "ch")} THEN bc.id END) AS registered_copies,
       COUNT(DISTINCT CASE WHEN ${availableToBorrow("bc")} THEN bc.id END) AS available,
       (COUNT(DISTINCT CASE WHEN ${availableToBorrow("bc")} THEN bc.id END) > 0) AS canBorrow,
       (${hasActiveBookPolicy("bk")} AND COUNT(DISTINCT CASE WHEN ${hasAccession("bc", "ch")} THEN bc.id END) > 0) AS canReserve
     FROM books bk
     LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.condition IN ('good', 'damaged') AND bc.deleted_at IS NULL
     LEFT JOIN copy_holdings ch ON ch.copy_id = bc.id
     LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.deleted_at IS NULL AND br.status IN ('borrowed','overdue')
     LEFT JOIN reservations rr ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL AND (rr.expires_at IS NULL OR rr.expires_at > NOW())
     WHERE bk.deleted_at IS NULL AND bk.material_type = 'book'
       AND (bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ?)
       ${visibilityFilter}
     GROUP BY bk.id ORDER BY bk.title ASC LIMIT 50`,
    [like, like, like],
  );
  return rows;
};

const findUserByBarcode = async (scannedValue) => {
  const [[user]] = await db.query(
    `SELECT id, name, role, student_employee_id, barcode
     FROM users
     WHERE (barcode = ? OR student_employee_id = ?) AND deleted_at IS NULL
     LIMIT 1`,
    [scannedValue, scannedValue],
  );
  return user ?? null;
};

const findCopyByBarcode = async (identifier) => {
  const [[copy]] = await db.query(
    `SELECT bc.id, bc.book_id, bc.barcode, bc.condition, bc.is_active, h.accession_number,
            EXISTS(SELECT 1 FROM accession_claim_voids voided_accession WHERE voided_accession.accession_number = h.accession_number) AS accession_voided,
            (h.copy_id IS NOT NULL) AS has_holding,
            (${hasAccession("bc", "h")} AND bc.is_active = 1 AND bc.condition IN ('good','damaged') AND bk.material_type = 'book' AND ${hasActiveBookPolicy("bk")}) AS borrow_eligible,
            (bk.material_type = 'book' AND NOT ${hasActiveBookPolicy("bk")}) AS needs_policy,
            bk.title, bk.author, bk.copies,
            EXISTS(SELECT 1 FROM reservations r
              WHERE r.reserved_copy_id = bc.id AND r.status = 'ready' AND r.deleted_at IS NULL AND (r.expires_at IS NULL OR r.expires_at > NOW())) AS is_reserved,
            EXISTS(SELECT 1 FROM borrowings active_borrow
              WHERE active_borrow.copy_id = bc.id AND active_borrow.deleted_at IS NULL AND active_borrow.status IN ('borrowed','overdue')) AS has_active_loan
     FROM book_copies bc
     JOIN books bk ON bk.id = bc.book_id AND bk.deleted_at IS NULL
     LEFT JOIN copy_holdings h ON h.copy_id = bc.id
     WHERE (bc.barcode = ? OR h.accession_number = ?) AND bc.deleted_at IS NULL
     ORDER BY (h.accession_number = ?) DESC LIMIT 1`,
    [identifier, identifier, identifier],
  );
  return copy ?? null;
};

const findActiveBorrowingByCopyBarcode = async (identifier) => {
  const [[row]] = await db.query(
    `SELECT b.id, b.user_id, b.copy_id
     FROM borrowings b
     JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
     LEFT JOIN copy_holdings h ON h.copy_id = bc.id
     WHERE (bc.barcode = ? OR h.accession_number = ?) AND b.deleted_at IS NULL AND b.status IN ('borrowed','overdue')
     ORDER BY (h.accession_number = ?) DESC
     LIMIT 1`,
    [identifier.trim(), identifier.trim(), identifier.trim()],
  );
  return row ?? null;
};

const findReturnPreviewByIdentifier = async (identifier) => {
  const [[row]] = await db.query(
    `SELECT b.id AS borrowing_id, b.borrowed_at, b.due_date, b.status,
            u.id AS user_id, u.name AS user_name, u.student_employee_id, u.role,
            bc.id AS copy_id, bc.book_id, bc.barcode AS copy_barcode,
            bc.condition AS copy_condition, bc.is_active AS copy_is_active,
            h.accession_number, bk.title, bk.author
       FROM borrowings b
       JOIN book_copies bc ON bc.id = b.copy_id
       JOIN books bk ON bk.id = b.book_id
       JOIN users u ON u.id = b.user_id
       LEFT JOIN copy_holdings h ON h.copy_id = bc.id
      WHERE (h.accession_number = ? OR bc.barcode = ?)
        AND b.deleted_at IS NULL
        AND b.status IN ('borrowed', 'overdue')
      ORDER BY (h.accession_number = ?) DESC
      LIMIT 1`,
    [identifier, identifier, identifier],
  );
  return row ?? null;
};

const findUserWithActiveBorrows = async (studentEmployeeId) => {
  const [[user]] = await db.query(
    `SELECT id, name, role, student_employee_id, barcode
     FROM users
     WHERE student_employee_id = ? AND is_active = 1 AND deleted_at IS NULL
     LIMIT 1`,
    [studentEmployeeId],
  );
  if (!user) return null;
  const [activeBorrows] = await db.query(
    `SELECT b.id, b.book_id, b.copy_id, bk.title, bk.author, b.due_date, b.status,
            bc.barcode AS copy_barcode, h.accession_number,
            COALESCE(b.settled_amount, 0) AS settled_amount
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
     LEFT JOIN book_copies bc ON bc.id = b.copy_id
     LEFT JOIN copy_holdings h ON h.copy_id = bc.id
     WHERE b.user_id = ? AND b.deleted_at IS NULL AND b.status IN ('borrowed', 'overdue')
     ORDER BY b.due_date ASC`,
    [user.id],
  );
  return { user, activeBorrows };
};

const getConnection = () => db.getConnection();

const getBorrowingNotificationTarget = async (borrowingId, conn = db) => {
  const [[row]] = await conn.query(
    `SELECT b.id, b.user_id, bk.title
       FROM borrowings b
       JOIN books bk ON bk.id = b.book_id
      WHERE b.id = ?
      LIMIT 1`,
    [borrowingId],
  );
  return row ?? null;
};

const findBookForBorrow = async (bookId, conn) => {
  const [[book]] = await conn.query(
    `SELECT bk.id, bk.title, bk.copies, bk.material_type,
            bt.id AS loan_policy_id_snapshot, bt.name AS loan_policy_name_snapshot,
            bt.default_borrow_days, bt.loan_duration_minutes, bt.loan_duration_unit, bt.fine_per_hour, bt.fine_interval, bt.initial_fine
       FROM books bk
       LEFT JOIN book_types bt ON bt.id = bk.book_type_id AND bt.is_active = 1
      WHERE bk.id = ? AND bk.deleted_at IS NULL
      FOR UPDATE`,
    [bookId],
  );
  return book ?? null;
};

const findCopyForBorrow = async (barcode, conn) => {
  const [[copy]] = await conn.query(
    `SELECT bc.id, bc.book_id, bc.barcode, bc.condition, bc.is_active, h.accession_number,
            EXISTS(SELECT 1 FROM accession_claim_voids voided_accession WHERE voided_accession.accession_number = h.accession_number) AS accession_voided,
            bk.title, bk.copies, bk.material_type, bt.id AS loan_policy_id_snapshot,
            bt.name AS loan_policy_name_snapshot, (bt.id IS NOT NULL) AS has_active_policy, bt.default_borrow_days, bt.loan_duration_minutes, bt.loan_duration_unit,
            bt.fine_per_hour, bt.fine_interval, bt.initial_fine
       FROM book_copies bc
       JOIN books bk ON bk.id = bc.book_id AND bk.deleted_at IS NULL
       LEFT JOIN copy_holdings h ON h.copy_id = bc.id
       LEFT JOIN book_types bt ON bt.id = bk.book_type_id AND bt.is_active = 1
      WHERE (bc.barcode = ? OR h.accession_number = ?) AND bc.deleted_at IS NULL
      ORDER BY (h.accession_number = ?) DESC
      LIMIT 1
      FOR UPDATE`,
    [barcode, barcode, barcode],
  );
  return copy ?? null;
};

const findCopyBookIdentityForBorrow = async (identifier, conn) => {
  const [[row]] = await conn.query(
    `SELECT bc.book_id
       FROM book_copies bc
       LEFT JOIN copy_holdings h ON h.copy_id = bc.id
      WHERE (bc.barcode = ? OR h.accession_number = ?) AND bc.deleted_at IS NULL
      ORDER BY (h.accession_number = ?) DESC
      LIMIT 1`,
    [identifier, identifier, identifier],
  );
  return row ?? null;
};

const findAvailableCopyForBook = async (bookId, conn) => {
  const [[copy]] = await conn.query(
    `SELECT bc.id, bc.barcode, bc.condition
       FROM book_copies bc
      WHERE bc.book_id = ? AND ${availableToBorrow("bc")}
      ORDER BY bc.condition = 'good' DESC, bc.id ASC
      LIMIT 1 FOR UPDATE`,
    [bookId],
  );
  return copy ?? null;
};

const countPendingReservationsForBook = async (bookId, conn) => {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS total FROM reservations
      WHERE book_id = ? AND status = 'pending' AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())`,
    [bookId],
  );
  return Number(row.total ?? 0);
};

const countAvailableCopiesForBook = async (bookId, excludedCopyId, conn) => {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS total FROM book_copies bc
      WHERE bc.book_id = ? AND bc.id <> ? AND ${availableToBorrow("bc")}`,
    [bookId, excludedCopyId],
  );
  return Number(row.total ?? 0);
};

const findReadyHoldByCopy = async (copyId, conn) => {
  const [[row]] = await conn.query(
    "SELECT id FROM reservations WHERE reserved_copy_id = ? AND status = 'ready' AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE",
    [copyId],
  );
  return row ?? null;
};

const findActiveBorrowingByCopy = async (copyId, conn) => {
  const [[row]] = await conn.query(
    "SELECT id FROM borrowings WHERE copy_id = ? AND deleted_at IS NULL AND status IN ('borrowed','overdue') FOR UPDATE",
    [copyId],
  );
  return row ?? null;
};

const findActiveBorrowingByUserBook = async (userId, bookId, conn) => {
  const [[row]] = await conn.query(
    "SELECT id FROM borrowings WHERE user_id = ? AND book_id = ? AND deleted_at IS NULL AND status IN ('borrowed','overdue') FOR UPDATE",
    [userId, bookId],
  );
  return row ?? null;
};

const findReadyReservation = async (reservationId, userId, bookId, conn) => {
  const [[row]] = await conn.query(
    `SELECT id, reserved_copy_id FROM reservations
      WHERE id = ? AND user_id = ? AND book_id = ?
        AND status = 'ready' AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE`,
    [reservationId, userId, bookId],
  );
  return row ?? null;
};

const createBorrowing = async ({ userId, bookId, copyId, dueDate, durationMinutes, durationUnit, finePerHour, fineInterval, initialFine, issuedBy, loanPolicyIdSnapshot, loanPolicyNameSnapshot }, conn) => {
  const [result] = await conn.query(
    `INSERT INTO borrowings (user_id, book_id, copy_id, loan_policy_id_snapshot, loan_policy_name_snapshot, due_date, loan_duration_minutes, loan_duration_unit, fine_per_hour, fine_interval, initial_fine, status, issued_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrowed', ?)`,
    [userId, bookId, copyId, loanPolicyIdSnapshot ?? null, loanPolicyNameSnapshot || "Unknown historical policy", dueDate, durationMinutes, durationUnit, finePerHour, fineInterval, initialFine, issuedBy ?? null],
  );
  return result.insertId;
};

const fulfillReadyReservationAfterCheckout = async (reservationId, conn) => {
  const [result] = await conn.query(
    `UPDATE reservations SET status = 'fulfilled', fulfilled_at = NOW()
      WHERE id = ? AND status = 'ready' AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())`,
    [reservationId],
  );
  return Number(result.affectedRows);
};

const getBorrowingForReturn = async (borrowingId, conn) => {
  const [[row]] = await conn.query(
    `SELECT b.id, b.user_id, b.book_id, b.copy_id, b.status, b.due_date, b.returned_at,
            b.fine_per_hour, b.fine_interval, b.initial_fine, bk.title, bc.barcode
       FROM borrowings b JOIN books bk ON bk.id = b.book_id
       LEFT JOIN book_copies bc ON bc.id = b.copy_id
      WHERE b.id = ? AND b.deleted_at IS NULL FOR UPDATE`,
    [borrowingId],
  );
  return row ?? null;
};

const markReturned = async (borrowingId, conn) => {
  const [result] = await conn.query("UPDATE borrowings SET status = 'returned', returned_at = NOW() WHERE id = ? AND deleted_at IS NULL AND status IN ('borrowed','overdue')", [borrowingId]);
  return result.affectedRows;
};

const getAdminBorrowing = async (borrowingId) => {
  const [[row]] = await db.query("SELECT id, user_id, status FROM borrowings WHERE id = ? AND deleted_at IS NULL", [borrowingId]);
  return row ?? null;
};

const lockBorrowingOwner = async (userId, conn) => {
  const [[row]] = await conn.query("SELECT id FROM users WHERE id = ? FOR UPDATE", [userId]);
  return row ?? null;
};

const getAdminBorrowingForUpdate = async (borrowingId, conn) => {
  const [[row]] = await conn.query(
    `SELECT b.id, b.user_id, b.book_id, b.copy_id, b.status, b.deleted_at, b.due_date, b.returned_at,
            bk.title, bc.barcode
       FROM borrowings b JOIN books bk ON bk.id = b.book_id
       LEFT JOIN book_copies bc ON bc.id = b.copy_id
      WHERE b.id = ? AND b.deleted_at IS NULL FOR UPDATE`,
    [borrowingId],
  );
  return row ?? null;
};

const getAdminBorrowingAuditSnapshot = async (borrowingId, conn) => {
  const [[row]] = await conn.query(
    `SELECT b.id, b.user_id, b.book_id, b.copy_id, b.status, b.deleted_at, b.due_date, b.returned_at,
            bk.title, bc.barcode
       FROM borrowings b JOIN books bk ON bk.id = b.book_id
       LEFT JOIN book_copies bc ON bc.id = b.copy_id
      WHERE b.id = ? LIMIT 1`,
    [borrowingId],
  );
  return row ?? null;
};

const archiveBorrowing = async (borrowingId, deletedBy, conn) => {
  const [result] = await conn.query("UPDATE borrowings SET deleted_at = NOW(), deleted_by = ? WHERE id = ? AND deleted_at IS NULL", [deletedBy, borrowingId]);
  return result.affectedRows;
};

const getArchivedBorrowing = async (borrowingId, conn) => {
  const [[row]] = await conn.query(
    `SELECT b.id, b.user_id, b.book_id, b.copy_id, b.status, b.deleted_at, b.due_date, b.returned_at,
            bk.title, bc.barcode
       FROM borrowings b JOIN books bk ON bk.id = b.book_id
       LEFT JOIN book_copies bc ON bc.id = b.copy_id
      WHERE b.id = ? AND b.deleted_at IS NOT NULL FOR UPDATE`,
    [borrowingId],
  );
  return row ?? null;
};

const restoreBorrowing = async (borrowingId, conn) => {
  const [result] = await conn.query("UPDATE borrowings SET deleted_at = NULL, deleted_by = NULL WHERE id = ? AND deleted_at IS NOT NULL", [borrowingId]);
  return Number(result.affectedRows);
};

const getAdminBorrowings = async ({ search = "", status, showArchived = false, page = 1, limit = 20, dateFrom, dateTo }) => {
  const offset = (page - 1) * limit;
  const conditions = [`b.deleted_at IS ${showArchived ? "NOT NULL" : "NULL"}`];
  const params = [];
  if (status && status !== "all") { conditions.push("b.status = ?"); params.push(status); }
  if (search.trim()) { conditions.push("(bk.title LIKE ? OR u.name LIKE ? OR u.student_employee_id LIKE ?)"); const like = `%${search.trim()}%`; params.push(like, like, like); }
  if (dateFrom) { conditions.push("DATE(b.borrowed_at) >= ?"); params.push(dateFrom); }
  if (dateTo) { conditions.push("DATE(b.borrowed_at) <= ?"); params.push(dateTo); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM borrowings b JOIN books bk ON bk.id = b.book_id JOIN users u ON u.id = b.user_id ${where}`,
    params,
  );
  const [rows] = await db.query(
    `SELECT b.id, b.status, b.borrowed_at, b.due_date, b.returned_at, b.deleted_at, b.notes,
            COALESCE(b.settled_amount, 0) AS settled_amount, b.settled_at, b.settled_by,
            bk.title AS book_title, bk.author AS book_author, bk.isbn,
            u.name AS user_name, u.student_employee_id, bc.barcode AS copy_barcode,
            CASE WHEN b.copy_id IS NULL THEN 1 ELSE 0 END AS is_legacy,
            issuer.name AS issued_by_name
       FROM borrowings b JOIN books bk ON bk.id = b.book_id JOIN users u ON u.id = b.user_id
       LEFT JOIN book_copies bc ON bc.id = b.copy_id LEFT JOIN users issuer ON issuer.id = b.issued_by
       ${where} ORDER BY b.borrowed_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[summary]] = await db.query(
    `SELECT COUNT(*) AS total_records,
            SUM(CASE WHEN b.status = 'borrowed' THEN 1 ELSE 0 END) AS borrowed_count,
            SUM(CASE WHEN b.status = 'overdue' THEN 1 ELSE 0 END) AS overdue_count,
            SUM(CASE WHEN b.status = 'returned' THEN 1 ELSE 0 END) AS returned_count,
            COUNT(DISTINCT b.user_id) AS unique_borrowers
       FROM borrowings b JOIN books bk ON bk.id = b.book_id JOIN users u ON u.id = b.user_id ${where}`,
    params,
  );
  return { rows, total: Number(total), summary, page, limit };
};

const findUserForPayment = async (studentEmployeeId, conn) => {
  const [[user]] = await conn.query(
    `SELECT id, name, student_employee_id FROM users
      WHERE student_employee_id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
    [studentEmployeeId],
  );
  return user ?? null;
};

const findUserForPaymentOverview = async (studentEmployeeId) => {
  const [[user]] = await db.query(
    `SELECT id, name, role, student_employee_id, is_active
       FROM users
      WHERE student_employee_id = ? AND deleted_at IS NULL
      LIMIT 1`,
    [studentEmployeeId],
  );
  return user ?? null;
};

const findPaymentRows = async (userId, conn) => {
  const [rows] = await conn.query(
    `SELECT b.id, b.user_id, b.status, b.borrowed_at, b.due_date, b.returned_at,
            COALESCE(b.settled_amount, 0) AS settled_amount,
            bk.title AS book_title, bk.author AS book_author, bk.isbn, bc.barcode AS copy_barcode
       FROM borrowings b JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
       LEFT JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
      WHERE b.user_id = ? AND b.deleted_at IS NULL
      ORDER BY COALESCE(b.returned_at, b.due_date) ASC, b.id ASC FOR UPDATE`,
    [userId],
  );
  return rows;
};

const findOverdueCandidates = async (conn = db) => {
  const [rows] = await conn.query(
    `SELECT
       b.id,
       b.user_id,
       b.status,
       b.due_date,
       b.returned_at,
       b.last_overdue_notification_at,
       COALESCE(b.settled_amount, 0) AS settled_amount,
       b.fine_per_hour,
       b.fine_interval,
       b.initial_fine,
       bk.title
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
     WHERE b.deleted_at IS NULL AND b.status IN ('borrowed', 'overdue')`,
  );
  return rows;
};

const markOverdue = (borrowingId, conn = db) => conn.query(
  "UPDATE borrowings SET status = 'overdue' WHERE id = ?",
  [borrowingId],
);

const markOverdueNotificationSent = (borrowingId, conn = db) => conn.query(
  "UPDATE borrowings SET last_overdue_notification_at = NOW() WHERE id = ?",
  [borrowingId],
);

const findBorrowingsForFineDetails = async (userId = null, conn = db) => {
  const params = [];
  const userWhere = userId === null || userId === undefined ? "" : "AND b.user_id = ?";
  if (userId !== null && userId !== undefined) params.push(userId);
  const [rows] = await conn.query(
    `SELECT
       b.id,
       b.user_id,
       b.status,
       b.borrowed_at,
       b.due_date,
       b.returned_at,
       b.last_overdue_notification_at,
       COALESCE(b.settled_amount, 0) AS settled_amount,
       b.settled_at,
       b.settled_by,
       b.fine_per_hour,
       b.fine_interval,
       b.initial_fine,
       b.deleted_at AS borrowing_archived_at,
       u.deleted_at AS patron_archived_at,
       bk.deleted_at AS book_archived_at,
       bc.deleted_at AS copy_archived_at,
       COALESCE(NULLIF(u.name, ''), 'Archived patron') AS user_name,
       u.student_employee_id,
       COALESCE(NULLIF(bk.title, ''), 'Archived or missing book') AS book_title,
       bk.author AS book_author,
       bk.isbn,
       bc.barcode AS copy_barcode
     FROM borrowings b
     LEFT JOIN users u ON u.id = b.user_id
     LEFT JOIN books bk ON bk.id = b.book_id
     LEFT JOIN book_copies bc ON bc.id = b.copy_id
     WHERE 1 = 1 ${userWhere}
     ORDER BY COALESCE(b.returned_at, b.due_date) ASC, b.id ASC`,
    params,
  );
  return rows;
};

module.exports = {
  countBorrowHistory,
  findActiveBorrows,
  findActiveBorrowingByCopyBarcode,
  findReturnPreviewByIdentifier,
  findBorrowHistory,
  findCopyByBarcode,
  findUserByBarcode,
  findUserWithActiveBorrows,
  searchCatalogueWithAvailability,
  getConnection,
  getBorrowingNotificationTarget,
  findBookForBorrow,
  findCopyBookIdentityForBorrow,
  findCopyForBorrow,
  findAvailableCopyForBook,
  countPendingReservationsForBook,
  countAvailableCopiesForBook,
  findReadyHoldByCopy,
  findActiveBorrowingByCopy,
  findActiveBorrowingByUserBook,
  findReadyReservation,
  createBorrowing,
  fulfillReadyReservationAfterCheckout,
  getBorrowingForReturn,
  markReturned,
  getAdminBorrowing,
  lockBorrowingOwner,
  getAdminBorrowingForUpdate,
  getAdminBorrowingAuditSnapshot,
  archiveBorrowing,
  getArchivedBorrowing,
  restoreBorrowing,
  getAdminBorrowings,
  findUserForPayment,
  findUserForPaymentOverview,
  findPaymentRows,
  findOverdueCandidates,
  markOverdue,
  markOverdueNotificationSent,
  findBorrowingsForFineDetails,
};

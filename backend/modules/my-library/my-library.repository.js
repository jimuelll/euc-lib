const db = require("../../db");
const { metadataValue } = require("../catalog/catalog.projection");

async function findUserProfile(userId) {
  const [[user]] = await db.query(
    `SELECT id, name, role, student_employee_id, email, profile_picture, address, contact
     FROM users
     WHERE id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [userId]
  );
  return user ?? null;
}

async function findUserBarcode(userId) {
  const [[user]] = await db.query(
    `SELECT COALESCE(NULLIF(TRIM(barcode), ''), student_employee_id) AS barcode
     FROM users
     WHERE id = ? AND is_active = 1 AND deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );
  return user?.barcode ?? null;
}

async function findActiveBorrows(userId) {
  const [rows] = await db.query(
    `SELECT
       b.id,
       bk.title,
       bk.author,
       ${metadataValue("bk", "category")},
       h.location,
       b.borrowed_at,
       b.due_date,
       b.status,
       b.notes,
       bc.barcode AS copy_barcode
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id
     LEFT JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
     LEFT JOIN copy_holdings h ON h.copy_id = bc.id
     WHERE b.user_id = ?
       AND b.status IN ('borrowed', 'overdue')
       AND b.deleted_at IS NULL
     ORDER BY b.due_date ASC, b.borrowed_at DESC`,
    [userId]
  );
  return rows;
}

async function findBorrowHistory(userId) {
  const [rows] = await db.query(
    `SELECT
       b.id,
       bk.title,
       bk.author,
       b.borrowed_at,
       b.returned_at,
       b.due_date,
       b.status,
       bc.id AS copy_id,
       bc.barcode AS copy_barcode,
       h.accession_number
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id
     LEFT JOIN book_copies bc ON bc.id = b.copy_id
     LEFT JOIN copy_holdings h ON h.copy_id = bc.id
     WHERE b.user_id = ?
       AND b.status = 'returned'
       AND b.deleted_at IS NULL
     ORDER BY b.returned_at DESC
     LIMIT 50`,
    [userId]
  );
  return rows;
}

async function findActiveReservations(userId) {
  const [rows] = await db.query(
    `SELECT
       r.id,
       bk.title,
       bk.author,
       h.location,
       r.status,
       r.reserved_at,
       r.expires_at,
       r.notes
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id
     LEFT JOIN copy_holdings h ON h.copy_id = r.reserved_copy_id
     WHERE r.user_id = ?
       AND r.status IN ('pending', 'ready')
       AND r.deleted_at IS NULL AND (r.expires_at IS NULL OR r.expires_at > NOW())
     ORDER BY r.reserved_at DESC`,
    [userId]
  );
  return rows;
}

async function findReservationHistory(userId) {
  const [rows] = await db.query(
    `SELECT
       r.id,
       bk.title,
       bk.author,
       r.status,
       r.reserved_at,
       r.expires_at,
       r.fulfilled_at,
       r.cancelled_at
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id
     WHERE r.user_id = ?
       AND r.status IN ('cancelled', 'expired', 'fulfilled')
       AND r.deleted_at IS NULL
     ORDER BY r.reserved_at DESC
     LIMIT 50`,
    [userId]
  );
  return rows;
}

async function findAttendanceLogs(userId) {
  const [rows] = await db.query(
    `SELECT id, type, created_at AS timestamp
     FROM attendance_logs
     WHERE user_id = ? AND purpose = 'entry_exit'
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId]
  );
  return rows;
}

async function getHistory(userId, page, limit) {
  const [[{ total }]] = await db.query(
    `SELECT (
       (SELECT COUNT(*) FROM borrowings WHERE user_id = ? AND status = 'returned' AND deleted_at IS NULL) +
       (SELECT COUNT(*) FROM reservations WHERE user_id = ? AND status IN ('cancelled', 'expired', 'fulfilled') AND deleted_at IS NULL)
     ) AS total`,
    [userId, userId]
  );
  const [rows] = await db.query(
    `SELECT * FROM (
       SELECT b.id, bk.title, bk.author, 'borrowing' AS kind, b.status,
              b.returned_at AS occurred_at, b.borrowed_at, b.returned_at, NULL AS reserved_at,
              bc.id AS copy_id, bc.barcode AS copy_barcode, h.accession_number
       FROM borrowings b
       JOIN books bk ON bk.id = b.book_id
       LEFT JOIN book_copies bc ON bc.id = b.copy_id
       LEFT JOIN copy_holdings h ON h.copy_id = bc.id
       WHERE b.user_id = ? AND b.status = 'returned' AND b.deleted_at IS NULL
       UNION ALL
       SELECT r.id, bk.title, bk.author, 'reservation' AS kind, r.status,
              COALESCE(r.fulfilled_at, r.cancelled_at, r.reserved_at) AS occurred_at,
              NULL AS borrowed_at, NULL AS returned_at, r.reserved_at,
              NULL AS copy_id, NULL AS copy_barcode, NULL AS accession_number
       FROM reservations r
       JOIN books bk ON bk.id = r.book_id
       WHERE r.user_id = ? AND r.status IN ('cancelled', 'expired', 'fulfilled') AND r.deleted_at IS NULL
     ) AS history
     ORDER BY occurred_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [userId, userId, limit, (page - 1) * limit]
  );
  return { rows, total: Number(total) };
}

async function findAllAttendanceLogs(userId) {
  const [rows] = await db.query(
    `SELECT id, type, created_at AS timestamp
     FROM attendance_logs
     WHERE user_id = ? AND purpose = 'entry_exit'
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

module.exports = {
  findUserProfile,
  findUserBarcode,
  findActiveBorrows,
  findBorrowHistory,
  findActiveReservations,
  findReservationHistory,
  findAttendanceLogs,
  getHistory,
  findAllAttendanceLogs,
};

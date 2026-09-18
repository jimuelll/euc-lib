const db = require("../../db");
const { catalogDisplayColumns } = require("../catalog/catalog.projection");

const findActiveBorrows = async (userId) => {
  const [rows] = await db.query(
    `SELECT b.id, bk.title, bk.author,
            b.borrowed_at, b.due_date, b.returned_at, b.status, b.notes,
            COALESCE(b.settled_amount, 0) AS settled_amount,
            bc.barcode AS copy_barcode, bc.condition AS copy_condition
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id
     LEFT JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
     WHERE b.user_id = ? AND b.status IN ('borrowed', 'overdue')
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
            bc.barcode AS copy_barcode
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id
     LEFT JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
     WHERE b.user_id = ? AND b.status = 'returned'
     ORDER BY b.returned_at DESC${paged ? " LIMIT ? OFFSET ?" : " LIMIT 50"}`,
    paged ? [userId, limit, offset] : [userId],
  );
  return rows;
};

const searchCatalogueWithAvailability = async (query) => {
  const like = `%${query}%`;
  const [rows] = await db.query(
    `SELECT
       bk.id, bk.title, bk.author,
       ${catalogDisplayColumns("bk", ["category", "location"])},
       bk.isbn, bk.copies, bk.material_type,
       TRUE AS canBorrow, TRUE AS canReserve,
       COUNT(DISTINCT bc.id) AS total_copies,
       GREATEST(0, COUNT(DISTINCT bc.id) - COUNT(DISTINCT CASE
         WHEN br.status IN ('borrowed','overdue') OR rr.id IS NOT NULL THEN bc.id
       END)) AS available
     FROM books bk
     LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.condition IN ('good', 'damaged') AND bc.deleted_at IS NULL
     LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.status IN ('borrowed','overdue')
     LEFT JOIN reservations rr ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL
     WHERE bk.deleted_at IS NULL AND bk.material_type = 'book'
       AND (bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ?)
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

const findCopyByBarcode = async (barcode) => {
  const [[copy]] = await db.query(
    `SELECT bc.id, bc.book_id, bc.barcode, bc.condition, bc.is_active,
            bk.title, bk.author, bk.copies,
            EXISTS(SELECT 1 FROM reservations r
              WHERE r.reserved_copy_id = bc.id AND r.status = 'ready' AND r.deleted_at IS NULL) AS is_reserved
     FROM book_copies bc
     JOIN books bk ON bk.id = bc.book_id AND bk.deleted_at IS NULL
     WHERE bc.barcode = ? AND bc.deleted_at IS NULL`,
    [barcode],
  );
  return copy ?? null;
};

const findActiveBorrowingByCopyBarcode = async (barcode) => {
  const [[row]] = await db.query(
    `SELECT b.id, b.user_id
     FROM borrowings b
     JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
     WHERE bc.barcode = ? AND b.status IN ('borrowed','overdue')
     LIMIT 1`,
    [barcode.trim()],
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
    `SELECT b.id, b.book_id, bk.title, bk.author, b.due_date, b.status,
            COALESCE(b.settled_amount, 0) AS settled_amount
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
     WHERE b.user_id = ? AND b.status IN ('borrowed', 'overdue')
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
       JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
      WHERE b.id = ?
      LIMIT 1`,
    [borrowingId],
  );
  return row ?? null;
};

const findBookForBorrow = async (bookId, conn) => {
  const [[book]] = await conn.query(
    `SELECT bk.id, bk.copies, bk.material_type,
            bt.default_borrow_days, bt.fine_per_hour, bt.fine_interval, bt.initial_fine
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
    `SELECT bc.id, bc.book_id, bc.barcode, bc.condition, bc.is_active,
            bk.copies, bk.material_type, bt.default_borrow_days,
            bt.fine_per_hour, bt.fine_interval, bt.initial_fine
       FROM book_copies bc
       JOIN books bk ON bk.id = bc.book_id AND bk.deleted_at IS NULL
       JOIN book_types bt ON bt.id = bk.book_type_id AND bt.is_active = 1
      WHERE bc.barcode = ? AND bc.deleted_at IS NULL
      FOR UPDATE`,
    [barcode],
  );
  return copy ?? null;
};

const findAvailableCopyForBook = async (bookId, conn) => {
  const [[copy]] = await conn.query(
    `SELECT bc.id, bc.barcode, bc.condition
       FROM book_copies bc
      WHERE bc.book_id = ?
        AND bc.is_active = 1
        AND bc.condition IN ('good', 'damaged')
        AND bc.deleted_at IS NULL
        AND bc.id NOT IN (
          SELECT copy_id FROM borrowings WHERE status IN ('borrowed','overdue') AND copy_id IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM reservations r
           WHERE r.reserved_copy_id = bc.id AND r.status = 'ready' AND r.deleted_at IS NULL
        )
      ORDER BY bc.condition = 'good' DESC, bc.id ASC
      LIMIT 1 FOR UPDATE`,
    [bookId],
  );
  return copy ?? null;
};

const findReadyHoldByCopy = async (copyId, conn) => {
  const [[row]] = await conn.query(
    "SELECT id FROM reservations WHERE reserved_copy_id = ? AND status = 'ready' AND deleted_at IS NULL FOR UPDATE",
    [copyId],
  );
  return row ?? null;
};

const findActiveBorrowingByCopy = async (copyId, conn) => {
  const [[row]] = await conn.query(
    "SELECT id FROM borrowings WHERE copy_id = ? AND status IN ('borrowed','overdue') FOR UPDATE",
    [copyId],
  );
  return row ?? null;
};

const findActiveBorrowingByUserBook = async (userId, bookId, conn) => {
  const [[row]] = await conn.query(
    "SELECT id FROM borrowings WHERE user_id = ? AND book_id = ? AND status IN ('borrowed','overdue') FOR UPDATE",
    [userId, bookId],
  );
  return row ?? null;
};

const findReadyReservation = async (reservationId, userId, bookId, conn) => {
  const [[row]] = await conn.query(
    `SELECT id, reserved_copy_id FROM reservations
      WHERE id = ? AND user_id = ? AND book_id = ?
        AND status = 'ready' AND deleted_at IS NULL FOR UPDATE`,
    [reservationId, userId, bookId],
  );
  return row ?? null;
};

const createBorrowing = async ({ userId, bookId, copyId, dueDate, finePerHour, fineInterval, initialFine, issuedBy }, conn) => {
  const [result] = await conn.query(
    `INSERT INTO borrowings (user_id, book_id, copy_id, due_date, fine_per_hour, fine_interval, initial_fine, status, issued_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'borrowed', ?)`,
    [userId, bookId, copyId, dueDate, finePerHour, fineInterval, initialFine, issuedBy ?? null],
  );
  return result.insertId;
};

const fulfillReservation = async (reservationId, conn) => {
  await conn.query("UPDATE reservations SET status = 'fulfilled', fulfilled_at = NOW() WHERE id = ?", [reservationId]);
};

const getBorrowingForReturn = async (borrowingId, conn) => {
  const [[row]] = await conn.query("SELECT b.id, b.user_id, b.status FROM borrowings b WHERE b.id = ? FOR UPDATE", [borrowingId]);
  return row ?? null;
};

const markReturned = async (borrowingId, conn) => {
  await conn.query("UPDATE borrowings SET status = 'returned', returned_at = NOW() WHERE id = ?", [borrowingId]);
};

const getAdminBorrowing = async (borrowingId) => {
  const [[row]] = await db.query("SELECT id, status FROM borrowings WHERE id = ? AND deleted_at IS NULL", [borrowingId]);
  return row ?? null;
};

const archiveBorrowing = (borrowingId, deletedBy) => db.query("UPDATE borrowings SET deleted_at = NOW(), deleted_by = ? WHERE id = ?", [deletedBy, borrowingId]);

const getArchivedBorrowing = async (borrowingId) => {
  const [[row]] = await db.query("SELECT id FROM borrowings WHERE id = ? AND deleted_at IS NOT NULL", [borrowingId]);
  return row ?? null;
};

const restoreBorrowing = (borrowingId) => db.query("UPDATE borrowings SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", [borrowingId]);

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

const updateSettledAmount = (borrowingId, amount, settledBy, conn) => conn.query(
  "UPDATE borrowings SET settled_amount = ?, settled_at = NOW(), settled_by = ? WHERE id = ?",
  [amount, settledBy ?? null, borrowingId],
);

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
       u.name AS user_name,
       u.student_employee_id,
       bk.title AS book_title,
       bk.author AS book_author,
       bk.isbn,
       bc.barcode AS copy_barcode
     FROM borrowings b
     JOIN users u ON u.id = b.user_id AND u.deleted_at IS NULL
     JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
     LEFT JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
     WHERE b.deleted_at IS NULL ${userWhere}
     ORDER BY COALESCE(b.returned_at, b.due_date) ASC, b.id ASC`,
    params,
  );
  return rows;
};

module.exports = {
  countBorrowHistory,
  findActiveBorrows,
  findActiveBorrowingByCopyBarcode,
  findBorrowHistory,
  findCopyByBarcode,
  findUserByBarcode,
  findUserWithActiveBorrows,
  searchCatalogueWithAvailability,
  getConnection,
  getBorrowingNotificationTarget,
  findBookForBorrow,
  findCopyForBorrow,
  findAvailableCopyForBook,
  findReadyHoldByCopy,
  findActiveBorrowingByCopy,
  findActiveBorrowingByUserBook,
  findReadyReservation,
  createBorrowing,
  fulfillReservation,
  getBorrowingForReturn,
  markReturned,
  getAdminBorrowing,
  archiveBorrowing,
  getArchivedBorrowing,
  restoreBorrowing,
  getAdminBorrowings,
  findUserForPayment,
  findUserForPaymentOverview,
  findPaymentRows,
  updateSettledAmount,
  findOverdueCandidates,
  markOverdue,
  markOverdueNotificationSent,
  findBorrowingsForFineDetails,
};

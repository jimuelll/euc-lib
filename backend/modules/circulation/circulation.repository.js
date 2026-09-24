const db = require("../../db");
const { activeLendableCopy, hasAccession, availableToBorrow, hasActiveBookPolicy } = require("../catalog/copyEligibility");

const getConnection = () => db.getConnection();

const findUser = async (studentEmployeeId) => {
  const [[user]] = await db.query(
    `SELECT id, name, student_employee_id, role, is_active
       FROM users
      WHERE student_employee_id = ? AND deleted_at IS NULL`,
    [studentEmployeeId],
  );
  return user ?? null;
};

const findActiveBorrows = async (userId) => {
  const [rows] = await db.query(
    `SELECT b.id, bk.title, bk.author, b.due_date, b.status
       FROM borrowings b
       JOIN books bk ON bk.id = b.book_id
      WHERE b.user_id = ? AND b.deleted_at IS NULL AND b.status IN ('borrowed', 'overdue')
      ORDER BY b.due_date ASC`,
    [userId],
  );
  return rows;
};

const findBookByIsbn = async (isbn) => {
  const [[book]] = await db.query(
    `SELECT bk.id, bk.title, bk.author, bk.isbn, bk.copies, bk.material_type,
            CASE WHEN bk.material_type = 'book' AND ${hasActiveBookPolicy("bk")} AND EXISTS (SELECT 1 FROM book_copies reserve_copy WHERE reserve_copy.book_id = bk.id AND ${activeLendableCopy("reserve_copy")} AND ${hasAccession("reserve_copy", "reserve_h")}) THEN TRUE ELSE FALSE END AS canReserve,
            CASE WHEN bk.material_type = 'book' AND EXISTS (SELECT 1 FROM book_copies borrow_copy WHERE borrow_copy.book_id = bk.id AND ${availableToBorrow("borrow_copy")}) THEN TRUE ELSE FALSE END AS canBorrow,
            (SELECT COUNT(*) FROM book_copies eligible WHERE eligible.book_id = bk.id AND ${availableToBorrow("eligible")}) AS available
       FROM books bk
      WHERE bk.isbn = ? AND bk.deleted_at IS NULL
      GROUP BY bk.id`,
    [isbn],
  );
  return book ?? null;
};

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

const getBorrowingForReturn = async (borrowingId, conn) => {
  const [[row]] = await conn.query(
    `SELECT b.id, b.status, b.user_id, b.book_id, b.copy_id, b.due_date, b.returned_at,
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

const getBorrowingForRenewal = async (borrowingId, conn) => {
  const [[row]] = await conn.query(
    `SELECT b.id, b.user_id, b.status, b.due_date, b.loan_duration_minutes,
            b.loan_duration_unit, bk.title, (bt.id IS NOT NULL) AS has_active_policy
       FROM borrowings b
       JOIN books bk ON bk.id = b.book_id
       LEFT JOIN book_types bt ON bt.id = bk.book_type_id AND bt.is_active = 1
      WHERE b.id = ? AND b.deleted_at IS NULL
      FOR UPDATE`,
    [borrowingId],
  );
  return row ?? null;
};

const renewBorrowing = async (borrowingId, dueDate, conn) => {
  const [result] = await conn.query(
    "UPDATE borrowings SET due_date = ?, status = 'borrowed' WHERE id = ? AND deleted_at IS NULL AND status IN ('borrowed', 'overdue')",
    [dueDate, borrowingId],
  );
  return result.affectedRows;
};

const getCirculationLog = async ({ status = "", search = "", page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  if (status && ["borrowed", "overdue", "returned"].includes(status)) { conditions.push("b.status = ?"); params.push(status); }
  if (search.trim()) {
    conditions.push("(u.name LIKE ? OR u.student_employee_id LIKE ? OR bk.title LIKE ? OR bk.isbn LIKE ?)");
    const like = `%${search.trim()}%`;
    params.push(like, like, like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
       FROM borrowings b
       JOIN users u ON u.id = b.user_id
       JOIN books bk ON bk.id = b.book_id
       ${where}`,
    params,
  );
  const [rows] = await db.query(
    `SELECT b.id, u.name AS user_name, u.student_employee_id,
            bk.title AS book_title, bk.author AS book_author, bk.isbn,
            b.borrowed_at, b.due_date, b.returned_at, b.status,
            iss.name AS issued_by_name
       FROM borrowings b
       JOIN users u ON u.id = b.user_id
       JOIN books bk ON bk.id = b.book_id
       LEFT JOIN users iss ON iss.id = b.issued_by
       ${where}
      ORDER BY b.borrowed_at DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return { rows, total: Number(total) };
};

module.exports = {
  getConnection,
  findUser,
  findActiveBorrows,
  findBookByIsbn,
  getBorrowingNotificationTarget,
  getBorrowingForReturn,
  markReturned,
  getBorrowingForRenewal,
  renewBorrowing,
  getCirculationLog,
};

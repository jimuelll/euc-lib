const db = require("../../db");

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
      WHERE b.user_id = ? AND b.status IN ('borrowed', 'overdue')
      ORDER BY b.due_date ASC`,
    [userId],
  );
  return rows;
};

const findBookByIsbn = async (isbn) => {
  const [[book]] = await db.query(
    `SELECT bk.id, bk.title, bk.author, bk.isbn, bk.copies, bk.material_type,
            CASE WHEN bk.material_type = 'book' THEN TRUE ELSE FALSE END AS canBorrow,
            CASE WHEN bk.material_type = 'book' THEN TRUE ELSE FALSE END AS canReserve,
            COUNT(DISTINCT bc.id) - COUNT(DISTINCT CASE WHEN br.id IS NOT NULL OR rr.id IS NOT NULL THEN bc.id END) AS available
       FROM books bk
       LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.condition IN ('good', 'damaged') AND bc.deleted_at IS NULL
       LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.status IN ('borrowed', 'overdue')
       LEFT JOIN reservations rr ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL
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
       JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
      WHERE b.id = ?
      LIMIT 1`,
    [borrowingId],
  );
  return row ?? null;
};

const getBorrowingForReturn = async (borrowingId, conn) => {
  const [[row]] = await conn.query("SELECT id, status, user_id FROM borrowings WHERE id = ? FOR UPDATE", [borrowingId]);
  return row ?? null;
};

const markReturned = (borrowingId, conn) => conn.query("UPDATE borrowings SET status = 'returned', returned_at = NOW() WHERE id = ?", [borrowingId]);

const getBorrowingForRenewal = async (borrowingId) => {
  const [[row]] = await db.query(
    `SELECT b.id, b.status, bt.default_borrow_days
       FROM borrowings b
       JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
       JOIN book_types bt ON bt.id = bk.book_type_id AND bt.is_active = 1
      WHERE b.id = ?`,
    [borrowingId],
  );
  return row ?? null;
};

const renewBorrowing = (borrowingId, dueDate) => db.query("UPDATE borrowings SET due_date = ?, status = 'borrowed' WHERE id = ?", [dueDate, borrowingId]);

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

const db = require("../../db");
const { syncOverdueBorrowings } = require("../borrowing/overdue.helper");

const lookupUser = async (studentEmployeeId) => {
  const [[user]] = await db.query(
    `SELECT id, name, student_employee_id, role, is_active
     FROM users WHERE student_employee_id = ? AND deleted_at IS NULL`,
    [studentEmployeeId.trim()]
  );

  if (!user) {
    throw Object.assign(new Error("User not found"), { status: 404 });
  }
  if (!user.is_active) {
    throw Object.assign(new Error("User account is inactive"), { status: 403 });
  }

  await syncOverdueBorrowings();

  const [activeBorrows] = await db.query(
    `SELECT b.id, bk.title, bk.author, b.due_date, b.status
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id
     WHERE b.user_id = ? AND b.status IN ('borrowed', 'overdue')
     ORDER BY b.due_date ASC`,
    [user.id]
  );

  return { user, activeBorrows };
};

const lookupBook = async (isbn) => {
  const [[book]] = await db.query(
    `SELECT
       bk.id, bk.title, bk.author, bk.isbn, bk.copies,
       GREATEST(0, bk.copies - COUNT(br.id)) AS available
     FROM books bk
     LEFT JOIN borrowings br
       ON br.book_id = bk.id AND br.status IN ('borrowed', 'overdue')
     WHERE bk.isbn = ? AND bk.deleted_at IS NULL
     GROUP BY bk.id`,
    [isbn.trim()]
  );

  if (!book) {
    throw Object.assign(new Error("Book not found"), { status: 404 });
  }

  return book;
};

const processBorrow = async ({ userId, bookId, dueDate, issuedBy }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[book]] = await conn.query(
      "SELECT id, copies FROM books WHERE id = ? FOR UPDATE",
      [bookId]
    );
    if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });

    const [[{ borrowed_count }]] = await conn.query(
      `SELECT COUNT(*) AS borrowed_count FROM borrowings
       WHERE book_id = ? AND status IN ('borrowed', 'overdue')`,
      [bookId]
    );
    if (borrowed_count >= book.copies) {
      throw Object.assign(new Error("No copies available"), { status: 409 });
    }

    const [[existing]] = await conn.query(
      `SELECT id FROM borrowings
       WHERE user_id = ? AND book_id = ? AND status IN ('borrowed', 'overdue')`,
      [userId, bookId]
    );
    if (existing) {
      throw Object.assign(new Error("User already has this book borrowed"), { status: 409 });
    }

    const [result] = await conn.query(
      `INSERT INTO borrowings (user_id, book_id, due_date, status, issued_by)
       VALUES (?, ?, ?, 'borrowed', ?)`,
      [userId, bookId, dueDate, issuedBy]
    );

    await conn.commit();
    return { message: "Book borrowed successfully", borrowingId: result.insertId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const processReturn = async (borrowingId) => {
  const [[row]] = await db.query(
    "SELECT id, status FROM borrowings WHERE id = ?",
    [borrowingId]
  );
  if (!row) throw Object.assign(new Error("Borrowing record not found"), { status: 404 });
  if (row.status === "returned") {
    throw Object.assign(new Error("Book already returned"), { status: 409 });
  }

  await db.query(
    `UPDATE borrowings SET status = 'returned', returned_at = NOW() WHERE id = ?`,
    [borrowingId]
  );
};

const processRenew = async ({ borrowingId, dueDate }) => {
  const [[row]] = await db.query(
    "SELECT id, status FROM borrowings WHERE id = ?",
    [borrowingId]
  );
  if (!row) throw Object.assign(new Error("Borrowing record not found"), { status: 404 });
  if (row.status === "returned") {
    throw Object.assign(new Error("Cannot renew a returned book"), { status: 409 });
  }

  await db.query(
    `UPDATE borrowings SET due_date = ?, status = 'borrowed' WHERE id = ?`,
    [dueDate, borrowingId]
  );

  return { message: "Book renewed successfully", dueDate };
};

const getCirculationLog = async ({ status = "", search = "", page = 1, limit = 20 }) => {
  await syncOverdueBorrowings();

  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (status && ["borrowed", "overdue", "returned"].includes(status)) {
    conditions.push("b.status = ?");
    params.push(status);
  }

  if (search.trim()) {
    conditions.push(
      `(u.name LIKE ? OR u.student_employee_id LIKE ? OR bk.title LIKE ? OR bk.isbn LIKE ?)`
    );
    const like = `%${search.trim()}%`;
    params.push(like, like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM borrowings b
     JOIN users u  ON u.id  = b.user_id
     JOIN books bk ON bk.id = b.book_id
     ${where}`,
    params
  );

  const [rows] = await db.query(
    `SELECT
       b.id,
       u.name               AS user_name,
       u.student_employee_id,
       bk.title             AS book_title,
       bk.author            AS book_author,
       bk.isbn,
       b.borrowed_at,
       b.due_date,
       b.returned_at,
       b.status,
       iss.name             AS issued_by_name
     FROM borrowings b
     JOIN users u  ON u.id  = b.user_id
     JOIN books bk ON bk.id = b.book_id
     LEFT JOIN users iss ON iss.id = b.issued_by
     ${where}
     ORDER BY b.borrowed_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    rows,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

module.exports = {
  lookupUser,
  lookupBook,
  processBorrow,
  processReturn,
  processRenew,
  getCirculationLog,
};

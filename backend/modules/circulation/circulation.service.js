const db = require("../../db");
const { calculateDueDateWithHolidays, syncOverdueBorrowings } = require("../borrowing/overdue.helper");
const notificationsService = require("../notifications/notifications.service");
const { getClearanceProfile, assertEligible } = require("../clearance/clearance.service");

const getBorrowingNotificationTarget = async (borrowingId, conn = db) => {
  const [[row]] = await conn.query(
    `SELECT
       b.id,
       b.user_id,
       bk.title
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
     WHERE b.id = ?
     LIMIT 1`,
    [borrowingId]
  );

  return row ?? null;
};

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

  const clearance = await getClearanceProfile(studentEmployeeId);
  return { user, activeBorrows, clearance };
};

const lookupBook = async (isbn) => {
  const [[book]] = await db.query(
    `SELECT
       bk.id, bk.title, bk.author, bk.isbn, bk.copies,
       COUNT(DISTINCT bc.id) - COUNT(DISTINCT br.id) AS available
     FROM books bk
     LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.condition IN ('good', 'damaged') AND bc.deleted_at IS NULL
     LEFT JOIN borrowings br ON br.copy_id = bc.id AND br.status IN ('borrowed', 'overdue')
     WHERE bk.isbn = ? AND bk.deleted_at IS NULL
     GROUP BY bk.id`,
    [isbn.trim()]
  );

  if (!book) {
    throw Object.assign(new Error("Book not found"), { status: 404 });
  }

  return book;
};

const processBorrow = async ({ userId, bookId, issuedBy }) => {
  await syncOverdueBorrowings();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await assertEligible(userId, conn);

    const [[book]] = await conn.query(
      `SELECT bk.id, bk.material_type, bt.default_borrow_days, bt.fine_per_hour, bt.fine_interval, bt.initial_fine
       FROM books bk
       JOIN book_types bt ON bt.id = bk.book_type_id AND bt.is_active = 1
       WHERE bk.id = ? AND bk.deleted_at IS NULL
       FOR UPDATE`,
      [bookId]
    );
    if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });
    if (book.material_type === "thesis") throw Object.assign(new Error("Theses are reference-only and cannot be borrowed"), { status: 409 });

    const [[existing]] = await conn.query(
      `SELECT id FROM borrowings
       WHERE user_id = ? AND book_id = ? AND status IN ('borrowed', 'overdue')`,
      [userId, bookId]
    );
    if (existing) {
      throw Object.assign(new Error("User already has this book borrowed"), { status: 409 });
    }

    const [[copy]] = await conn.query(
      `SELECT bc.id, bc.barcode, bc.condition
       FROM book_copies bc
       WHERE bc.book_id = ? AND bc.is_active = 1 AND bc.condition IN ('good', 'damaged') AND bc.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM borrowings b WHERE b.copy_id = bc.id AND b.status IN ('borrowed', 'overdue'))
       ORDER BY bc.condition = 'good' DESC, bc.id ASC
       LIMIT 1 FOR UPDATE`,
      [bookId]
    );
    if (!copy) throw Object.assign(new Error("No borrowable copies are available"), { status: 409 });

    const policyDays = Math.max(1, Number.parseInt(book.default_borrow_days, 10) || 7);
    const dueDate = await calculateDueDateWithHolidays(new Date(), policyDays, conn);

    const [result] = await conn.query(
      `INSERT INTO borrowings (user_id, book_id, copy_id, due_date, fine_per_hour, fine_interval, initial_fine, status, issued_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'borrowed', ?)`,
      [userId, bookId, copy.id, dueDate, book.fine_per_hour, book.fine_interval, book.initial_fine, issuedBy]
    );

    await conn.commit();

    const target = await getBorrowingNotificationTarget(result.insertId);
    if (target) {
      await notificationsService.createNotification({
        type: "borrowing_created",
        title: "Book borrowed successfully",
        body: `You borrowed "${target.title}". Please return it on or before ${new Date(dueDate).toLocaleString("en-PH", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}.`,
        href: "/my-library",
        audienceType: "user",
        audienceUserId: target.user_id,
        createdBy: issuedBy ?? null,
      });
    }

    return { message: "Book borrowed successfully", borrowingId: result.insertId, barcode: copy.barcode, dueDate, warning: copy.condition === "damaged" ? "This copy is marked damaged; please handle it with care." : null };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const processReturn = async (borrowingId) => {
  const [[row]] = await db.query(
    "SELECT id, status, user_id FROM borrowings WHERE id = ?",
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

  const target = await getBorrowingNotificationTarget(borrowingId);
  if (target) {
    await notificationsService.createNotification({
      type: "borrowing_returned",
      title: "Book return recorded",
      body: `Your return for "${target.title}" has been recorded successfully.`,
      href: "/my-library",
      audienceType: "user",
      audienceUserId: target.user_id,
      createdBy: null,
    });
  }
};

const processRenew = async ({ borrowingId, renewedBy = null }) => {
  const [[row]] = await db.query(
    `SELECT b.id, b.status, bt.default_borrow_days
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
     JOIN book_types bt ON bt.id = bk.book_type_id AND bt.is_active = 1
     WHERE b.id = ?`,
    [borrowingId]
  );
  if (!row) throw Object.assign(new Error("Borrowing record not found"), { status: 404 });
  if (row.status === "returned") {
    throw Object.assign(new Error("Cannot renew a returned book"), { status: 409 });
  }

  const policyDays = Math.max(1, Number.parseInt(row.default_borrow_days, 10) || 7);
  const dueDate = await calculateDueDateWithHolidays(new Date(), policyDays);

  await db.query(
    `UPDATE borrowings SET due_date = ?, status = 'borrowed' WHERE id = ?`,
    [dueDate, borrowingId]
  );

  const target = await getBorrowingNotificationTarget(borrowingId);
  if (target) {
    await notificationsService.createNotification({
      type: "borrowing_renewed",
      title: "Book renewal recorded",
      body: `Your borrowing for "${target.title}" has been renewed. New due date: ${new Date(dueDate).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}.`,
      href: "/my-library",
      audienceType: "user",
      audienceUserId: target.user_id,
        createdBy: renewedBy,
    });
  }

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

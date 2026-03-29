const db = require("../../db");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const syncOverdue = async () => {
  await db.query(
    `UPDATE borrowings
     SET status = 'overdue'
     WHERE status = 'borrowed'
       AND due_date < CURDATE()`
  );
};

const borrowedCopies = async (bookId, conn = db) => {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM borrowings
     WHERE book_id = ? AND status IN ('borrowed', 'overdue')`,
    [bookId]
  );
  return rows[0].cnt;
};

// ─── Reads ────────────────────────────────────────────────────────────────────

const getActiveBorrows = async (userId) => {
  await syncOverdue();
  const [rows] = await db.query(
    `SELECT b.id, bk.title, bk.author,
            b.borrowed_at, b.due_date, b.status, b.notes,
            bc.barcode AS copy_barcode, bc.condition AS copy_condition
     FROM borrowings b
     JOIN books bk      ON bk.id = b.book_id AND bk.deleted_at IS NULL
     LEFT JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
     WHERE b.user_id = ? AND b.status IN ('borrowed', 'overdue')
     ORDER BY b.due_date ASC`,
    [userId]
  );
  return rows;
};

const getBorrowHistory = async (userId) => {
  const [rows] = await db.query(
    `SELECT b.id, bk.title, bk.author,
            b.borrowed_at, b.returned_at, b.due_date, b.status,
            bc.barcode AS copy_barcode
     FROM borrowings b
     JOIN books bk      ON bk.id = b.book_id AND bk.deleted_at IS NULL
     LEFT JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
     WHERE b.user_id = ? AND b.status = 'returned'
     ORDER BY b.returned_at DESC
     LIMIT 50`,
    [userId]
  );
  return rows;
};

/**
 * Catalogue search — includes live availability calculated from book_copies.
 */
const searchCatalogueWithAvailability = async (query) => {
  await syncOverdue();
  const like = `%${query}%`;
  const [rows] = await db.query(
    `SELECT
       bk.id,
       bk.title,
       bk.author,
       bk.category,
       bk.isbn,
       bk.copies,
       bk.location,
       COUNT(DISTINCT bc.id)                                      AS total_copies,
       GREATEST(0,
         COUNT(DISTINCT bc.id) -
         COUNT(DISTINCT CASE
           WHEN br.status IN ('borrowed','overdue') THEN br.id
         END)
       )                                                           AS available
     FROM books bk
     LEFT JOIN book_copies  bc ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.deleted_at IS NULL
     LEFT JOIN borrowings   br ON br.copy_id  = bc.id
                               AND br.status IN ('borrowed','overdue')
     WHERE bk.deleted_at IS NULL
       AND (bk.title  LIKE ?
        OR bk.author LIKE ?
        OR bk.isbn   LIKE ?)
     GROUP BY bk.id
     ORDER BY bk.title ASC
     LIMIT 50`,
    [like, like, like]
  );
  return rows;
};

/**
 * Look up a user by their barcode or student_employee_id.
 */
const resolveUserByBarcode = async (scannedValue) => {
  const [[user]] = await db.query(
    `SELECT id, name, role, student_employee_id, barcode
     FROM users
     WHERE (barcode = ? OR student_employee_id = ?)
       AND deleted_at IS NULL
     LIMIT 1`,
    [scannedValue, scannedValue]
  );
  return user ?? null;
};

/**
 * Look up a book copy by its barcode.
 */
const resolveCopyByBarcode = async (barcode) => {
  const [[copy]] = await db.query(
    `SELECT bc.id, bc.book_id, bc.barcode, bc.condition, bc.is_active,
            bk.title, bk.author, bk.copies
     FROM book_copies bc
     JOIN books bk ON bk.id = bc.book_id AND bk.deleted_at IS NULL
     WHERE bc.barcode = ? AND bc.deleted_at IS NULL`,
    [barcode]
  );
  return copy ?? null;
};

/**
 * Find the active borrowing record for a given copy barcode.
 */
const getActiveBorrowingByCopyBarcode = async (barcode) => {
  const [[row]] = await db.query(
    `SELECT b.id, b.user_id
     FROM borrowings b
     JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
     WHERE bc.barcode = ? AND b.status IN ('borrowed','overdue')
     LIMIT 1`,
    [barcode.trim()]
  );
  return row ?? null;
};

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Issue a borrow by scanning a copy barcode.
 * Accepts either a copy barcode string OR a numeric copyId.
 */
const borrowBook = async (
  userId,
  bookIdOrCopyBarcode,
  issuedBy,
  daysAllowed = 7,
  { isCopyBarcode = false, ipAddress = null } = {}
) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let copy = null;

    if (isCopyBarcode) {
      const [[c]] = await conn.query(
        `SELECT bc.id, bc.book_id, bc.barcode, bc.is_active,
                bk.copies
         FROM book_copies bc
         JOIN books bk ON bk.id = bc.book_id AND bk.deleted_at IS NULL
         WHERE bc.barcode = ? AND bc.deleted_at IS NULL
         FOR UPDATE`,
        [bookIdOrCopyBarcode]
      );
      if (!c) throw Object.assign(new Error("Copy barcode not found"), { status: 404 });
      if (!c.is_active) throw Object.assign(new Error("This copy is not available"), { status: 409 });
      copy = c;
    } else {
      const [[book]] = await conn.query(
        "SELECT id, copies FROM books WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
        [bookIdOrCopyBarcode]
      );
      if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });

      const [copies] = await conn.query(
        `SELECT bc.id, bc.barcode FROM book_copies bc
         WHERE bc.book_id = ? AND bc.is_active = 1 AND bc.deleted_at IS NULL
           AND bc.id NOT IN (
             SELECT copy_id FROM borrowings
             WHERE status IN ('borrowed','overdue') AND copy_id IS NOT NULL
           )
         LIMIT 1`,
        [bookIdOrCopyBarcode]
      );
      if (!copies.length) {
        throw Object.assign(new Error("No copies available"), { status: 409 });
      }
      copy = { ...copies[0], book_id: bookIdOrCopyBarcode };
    }

    const [[activeLoan]] = await conn.query(
      `SELECT id FROM borrowings
       WHERE copy_id = ? AND status IN ('borrowed','overdue')`,
      [copy.id]
    );
    if (activeLoan) {
      throw Object.assign(new Error("This copy is already borrowed"), { status: 409 });
    }

    const [[existing]] = await conn.query(
      `SELECT id FROM borrowings
       WHERE user_id = ? AND book_id = ? AND status IN ('borrowed','overdue')`,
      [userId, copy.book_id]
    );
    if (existing) {
      throw Object.assign(new Error("User already has this book borrowed"), { status: 409 });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysAllowed);
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    const [result] = await conn.query(
      `INSERT INTO borrowings (user_id, book_id, copy_id, due_date, status, issued_by)
       VALUES (?, ?, ?, ?, 'borrowed', ?)`,
      [userId, copy.book_id, copy.id, dueDateStr, issuedBy ?? null]
    );

    const borrowingId = result.insertId;

    await conn.commit();
    return { borrowingId, copyId: copy.id, barcode: copy.barcode, dueDate: dueDateStr };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Return a book.
 */
const returnBook = async (borrowingId, userId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[row]] = await conn.query(
      `SELECT b.id, b.user_id, b.status
       FROM borrowings b
       WHERE b.id = ? FOR UPDATE`,
      [borrowingId]
    );
    if (!row) throw Object.assign(new Error("Borrowing record not found"), { status: 404 });
    if (row.user_id !== userId) throw Object.assign(new Error("Forbidden"), { status: 403 });
    if (row.status === "returned") {
      throw Object.assign(new Error("Book already returned"), { status: 409 });
    }

    await conn.query(
      `UPDATE borrowings
       SET status = 'returned', returned_at = NOW()
       WHERE id = ?`,
      [borrowingId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const lookupUserWithBorrows = async (studentEmployeeId) => {
  const [[user]] = await db.query(
    `SELECT id, name, role, student_employee_id, barcode
     FROM users
     WHERE student_employee_id = ? AND is_active = 1 AND deleted_at IS NULL
     LIMIT 1`,
    [studentEmployeeId]
  );
  if (!user) return null;

  const [activeBorrows] = await db.query(
    `SELECT b.id, b.book_id, bk.title, bk.author, b.due_date, b.status
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
     WHERE b.user_id = ? AND b.status IN ('borrowed', 'overdue')
     ORDER BY b.due_date ASC`,
    [user.id]
  );

  return { user, activeBorrows };
};

// ─── Admin soft-delete / restore ──────────────────────────────────────────────

/**
 * Admin: soft-delete a borrowing record.
 * Only returned borrowings can be deleted — active/overdue ones must be resolved first.
 */
const adminDeleteBorrowing = async (borrowingId, deletedBy) => {
  const [[row]] = await db.query(
    "SELECT id, status FROM borrowings WHERE id = ? AND deleted_at IS NULL",
    [borrowingId]
  );
  if (!row) throw Object.assign(new Error("Borrowing record not found"), { status: 404 });

  if (["borrowed", "overdue"].includes(row.status)) {
    throw Object.assign(
      new Error("Cannot delete an active borrowing — return the book first"),
      { status: 409 }
    );
  }

  await db.query(
    "UPDATE borrowings SET deleted_at = NOW(), deleted_by = ? WHERE id = ?",
    [deletedBy, borrowingId]
  );
};

/**
 * Admin: restore a soft-deleted borrowing record.
 */
const adminRestoreBorrowing = async (borrowingId) => {
  const [[row]] = await db.query(
    "SELECT id FROM borrowings WHERE id = ? AND deleted_at IS NOT NULL",
    [borrowingId]
  );
  if (!row) throw Object.assign(new Error("Archived borrowing record not found"), { status: 404 });

  await db.query(
    "UPDATE borrowings SET deleted_at = NULL, deleted_by = NULL WHERE id = ?",
    [borrowingId]
  );
};

/**
 * Admin: list borrowings with optional archived filter + search.
 */
const adminGetBorrowings = async ({ search = "", status, showArchived = false, page = 1, limit = 20 }) => {
  await syncOverdue();

  const offset     = (page - 1) * limit;
  const conditions = [`b.deleted_at IS ${showArchived ? "NOT NULL" : "NULL"}`];
  const params     = [];

  if (status && status !== "all") {
    conditions.push("b.status = ?");
    params.push(status);
  }

  if (search.trim()) {
    conditions.push("(bk.title LIKE ? OR u.name LIKE ? OR u.student_employee_id LIKE ?)");
    const like = `%${search.trim()}%`;
    params.push(like, like, like);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id
     JOIN users  u  ON u.id  = b.user_id
     ${where}`,
    params
  );

  const [rows] = await db.query(
    `SELECT
       b.id,
       b.status,
       b.borrowed_at,
       b.due_date,
       b.returned_at,
       b.deleted_at,
       b.notes,
       bk.title  AS book_title,
       bk.author AS book_author,
       u.name                AS user_name,
       u.student_employee_id,
       bc.barcode            AS copy_barcode
     FROM borrowings b
     JOIN books bk      ON bk.id = b.book_id
     JOIN users  u      ON u.id  = b.user_id
     LEFT JOIN book_copies bc ON bc.id = b.copy_id
     ${where}
     ORDER BY b.borrowed_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { rows, total, page, totalPages: Math.ceil(total / limit) };
};

module.exports = {
  getActiveBorrows,
  getBorrowHistory,
  searchCatalogueWithAvailability,
  resolveUserByBarcode,
  resolveCopyByBarcode,
  getActiveBorrowingByCopyBarcode,
  borrowBook,
  returnBook,
  lookupUserWithBorrows,
  adminDeleteBorrowing,
  adminRestoreBorrowing,
  adminGetBorrowings,
};
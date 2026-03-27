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
     JOIN books bk      ON bk.id = b.book_id
     LEFT JOIN book_copies bc ON bc.id = b.copy_id
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
     JOIN books bk      ON bk.id = b.book_id
     LEFT JOIN book_copies bc ON bc.id = b.copy_id
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
     LEFT JOIN book_copies  bc ON bc.book_id = bk.id AND bc.is_active = 1
     LEFT JOIN borrowings   br ON br.copy_id  = bc.id
                               AND br.status IN ('borrowed','overdue')
     WHERE bk.title  LIKE ?
        OR bk.author LIKE ?
        OR bk.isbn   LIKE ?
     GROUP BY bk.id
     ORDER BY bk.title ASC
     LIMIT 50`,
    [like, like, like]
  );
  return rows;
};

/**
 * Look up a user by their barcode or student_employee_id.
 * Used by the scanner role to identify who is checking in/out.
 */
const resolveUserByBarcode = async (scannedValue) => {
  const [[user]] = await db.query(
    `SELECT id, name, role, student_employee_id, barcode
     FROM users
     WHERE barcode = ? OR student_employee_id = ?
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
     JOIN books bk ON bk.id = bc.book_id
     WHERE bc.barcode = ?`,
    [barcode]
  );
  return copy ?? null;
};

/**
 * Find the active borrowing record for a given copy barcode.
 * Used by scanReturn to identify what to mark as returned.
 */
const getActiveBorrowingByCopyBarcode = async (barcode) => {
  const [[row]] = await db.query(
    `SELECT b.id, b.user_id
     FROM borrowings b
     JOIN book_copies bc ON bc.id = b.copy_id
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
      // Barcode scan path: resolve copy → book
      const [[c]] = await conn.query(
        `SELECT bc.id, bc.book_id, bc.barcode, bc.is_active,
                bk.copies
         FROM book_copies bc
         JOIN books bk ON bk.id = bc.book_id
         WHERE bc.barcode = ?
         FOR UPDATE`,
        [bookIdOrCopyBarcode]
      );
      if (!c) throw Object.assign(new Error("Copy barcode not found"), { status: 404 });
      if (!c.is_active) throw Object.assign(new Error("This copy is not available"), { status: 409 });
      copy = c;
    } else {
      // Legacy numeric book_id path — pick any available active copy
      const [[book]] = await conn.query(
        "SELECT id, copies FROM books WHERE id = ? FOR UPDATE",
        [bookIdOrCopyBarcode]
      );
      if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });

      const [copies] = await conn.query(
        `SELECT bc.id, bc.barcode FROM book_copies bc
         WHERE bc.book_id = ? AND bc.is_active = 1
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

    // Check the chosen copy isn't already out
    const [[activeLoan]] = await conn.query(
      `SELECT id FROM borrowings
       WHERE copy_id = ? AND status IN ('borrowed','overdue')`,
      [copy.id]
    );
    if (activeLoan) {
      throw Object.assign(new Error("This copy is already borrowed"), { status: 409 });
    }

    // Check user doesn't already have ANY copy of this book out
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

module.exports = {
  getActiveBorrows,
  getBorrowHistory,
  searchCatalogueWithAvailability,
  resolveUserByBarcode,
  resolveCopyByBarcode,
  getActiveBorrowingByCopyBarcode,
  borrowBook,
  returnBook,
};
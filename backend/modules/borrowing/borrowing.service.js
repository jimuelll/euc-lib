const db = require("../../db");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sync overdue status: any borrowed row past due_date becomes overdue.
 * Called before reads so the frontend always sees fresh status.
 */
const syncOverdue = async () => {
  await db.query(
    `UPDATE borrowings
     SET status = 'overdue'
     WHERE status = 'borrowed'
       AND due_date < CURDATE()`
  );
};

/**
 * Count how many copies of a book are currently out (borrowed or overdue).
 */
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
            b.borrowed_at, b.due_date, b.status, b.notes
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id
     WHERE b.user_id = ? AND b.status IN ('borrowed', 'overdue')
     ORDER BY b.due_date ASC`,
    [userId]
  );
  return rows;
};

const getBorrowHistory = async (userId) => {
  const [rows] = await db.query(
    `SELECT b.id, bk.title, bk.author,
            b.borrowed_at, b.returned_at, b.due_date, b.status
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id
     WHERE b.user_id = ? AND b.status = 'returned'
     ORDER BY b.returned_at DESC
     LIMIT 50`,
    [userId]
  );
  return rows;
};

/**
 * Catalogue search for the services page — includes live availability.
 * availability = copies - currently borrowed/overdue count
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
       GREATEST(0, bk.copies - COUNT(br.id)) AS available
     FROM books bk
     LEFT JOIN borrowings br
       ON br.book_id = bk.id AND br.status IN ('borrowed', 'overdue')
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

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Issue a borrow. Fails if no copies are available.
 * issuedBy = staff/admin user id who logged the borrow.
 * daysAllowed defaults to 7 if not provided.
 */
const borrowBook = async (userId, bookId, issuedBy, daysAllowed = 7) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the book row
    const [[book]] = await conn.query(
      "SELECT id, copies FROM books WHERE id = ? FOR UPDATE",
      [bookId]
    );
    if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });

    const out = await borrowedCopies(bookId, conn);
    if (out >= book.copies) {
      throw Object.assign(new Error("No copies available"), { status: 409 });
    }

    // Check user doesn't already have this book out
    const [[existing]] = await conn.query(
      `SELECT id FROM borrowings
       WHERE user_id = ? AND book_id = ? AND status IN ('borrowed', 'overdue')`,
      [userId, bookId]
    );
    if (existing) {
      throw Object.assign(new Error("User already has this book borrowed"), { status: 409 });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysAllowed);
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    const [result] = await conn.query(
      `INSERT INTO borrowings (user_id, book_id, due_date, status, issued_by)
       VALUES (?, ?, ?, 'borrowed', ?)`,
      [userId, bookId, dueDateStr, issuedBy ?? null]
    );

    await conn.commit();
    return { borrowingId: result.insertId, dueDate: dueDateStr };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Return a book. Only the issuing staff or an admin should call this,
 * but user_id is checked so a student can't return someone else's book.
 */
const returnBook = async (borrowingId, userId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[row]] = await conn.query(
      `SELECT id, user_id, status FROM borrowings WHERE id = ? FOR UPDATE`,
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
  borrowBook,
  returnBook,
};
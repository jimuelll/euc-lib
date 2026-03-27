const db = require("../../db");

// ─── Lookup helpers ───────────────────────────────────────────────────────────

const lookupUser = async (req, res) => {
  try {
    const { student_employee_id } = req.query;
    if (!student_employee_id?.trim()) {
      return res.status(400).json({ message: "student_employee_id is required" });
    }

    const [[user]] = await db.query(
      `SELECT id, name, student_employee_id, role, is_active
       FROM users WHERE student_employee_id = ?`,
      [student_employee_id.trim()]
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.is_active) return res.status(403).json({ message: "User account is inactive" });

    await db.query(
      `UPDATE borrowings SET status = 'overdue'
       WHERE status = 'borrowed' AND due_date < CURDATE()`
    );

    const [activeBorrows] = await db.query(
      `SELECT b.id, bk.title, bk.author, b.due_date, b.status
       FROM borrowings b
       JOIN books bk ON bk.id = b.book_id
       WHERE b.user_id = ? AND b.status IN ('borrowed', 'overdue')
       ORDER BY b.due_date ASC`,
      [user.id]
    );

    res.json({ user, activeBorrows });
  } catch (err) {
    console.error("[circulation] lookupUser:", err);
    res.status(500).json({ message: "Failed to look up user" });
  }
};

const lookupBook = async (req, res) => {
  try {
    const { isbn } = req.query;
    if (!isbn?.trim()) {
      return res.status(400).json({ message: "ISBN is required" });
    }

    const [[book]] = await db.query(
      `SELECT
         bk.id, bk.title, bk.author, bk.isbn, bk.copies,
         GREATEST(0, bk.copies - COUNT(br.id)) AS available
       FROM books bk
       LEFT JOIN borrowings br
         ON br.book_id = bk.id AND br.status IN ('borrowed', 'overdue')
       WHERE bk.isbn = ?
       GROUP BY bk.id`,
      [isbn.trim()]
    );
    if (!book) return res.status(404).json({ message: "Book not found" });

    res.json(book);
  } catch (err) {
    console.error("[circulation] lookupBook:", err);
    res.status(500).json({ message: "Failed to look up book" });
  }
};

// ─── Transactions ─────────────────────────────────────────────────────────────

const processBorrow = async (req, res) => {
  try {
    const { userId, bookId, dueDate } = req.body;
    if (!userId || !bookId || !dueDate) {
      return res.status(400).json({ message: "userId, bookId, and dueDate are required" });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [[book]] = await conn.query(
        "SELECT id, copies FROM books WHERE id = ? FOR UPDATE",
        [bookId]
      );
      if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });

      // 'out' is reserved in MariaDB — use 'borrowed_count' instead
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
        [userId, bookId, dueDate, req.user.id]
      );

      await conn.commit();
      res.status(201).json({ message: "Book borrowed successfully", borrowingId: result.insertId });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[circulation] processBorrow:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to process borrow" });
  }
};

const processReturn = async (req, res) => {
  try {
    const { borrowingId } = req.body;
    if (!borrowingId) return res.status(400).json({ message: "borrowingId is required" });

    const [[row]] = await db.query(
      "SELECT id, status FROM borrowings WHERE id = ?",
      [borrowingId]
    );
    if (!row) return res.status(404).json({ message: "Borrowing record not found" });
    if (row.status === "returned") {
      return res.status(409).json({ message: "Book already returned" });
    }

    await db.query(
      `UPDATE borrowings SET status = 'returned', returned_at = NOW() WHERE id = ?`,
      [borrowingId]
    );

    res.json({ message: "Book returned successfully" });
  } catch (err) {
    console.error("[circulation] processReturn:", err);
    res.status(500).json({ message: "Failed to process return" });
  }
};

const processRenew = async (req, res) => {
  try {
    const { borrowingId, dueDate } = req.body;
    if (!borrowingId || !dueDate) {
      return res.status(400).json({ message: "borrowingId and dueDate are required" });
    }

    const [[row]] = await db.query(
      "SELECT id, status FROM borrowings WHERE id = ?",
      [borrowingId]
    );
    if (!row) return res.status(404).json({ message: "Borrowing record not found" });
    if (row.status === "returned") {
      return res.status(409).json({ message: "Cannot renew a returned book" });
    }

    await db.query(
      `UPDATE borrowings SET due_date = ?, status = 'borrowed' WHERE id = ?`,
      [dueDate, borrowingId]
    );

    res.json({ message: "Book renewed successfully", dueDate });
  } catch (err) {
    console.error("[circulation] processRenew:", err);
    res.status(500).json({ message: "Failed to process renewal" });
  }
};

const getCirculationLog = async (req, res) => {
  try {
    const status  = req.query.status  || "";
    const search  = req.query.search  || "";
    const page    = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset  = (page - 1) * limit;
 
    // Sync overdue before reading
    await db.query(
      `UPDATE borrowings SET status = 'overdue'
       WHERE status = 'borrowed' AND due_date < CURDATE()`
    );
 
    const conditions = [];
    const params     = [];
 
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
 
    res.json({
      rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[circulation] getCirculationLog:", err);
    res.status(500).json({ message: "Failed to fetch circulation log" });
  }
};
 
module.exports = { lookupUser, lookupBook, processBorrow, processReturn, processRenew, getCirculationLog };
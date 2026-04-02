const db = require("../../db");
const {
  calculateDueDateWithHolidays,
  mapBorrowingsWithFineDetails,
  syncOverdueBorrowings,
  listUnsettledBorrowings,
} = require("./overdue.helper");
const notificationsService = require("../notifications/notifications.service");
const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  await syncOverdueBorrowings();
  const [rows] = await db.query(
    `SELECT b.id, bk.title, bk.author,
            b.borrowed_at, b.due_date, b.returned_at, b.status, b.notes,
            COALESCE(b.settled_amount, 0) AS settled_amount,
            bc.barcode AS copy_barcode, bc.condition AS copy_condition
     FROM borrowings b
     JOIN books bk      ON bk.id = b.book_id AND bk.deleted_at IS NULL
     LEFT JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
     WHERE b.user_id = ? AND b.status IN ('borrowed', 'overdue')
     ORDER BY b.due_date ASC`,
    [userId]
  );
  return mapBorrowingsWithFineDetails(rows);
};

const getBorrowHistory = async (userId) => {
  const [rows] = await db.query(
    `SELECT b.id, bk.title, bk.author,
            b.borrowed_at, b.returned_at, b.due_date, b.status,
            COALESCE(b.settled_amount, 0) AS settled_amount,
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
  await syncOverdueBorrowings();
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
  const safeDaysAllowed = Math.max(1, Number.parseInt(daysAllowed, 10) || 7);
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

    const dueDate = await calculateDueDateWithHolidays(new Date(), safeDaysAllowed, conn);

    const [result] = await conn.query(
      `INSERT INTO borrowings (user_id, book_id, copy_id, due_date, status, issued_by)
       VALUES (?, ?, ?, ?, 'borrowed', ?)`,
      [userId, copy.book_id, copy.id, dueDate, issuedBy ?? null]
    );

    const borrowingId = result.insertId;

    await conn.commit();

    const target = await getBorrowingNotificationTarget(borrowingId);
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

    return { borrowingId, copyId: copy.id, barcode: copy.barcode, dueDate };
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

    const target = await getBorrowingNotificationTarget(borrowingId);
    if (target) {
      await notificationsService.createNotification({
        type: "borrowing_returned",
        title: "Book return recorded",
        body: `Your return for "${target.title}" has been recorded successfully.`,
        href: "/my-library",
        audienceType: "user",
        audienceUserId: target.user_id,
        createdBy: userId ?? null,
      });
    }
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
    `SELECT b.id, b.book_id, bk.title, bk.author, b.due_date, b.status,
            COALESCE(b.settled_amount, 0) AS settled_amount
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
     WHERE b.user_id = ? AND b.status IN ('borrowed', 'overdue')
     ORDER BY b.due_date ASC`,
    [user.id]
  );

  return { user, activeBorrows: await mapBorrowingsWithFineDetails(activeBorrows) };
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
const adminGetBorrowings = async ({
  search = "",
  status,
  showArchived = false,
  page = 1,
  limit = 20,
  dateFrom,
  dateTo,
}) => {
  await syncOverdueBorrowings();

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

  if (dateFrom) {
    conditions.push("DATE(b.borrowed_at) >= ?");
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push("DATE(b.borrowed_at) <= ?");
    params.push(dateTo);
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
       COALESCE(b.settled_amount, 0) AS settled_amount,
        b.settled_at,
        b.settled_by,
       bk.title  AS book_title,
       bk.author AS book_author,
       bk.isbn,
       u.name                AS user_name,
       u.student_employee_id,
       bc.barcode            AS copy_barcode,
       issuer.name           AS issued_by_name
     FROM borrowings b
     JOIN books bk      ON bk.id = b.book_id
     JOIN users  u      ON u.id  = b.user_id
     LEFT JOIN book_copies bc ON bc.id = b.copy_id
     LEFT JOIN users issuer ON issuer.id = b.issued_by
     ${where}
     ORDER BY b.borrowed_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [[summaryRow]] = await db.query(
    `SELECT
       COUNT(*) AS total_records,
       SUM(CASE WHEN b.status = 'borrowed' THEN 1 ELSE 0 END) AS borrowed_count,
       SUM(CASE WHEN b.status = 'overdue' THEN 1 ELSE 0 END) AS overdue_count,
       SUM(CASE WHEN b.status = 'returned' THEN 1 ELSE 0 END) AS returned_count,
       COUNT(DISTINCT b.user_id) AS unique_borrowers
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id
     JOIN users u ON u.id = b.user_id
     ${where}`,
    params
  );

  return {
    rows: await mapBorrowingsWithFineDetails(rows),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    summary: {
      total_records: Number(summaryRow?.total_records ?? 0),
      borrowed_count: Number(summaryRow?.borrowed_count ?? 0),
      overdue_count: Number(summaryRow?.overdue_count ?? 0),
      returned_count: Number(summaryRow?.returned_count ?? 0),
      unique_borrowers: Number(summaryRow?.unique_borrowers ?? 0),
    },
  };
};

const getAdminPaymentOverview = async ({ limit = 50 } = {}) => {
  await syncOverdueBorrowings();

  const paymentOverview = await listUnsettledBorrowings({ limit });

  return {
    rows: paymentOverview.rows,
    summary: paymentOverview.summary,
  };
};

const getUserPaymentOverview = async (studentEmployeeId) => {
  const [[user]] = await db.query(
    `SELECT id, name, role, student_employee_id, is_active
     FROM users
     WHERE student_employee_id = ?
       AND deleted_at IS NULL
     LIMIT 1`,
    [studentEmployeeId.trim()]
  );

  if (!user) {
    throw Object.assign(new Error("User not found"), { status: 404 });
  }

  const paymentOverview = await listUnsettledBorrowings({ userId: user.id });

  return {
    user,
    rows: paymentOverview.rows,
    summary: paymentOverview.summary,
  };
};

const settleUserPayments = async ({ studentEmployeeId, amount, settledBy }) => {
  const trimmedId = String(studentEmployeeId ?? "").trim();
  const numericAmount = roundCurrency(amount);

  if (!trimmedId) {
    throw Object.assign(new Error("Student or employee ID is required"), { status: 400 });
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw Object.assign(new Error("Payment amount must be greater than zero"), { status: 400 });
  }

  await syncOverdueBorrowings();

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [[user]] = await conn.query(
      `SELECT id, name, student_employee_id
       FROM users
       WHERE student_employee_id = ?
         AND deleted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [trimmedId]
    );

    if (!user) {
      throw Object.assign(new Error("User not found"), { status: 404 });
    }

    const [rows] = await conn.query(
      `SELECT
         b.id,
         b.user_id,
         b.status,
         b.borrowed_at,
         b.due_date,
         b.returned_at,
         COALESCE(b.settled_amount, 0) AS settled_amount,
         bk.title AS book_title,
         bk.author AS book_author,
         bk.isbn,
         bc.barcode AS copy_barcode
       FROM borrowings b
       JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
       LEFT JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
       WHERE b.user_id = ?
         AND b.deleted_at IS NULL
       ORDER BY COALESCE(b.returned_at, b.due_date) ASC, b.id ASC
       FOR UPDATE`,
      [user.id]
    );

    const mappedRows = await mapBorrowingsWithFineDetails(rows, conn);
    const unsettledRows = mappedRows.filter((row) => Number(row.unsettled_amount || 0) > 0);

    if (!unsettledRows.length) {
      throw Object.assign(new Error("This user has no unsettled payments"), { status: 409 });
    }

    const totalUnsettled = roundCurrency(
      unsettledRows.reduce((sum, row) => sum + Number(row.unsettled_amount || 0), 0)
    );

    if (numericAmount > totalUnsettled) {
      throw Object.assign(
        new Error(`Payment amount exceeds the user's unsettled balance of PHP ${totalUnsettled.toFixed(2)}`),
        { status: 400 }
      );
    }

    let remainingAmount = numericAmount;
    const settledRows = [];

    for (const row of unsettledRows) {
      if (remainingAmount <= 0) break;

      const unsettledAmount = roundCurrency(row.unsettled_amount);
      const appliedAmount = roundCurrency(Math.min(remainingAmount, unsettledAmount));
      const nextSettledAmount = roundCurrency(Number(row.settled_amount || 0) + appliedAmount);

      await conn.query(
        `UPDATE borrowings
         SET settled_amount = ?,
             settled_at = NOW(),
             settled_by = ?
         WHERE id = ?`,
        [nextSettledAmount, settledBy ?? null, row.id]
      );

      settledRows.push({
        borrowing_id: row.id,
        book_title: row.book_title,
        applied_amount: appliedAmount,
      });

      remainingAmount = roundCurrency(remainingAmount - appliedAmount);
    }

    await conn.commit();

    const refreshedOverview = await listUnsettledBorrowings({ userId: user.id });
    const remainingBalance = refreshedOverview.summary.total_unsettled_amount;

    try {
      await notificationsService.createNotification({
        type: "payment_settled",
        title: "Payment received",
        body: `A payment of PHP ${numericAmount.toFixed(2)} was recorded for your unsettled library fines. Remaining unsettled balance: PHP ${remainingBalance.toFixed(2)}.`,
        href: "/my-library",
        audienceType: "user",
        audienceUserId: user.id,
        createdBy: settledBy ?? null,
      });
    } catch (notificationError) {
      console.error("[borrowing] Failed to create payment notification:", notificationError);
    }

    return {
      message: remainingBalance > 0
        ? "Payment recorded successfully"
        : "Payment recorded and all unsettled balances are cleared",
      user,
      settled_amount: numericAmount,
      remaining_balance: remainingBalance,
      settled_rows: settledRows,
    };
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
  lookupUserWithBorrows,
  adminDeleteBorrowing,
  adminRestoreBorrowing,
  adminGetBorrowings,
  getAdminPaymentOverview,
  getUserPaymentOverview,
  settleUserPayments,
};

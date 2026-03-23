const db = require("../db");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Expire pending reservations whose expires_at has passed.
 * Called before reads so the frontend always sees fresh status.
 */
const syncExpired = async () => {
  await db.query(
    `UPDATE reservations
     SET status = 'expired'
     WHERE status = 'pending'
       AND expires_at IS NOT NULL
       AND expires_at < NOW()`
  );
};

// ─── User reads ───────────────────────────────────────────────────────────────

const getActiveReservations = async (userId) => {
  await syncExpired();
  const [rows] = await db.query(
    `SELECT r.id, bk.title, bk.author, bk.location,
            r.status, r.reserved_at, r.expires_at, r.notes
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id
     WHERE r.user_id = ? AND r.status IN ('pending', 'ready')
     ORDER BY r.reserved_at DESC`,
    [userId]
  );
  return rows;
};

const getReservationHistory = async (userId) => {
  const [rows] = await db.query(
    `SELECT r.id, bk.title, bk.author,
            r.status, r.reserved_at, r.expires_at,
            r.fulfilled_at, r.cancelled_at
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id
     WHERE r.user_id = ?
       AND r.status IN ('cancelled', 'expired', 'fulfilled')
     ORDER BY r.reserved_at DESC
     LIMIT 50`,
    [userId]
  );
  return rows;
};

/**
 * Catalogue search with live availability.
 * available = copies - currently borrowed/overdue
 */
const searchCatalogue = async (query) => {
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

// ─── User mutations ───────────────────────────────────────────────────────────

/**
 * Create a reservation for a book.
 * Fails if user already has an active reservation for the same book.
 * expires_at is set to 48 hours from now by default.
 */
const reserveBook = async (userId, bookId, hoursUntilExpiry = 48) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[book]] = await conn.query(
      "SELECT id, title FROM books WHERE id = ?",
      [bookId]
    );
    if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });

    // Block duplicate active reservations
    const [[existing]] = await conn.query(
      `SELECT id FROM reservations
       WHERE user_id = ? AND book_id = ? AND status IN ('pending', 'ready')`,
      [userId, bookId]
    );
    if (existing) {
      throw Object.assign(
        new Error("You already have an active reservation for this book"),
        { status: 409 }
      );
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hoursUntilExpiry);
    const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace("T", " ");

    const [result] = await conn.query(
      `INSERT INTO reservations (user_id, book_id, status, expires_at)
       VALUES (?, ?, 'pending', ?)`,
      [userId, bookId, expiresAtStr]
    );

    await conn.commit();
    return { reservationId: result.insertId, expiresAt: expiresAtStr };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Cancel a reservation. Only the owning user can cancel.
 */
const cancelReservation = async (reservationId, userId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[row]] = await conn.query(
      `SELECT id, user_id, status FROM reservations WHERE id = ? FOR UPDATE`,
      [reservationId]
    );
    if (!row) throw Object.assign(new Error("Reservation not found"), { status: 404 });
    if (row.user_id !== userId) throw Object.assign(new Error("Forbidden"), { status: 403 });
    if (!["pending", "ready"].includes(row.status)) {
      throw Object.assign(new Error("Reservation cannot be cancelled"), { status: 409 });
    }

    await conn.query(
      `UPDATE reservations
       SET status = 'cancelled', cancelled_at = NOW()
       WHERE id = ?`,
      [reservationId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ─── Admin reads ──────────────────────────────────────────────────────────────

/**
 * Paginated list of all reservations across all users.
 * Supports filtering by status and searching by book title, author,
 * patron name, or student/employee ID.
 */
const getAdminReservations = async ({ search, status, page = 1, limit = 15 }) => {
  await syncExpired();

  const offset     = (page - 1) * limit;
  const conditions = [];
  const params     = [];

  if (status && status !== "all") {
    conditions.push("r.status = ?");
    params.push(status);
  }

  if (search?.trim()) {
    conditions.push(`(
      bk.title               LIKE ? OR
      bk.author              LIKE ? OR
      u.name                 LIKE ? OR
      u.student_employee_id  LIKE ?
    )`);
    const like = `%${search.trim()}%`;
    params.push(like, like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id
     JOIN users  u  ON u.id  = r.user_id
     ${where}`,
    params
  );

  const [rows] = await db.query(
    `SELECT
       r.id,
       r.status,
       r.reserved_at,
       r.expires_at,
       r.notes,
       bk.title    AS book_title,
       bk.author   AS book_author,
       bk.location AS book_location,
       u.name                AS user_name,
       u.student_employee_id
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id
     JOIN users  u  ON u.id  = r.user_id
     ${where}
     ORDER BY r.reserved_at DESC
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

// ─── Admin mutations ──────────────────────────────────────────────────────────

/**
 * Mark a pending reservation as ready for patron pickup.
 */
const markReservationReady = async (reservationId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[row]] = await conn.query(
      "SELECT id, status FROM reservations WHERE id = ? FOR UPDATE",
      [reservationId]
    );
    if (!row) throw Object.assign(new Error("Reservation not found"), { status: 404 });
    if (row.status !== "pending") {
      throw Object.assign(
        new Error("Only pending reservations can be marked ready"),
        { status: 409 }
      );
    }

    await conn.query(
      "UPDATE reservations SET status = 'ready' WHERE id = ?",
      [reservationId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Fulfil a ready reservation — patron has collected the book.
 */
const fulfillReservation = async (reservationId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[row]] = await conn.query(
      "SELECT id, status FROM reservations WHERE id = ? FOR UPDATE",
      [reservationId]
    );
    if (!row) throw Object.assign(new Error("Reservation not found"), { status: 404 });
    if (row.status !== "ready") {
      throw Object.assign(
        new Error("Only ready reservations can be fulfilled"),
        { status: 409 }
      );
    }

    await conn.query(
      "UPDATE reservations SET status = 'fulfilled', fulfilled_at = NOW() WHERE id = ?",
      [reservationId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Admin-side cancel — no ownership check.
 */
const cancelReservationAdmin = async (reservationId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[row]] = await conn.query(
      "SELECT id, status FROM reservations WHERE id = ? FOR UPDATE",
      [reservationId]
    );
    if (!row) throw Object.assign(new Error("Reservation not found"), { status: 404 });
    if (!["pending", "ready"].includes(row.status)) {
      throw Object.assign(new Error("Reservation cannot be cancelled"), { status: 409 });
    }

    await conn.query(
      "UPDATE reservations SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?",
      [reservationId]
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
  // helpers
  syncExpired,
  // user reads
  getActiveReservations,
  getReservationHistory,
  searchCatalogue,
  // user mutations
  reserveBook,
  cancelReservation,
  // admin reads
  getAdminReservations,
  // admin mutations
  markReservationReady,
  fulfillReservation,
  cancelReservationAdmin,
};
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

// ─── Reads ────────────────────────────────────────────────────────────────────

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

// ─── Mutations ────────────────────────────────────────────────────────────────

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

module.exports = {
  syncExpired,
  getActiveReservations,
  getReservationHistory,
  searchCatalogue,
  reserveBook,
  cancelReservation,
};
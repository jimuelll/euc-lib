const db = require("../../db");
const { metadataValue } = require("../catalog/catalog.projection");

function getConnection() {
  return db.getConnection();
}

async function getReservationNotificationTarget(reservationId, conn = db) {
  const [[row]] = await conn.query(
    `SELECT r.id, r.user_id, r.status, bk.title
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id AND bk.deleted_at IS NULL
     WHERE r.id = ? LIMIT 1`,
    [reservationId]
  );
  return row || null;
}

async function syncExpired() {
  const [expiredRows] = await db.query(
    `SELECT
       r.id,
       r.user_id,
       bk.title
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id AND bk.deleted_at IS NULL
     WHERE r.status IN ('pending', 'ready')
       AND r.expires_at IS NOT NULL
       AND r.expires_at < NOW()
       AND r.deleted_at IS NULL`
  );

  if (!expiredRows.length) return [];

  await db.query(
    `UPDATE reservations
     SET status = 'expired', reserved_copy_id = NULL
     WHERE status IN ('pending', 'ready')
       AND expires_at IS NOT NULL
       AND expires_at < NOW()
       AND deleted_at IS NULL`
  );

  return expiredRows;
}

async function findActiveReservations(userId) {
  const [rows] = await db.query(
    `SELECT r.id, bk.title, bk.author, ${metadataValue("bk", "location")},
            r.status, r.reserved_at, r.expires_at, r.notes
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id AND bk.deleted_at IS NULL
     WHERE r.user_id = ? AND r.status IN ('pending', 'ready')
       AND r.deleted_at IS NULL
     ORDER BY r.reserved_at DESC`,
    [userId]
  );
  return rows;
}

async function findReservationHistory(userId, { page, limit } = {}) {
  const paged = Number.isFinite(Number(page));
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const [[{ total }]] = paged
    ? await db.query(
      `SELECT COUNT(*) AS total FROM reservations
       WHERE user_id = ? AND status IN ('cancelled', 'expired', 'fulfilled') AND deleted_at IS NULL`,
      [userId]
    )
    : [[{ total: 0 }]];
  const [rows] = await db.query(
    `SELECT r.id, bk.title, bk.author,
            r.status, r.reserved_at, r.expires_at,
            r.fulfilled_at, r.cancelled_at
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id
     WHERE r.user_id = ?
       AND r.status IN ('cancelled', 'expired', 'fulfilled')
       AND r.deleted_at IS NULL
     ORDER BY r.reserved_at DESC${paged ? " LIMIT ? OFFSET ?" : " LIMIT 50"}`,
    paged ? [userId, safeLimit, (safePage - 1) * safeLimit] : [userId]
  );
  return paged
    ? {
      rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / safeLimit),
      },
    }
    : rows;
}

async function searchCatalogue(query, { page, limit } = {}) {
  const like = `%${query}%`;
  const paged = Number.isFinite(Number(page));
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const [[{ total }]] = paged
    ? await db.query(
      `SELECT COUNT(*) AS total FROM books bk
       WHERE bk.deleted_at IS NULL AND bk.material_type = 'book'
         AND (bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ?)`,
      [like, like, like]
    )
    : [[{ total: 0 }]];
  const [rows] = await db.query(
    `SELECT
       bk.id,
       bk.title,
       bk.author,
       ${metadataValue("bk", "category")},
       bk.isbn,
       bk.copies,
       ${metadataValue("bk", "location")},
       bk.material_type,
       TRUE AS canBorrow,
       TRUE AS canReserve,
       GREATEST(0,
         COUNT(DISTINCT bc.id) -
         COUNT(DISTINCT CASE WHEN br.status IN ('borrowed', 'overdue') OR rr.id IS NOT NULL THEN bc.id END)
       ) AS available
     FROM books bk
     LEFT JOIN book_copies bc
       ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.condition IN ('good', 'damaged') AND bc.deleted_at IS NULL
     LEFT JOIN borrowings br
       ON br.copy_id = bc.id AND br.status IN ('borrowed', 'overdue')
     LEFT JOIN reservations rr
       ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL
     WHERE bk.deleted_at IS NULL
       AND bk.material_type = 'book'
       AND (bk.title LIKE ?
        OR bk.author LIKE ?
        OR bk.isbn LIKE ?)
     GROUP BY bk.id
     ORDER BY bk.title ASC${paged ? " LIMIT ? OFFSET ?" : " LIMIT 50"}`,
    paged ? [like, like, like, safeLimit, (safePage - 1) * safeLimit] : [like, like, like]
  );
  return paged
    ? {
      rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / safeLimit),
      },
    }
    : rows;
}

async function findBookForReservation(bookId, conn) {
  const [[book]] = await conn.query(
    "SELECT id, title, material_type FROM books WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
    [bookId]
  );
  return book || null;
}

async function findActiveReservationByUserBook(userId, bookId, conn) {
  const [[reservation]] = await conn.query(
    `SELECT id FROM reservations
     WHERE user_id = ? AND book_id = ? AND status IN ('pending', 'ready')
       AND deleted_at IS NULL`,
    [userId, bookId]
  );
  return reservation || null;
}

async function createReservation(userId, bookId, expiresAt, conn) {
  const [result] = await conn.query(
    `INSERT INTO reservations (user_id, book_id, status, expires_at)
     VALUES (?, ?, 'pending', ?)`,
    [userId, bookId, expiresAt]
  );
  return result;
}

async function findReservationForUserCancel(reservationId, conn) {
  const [[row]] = await conn.query(
    `SELECT id, user_id, status FROM reservations
     WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
    [reservationId]
  );
  return row || null;
}

async function cancelReservation(reservationId, conn) {
  await conn.query(
    `UPDATE reservations
     SET status = 'cancelled', cancelled_at = NOW()
     WHERE id = ?`,
    [reservationId]
  );
}

async function getAdminReservations({
  search,
  status,
  dateFrom,
  dateTo,
  archived = false,
  page = 1,
  limit = 15,
}) {
  const offset = (page - 1) * limit;
  const conditions = [`r.deleted_at IS ${archived ? "NOT NULL" : "NULL"}`];
  const params = [];

  if (status && status !== "all") {
    conditions.push("r.status = ?");
    params.push(status);
  }

  if (search?.trim()) {
    conditions.push(`(
      bk.title              LIKE ? OR
      bk.author             LIKE ? OR
      u.name                LIKE ? OR
      u.student_employee_id LIKE ?
    )`);
    const like = `%${search.trim()}%`;
    params.push(like, like, like, like);
  }

  if (dateFrom) {
    conditions.push("r.reserved_at >= ?");
    params.push(`${dateFrom} 00:00:00`);
  }

  if (dateTo) {
    conditions.push("r.reserved_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(dateTo);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const baseFromClause = `
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id AND bk.deleted_at IS NULL
     JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
     ${where}
  `;

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     ${baseFromClause}`,
    params
  );

  const [[summary]] = await db.query(
    `SELECT
       COUNT(*) AS total_records,
       SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
       SUM(CASE WHEN r.status = 'ready' THEN 1 ELSE 0 END) AS ready_count,
       SUM(CASE WHEN r.status = 'fulfilled' THEN 1 ELSE 0 END) AS fulfilled_count,
       SUM(CASE WHEN r.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
       SUM(CASE WHEN r.status = 'expired' THEN 1 ELSE 0 END) AS expired_count
     ${baseFromClause}`,
    params
  );

  const [rows] = await db.query(
    `SELECT
       r.id,
       r.book_id,
       r.status,
       r.reserved_at,
       r.expires_at,
       r.notes,
       bk.title AS book_title,
       bk.author AS book_author,
       ${metadataValue("bk", "location", "book_location")},
       u.name AS user_name,
       u.student_employee_id
     ${baseFromClause}
     ORDER BY r.reserved_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    rows,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    summary: {
      total_records: Number(summary?.total_records ?? 0),
      pending_count: Number(summary?.pending_count ?? 0),
      ready_count: Number(summary?.ready_count ?? 0),
      fulfilled_count: Number(summary?.fulfilled_count ?? 0),
      cancelled_count: Number(summary?.cancelled_count ?? 0),
      expired_count: Number(summary?.expired_count ?? 0),
    },
  };
}

async function findReservationForReady(reservationId, conn) {
  const [[row]] = await conn.query(
    "SELECT id, book_id, status FROM reservations WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
    [reservationId]
  );
  return row || null;
}

async function findAvailableCopyForReservation(bookId, conn) {
  const [[copy]] = await conn.query(
    `SELECT bc.id
     FROM book_copies bc
     WHERE bc.book_id = ? AND bc.is_active = 1
       AND bc.condition IN ('good', 'damaged') AND bc.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM borrowings b WHERE b.copy_id = bc.id AND b.status IN ('borrowed', 'overdue'))
       AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.reserved_copy_id = bc.id AND r.status = 'ready' AND r.deleted_at IS NULL)
     LIMIT 1 FOR UPDATE`,
    [bookId]
  );
  return copy || null;
}

async function markReady(reservationId, copyId, conn) {
  await conn.query(
    "UPDATE reservations SET status = 'ready', reserved_copy_id = ? WHERE id = ?",
    [copyId, reservationId]
  );
}

async function findReservationForFulfill(reservationId, conn) {
  const [[row]] = await conn.query(
    "SELECT id, status FROM reservations WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
    [reservationId]
  );
  return row || null;
}

async function fulfillReservation(reservationId, conn) {
  await conn.query(
    "UPDATE reservations SET status = 'fulfilled', fulfilled_at = NOW() WHERE id = ?",
    [reservationId]
  );
}

async function findReservationForAdminCancel(reservationId, conn) {
  const [[row]] = await conn.query(
    "SELECT id, status FROM reservations WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
    [reservationId]
  );
  return row || null;
}

async function cancelReservationAdmin(reservationId, conn) {
  await conn.query(
    "UPDATE reservations SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?",
    [reservationId]
  );
}

async function findArchivedReservation(reservationId, conn) {
  const [[row]] = await conn.query(
    "SELECT id FROM reservations WHERE id = ? AND deleted_at IS NOT NULL FOR UPDATE",
    [reservationId]
  );
  return row || null;
}

async function restoreReservation(reservationId, conn) {
  await conn.query(
    "UPDATE reservations SET deleted_at = NULL, deleted_by = NULL WHERE id = ?",
    [reservationId]
  );
}

async function archiveReservation(reservationId, deletedBy) {
  const [[row]] = await db.query("SELECT status FROM reservations WHERE id = ? AND deleted_at IS NULL", [reservationId]);
  if (!row) throw Object.assign(new Error("Reservation not found"), { status: 404 });
  if (["pending", "ready"].includes(row.status)) throw Object.assign(new Error("Cancel or fulfil the reservation before archiving it"), { status: 409 });
  await db.query("UPDATE reservations SET deleted_at = NOW(), deleted_by = ? WHERE id = ?", [deletedBy, reservationId]);
}

module.exports = {
  getConnection,
  getReservationNotificationTarget,
  syncExpired,
  findActiveReservations,
  findReservationHistory,
  searchCatalogue,
  findBookForReservation,
  findActiveReservationByUserBook,
  createReservation,
  findReservationForUserCancel,
  cancelReservation,
  getAdminReservations,
  findReservationForReady,
  findAvailableCopyForReservation,
  markReady,
  findReservationForFulfill,
  fulfillReservation,
  findReservationForAdminCancel,
  cancelReservationAdmin,
  findArchivedReservation,
  restoreReservation,
  archiveReservation,
};

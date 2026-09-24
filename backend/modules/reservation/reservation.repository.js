const db = require("../../db");
const outboxRepository = require("../delivery-outbox/outbox.repository");
const { metadataValue } = require("../catalog/catalog.projection");
const { availableToBorrow, hasActiveBookPolicy, hasAccession } = require("../catalog/copyEligibility");
const { enqueueAuditEvent } = require("../analytics/analytics.audit.service");
const { copyLabel } = require("../analytics/audit.copy-label");

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
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [expiredRows] = await conn.query(
      `SELECT r.id, r.user_id, r.reserved_copy_id, bc.barcode, bk.title
         FROM reservations r
         JOIN books bk ON bk.id = r.book_id
         LEFT JOIN book_copies bc ON bc.id = r.reserved_copy_id
        WHERE r.status IN ('pending', 'ready') AND r.expires_at IS NOT NULL
          AND r.expires_at < NOW() AND r.deleted_at IS NULL
        ORDER BY r.id FOR UPDATE`,
    );
    const changedRows = [];
    for (const row of expiredRows) {
      const [result] = await conn.query(
        `UPDATE reservations SET status = 'expired', reserved_copy_id = NULL
          WHERE id = ? AND status IN ('pending', 'ready') AND expires_at < NOW() AND deleted_at IS NULL`,
        [row.id],
      );
      if (result.affectedRows !== 1) continue;
      await outboxRepository.enqueue("notification", {
        type: "reservation_expired",
        title: "Reservation expired",
        body: `Your reservation for ${row.title} expired before pickup.`,
        href: "/services/borrowing",
        audienceType: "user",
        audienceUserId: row.user_id,
      }, conn);
      const copySuffix = row.reserved_copy_id ? ` · ${copyLabel({ id: row.reserved_copy_id, barcode: row.barcode })}` : "";
      await enqueueAuditEvent(conn, {
        actorId: null,
        category: "reservation",
        action: "expired",
        description: `Expired reservation for “${row.title}”${copySuffix}`,
        route: `/api/admin/reservations/${row.id}/expire`,
        metadata: {
          detail_status: "changes_captured",
          changes: [{ field: "Reservation status", before: "Pending or ready", after: "Expired" }],
          reservation_id: Number(row.id),
          ...(row.barcode ? { copy_barcode: row.barcode } : {}),
        },
      });
      changedRows.push(row);
    }
    await conn.commit();
    return changedRows;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function findActiveReservations(userId) {
  const [rows] = await db.query(
    `SELECT r.id, bk.title, bk.author, h.location,
            r.status, r.reserved_at, r.expires_at, r.notes
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id AND bk.deleted_at IS NULL
     LEFT JOIN copy_holdings h ON h.copy_id = r.reserved_copy_id
     WHERE r.user_id = ? AND r.status IN ('pending', 'ready')
       AND r.deleted_at IS NULL AND (r.expires_at IS NULL OR r.expires_at > NOW())
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

async function searchCatalogue(query, { page, limit, showUnheldInOpac = true } = {}) {
  const like = `%${query}%`;
  const paged = Number.isFinite(Number(page));
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const visibilityFilter = showUnheldInOpac ? "" : `AND EXISTS (
    SELECT 1 FROM book_copies held_bc
     WHERE held_bc.book_id = bk.id AND held_bc.deleted_at IS NULL AND held_bc.is_active = 1
       AND held_bc.condition IN ('good','damaged') AND ${hasAccession("held_bc")}
  )`;
  const [[{ total }]] = paged
      ? await db.query(
        `SELECT COUNT(*) AS total FROM books bk
       WHERE bk.deleted_at IS NULL AND bk.material_type = 'book'
         AND (bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ?)
         ${visibilityFilter}`,
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
       GROUP_CONCAT(DISTINCT NULLIF(TRIM(ch.location), '') ORDER BY ch.location SEPARATOR ', ') AS location,
       bk.material_type,
       COUNT(DISTINCT CASE WHEN ${hasAccession("bc", "ch")} THEN bc.id END) AS registered_copies,
       COUNT(DISTINCT CASE WHEN ${availableToBorrow("bc")} THEN bc.id END) AS available,
       (COUNT(DISTINCT CASE WHEN ${availableToBorrow("bc")} THEN bc.id END) > 0) AS canBorrow,
       (${hasActiveBookPolicy("bk")} AND COUNT(DISTINCT CASE WHEN ${hasAccession("bc", "ch")} THEN bc.id END) > 0) AS canReserve
     FROM books bk
     LEFT JOIN book_copies bc
       ON bc.book_id = bk.id AND bc.is_active = 1 AND bc.condition IN ('good', 'damaged') AND bc.deleted_at IS NULL
     LEFT JOIN copy_holdings ch ON ch.copy_id = bc.id
     LEFT JOIN borrowings br
       ON br.copy_id = bc.id AND br.deleted_at IS NULL AND br.status IN ('borrowed', 'overdue')
     LEFT JOIN reservations rr
       ON rr.reserved_copy_id = bc.id AND rr.status = 'ready' AND rr.deleted_at IS NULL AND (rr.expires_at IS NULL OR rr.expires_at > NOW())
     WHERE bk.deleted_at IS NULL
       AND bk.material_type = 'book'
       AND (bk.title LIKE ?
        OR bk.author LIKE ?
        OR bk.isbn LIKE ?)
       ${visibilityFilter}
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
    `SELECT bk.id, bk.title, bk.material_type, ${hasActiveBookPolicy("bk")} AS has_active_policy,
       (SELECT COUNT(*) FROM book_copies bc JOIN copy_holdings h ON h.copy_id = bc.id
         WHERE bc.book_id = bk.id AND bc.deleted_at IS NULL AND bc.is_active = 1
           AND bc.condition IN ('good','damaged') AND ${hasAccession("bc", "h")}) AS registered_copy_count
     FROM books bk WHERE bk.id = ? AND bk.deleted_at IS NULL FOR UPDATE`,
    [bookId]
  );
  return book || null;
}

async function findActiveReservationByUserBook(userId, bookId, conn) {
  const [[reservation]] = await conn.query(
    `SELECT id FROM reservations
     WHERE user_id = ? AND book_id = ? AND status IN ('pending', 'ready')
       AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId, bookId]
  );
  return reservation || null;
}

async function findActiveBorrowingByUserBook(userId, bookId, conn) {
  const [[borrowing]] = await conn.query(
    `SELECT id FROM borrowings
      WHERE user_id = ? AND book_id = ? AND deleted_at IS NULL
        AND status IN ('borrowed','overdue') LIMIT 1 FOR UPDATE`,
    [userId, bookId],
  );
  return borrowing || null;
}

async function getOpenReservationCountForBook(bookId, conn) {
  const [[row]] = await conn.query(
    "SELECT COUNT(*) AS total FROM reservations WHERE book_id = ? AND status IN ('pending','ready') AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())",
    [bookId],
  );
  return Number(row.total || 0);
}

async function createReservation(userId, bookId, expiryHours, conn) {
  const [result] = await conn.query(
    `INSERT INTO reservations (user_id, book_id, status, expires_at)
     VALUES (?, ?, 'pending', TIMESTAMPADD(HOUR, ?, NOW()))`,
    [userId, bookId, expiryHours]
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
  const [result] = await conn.query(
    `UPDATE reservations SET status = 'cancelled', cancelled_at = NOW()
     WHERE id = ? AND status IN ('pending','ready') AND deleted_at IS NULL`,
    [reservationId]
  );
  return Number(result.affectedRows);
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
     LEFT JOIN copy_holdings h ON h.copy_id = r.reserved_copy_id
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
       h.location AS book_location,
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
    `SELECT r.id, r.book_id, r.user_id, r.status, r.expires_at,
            (r.expires_at IS NULL OR r.expires_at > NOW()) AS within_deadline, bk.title
       FROM reservations r JOIN books bk ON bk.id = r.book_id
      WHERE r.id = ? AND r.deleted_at IS NULL FOR UPDATE`,
    [reservationId]
  );
  return row || null;
}

async function findReservationBookId(reservationId, conn) {
  const [[row]] = await conn.query(
    "SELECT book_id FROM reservations WHERE id = ? AND deleted_at IS NULL",
    [reservationId],
  );
  return row || null;
}

async function findAvailableCopyForReservation(bookId, conn) {
  const [[copy]] = await conn.query(
    `SELECT bc.id
     FROM book_copies bc
     WHERE bc.book_id = ? AND ${availableToBorrow("bc")}
     LIMIT 1 FOR UPDATE`,
    [bookId]
  );
  return copy || null;
}

async function markReady(reservationId, copyId, pickupHours, conn) {
  const [result] = await conn.query(
    `UPDATE reservations SET status = 'ready', reserved_copy_id = ?,
       expires_at = TIMESTAMPADD(HOUR, ?, NOW())
     WHERE id = ? AND status = 'pending' AND deleted_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [copyId, pickupHours, reservationId]
  );
  return result.affectedRows;
}

async function findReservationForAudit(reservationId, conn) {
  const [[row]] = await conn.query(
    `SELECT r.id, r.book_id, r.user_id, r.status, r.reserved_copy_id, r.expires_at,
            bk.title, bc.barcode
       FROM reservations r JOIN books bk ON bk.id = r.book_id
       LEFT JOIN book_copies bc ON bc.id = r.reserved_copy_id
      WHERE r.id = ? LIMIT 1`,
    [reservationId],
  );
  return row || null;
}

async function findReservationForAdminCancel(reservationId, conn) {
  const [[row]] = await conn.query(
    `SELECT r.id, r.user_id, r.book_id, r.status, bk.title
       FROM reservations r JOIN books bk ON bk.id = r.book_id
      WHERE r.id = ? AND r.deleted_at IS NULL FOR UPDATE`,
    [reservationId]
  );
  return row || null;
}

async function cancelReservationAdmin(reservationId, conn) {
  const [result] = await conn.query(
    "UPDATE reservations SET status = 'cancelled', cancelled_at = NOW() WHERE id = ? AND status IN ('pending','ready') AND deleted_at IS NULL",
    [reservationId]
  );
  return result.affectedRows;
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
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[row]] = await conn.query(
      `SELECT r.id, r.status, r.deleted_at, bk.title
         FROM reservations r JOIN books bk ON bk.id = r.book_id
        WHERE r.id = ? FOR UPDATE`,
      [reservationId],
    );
    if (!row || row.deleted_at) throw Object.assign(new Error("Reservation not found"), { status: 404 });
    if (["pending", "ready"].includes(row.status)) throw Object.assign(new Error("Cancel or fulfil the reservation before archiving it"), { status: 409 });
    const [result] = await conn.query("UPDATE reservations SET deleted_at = NOW(), deleted_by = ? WHERE id = ? AND deleted_at IS NULL", [deletedBy, reservationId]);
    if (result.affectedRows !== 1) throw Object.assign(new Error("The reservation changed while being archived. Reload and try again."), { status: 409 });
    await enqueueAuditEvent(conn, {
      actorId: deletedBy,
      category: "reservation",
      action: "archived",
      description: `Archived reservation for “${row.title}”`,
      route: `/api/admin/reservations/${reservationId}`,
      metadata: { detail_status: "changes_captured", changes: [{ field: "Record state", before: "Active", after: "Archived" }], reservation_id: Number(reservationId) },
    });
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally { conn.release(); }
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
  findActiveBorrowingByUserBook,
  getOpenReservationCountForBook,
  createReservation,
  findReservationForUserCancel,
  cancelReservation,
  getAdminReservations,
  findReservationForReady,
  findReservationBookId,
  findAvailableCopyForReservation,
  markReady,
  findReservationForAudit,
  findReservationForAdminCancel,
  cancelReservationAdmin,
  findArchivedReservation,
  restoreReservation,
  archiveReservation,
};

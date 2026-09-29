import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  AdminReservationOptions,
  CatalogueSearchOptions,
  ReservationAdminCancelRow,
  ReservationAdminPage,
  ReservationAuditRow,
  ReservationBook,
  ReservationCancelRow,
  ReservationCopy,
  ReservationHistoryOptions,
  ReservationIdentity,
  ReservationNotificationTarget,
  ReservationReadyRow,
  ReservationRow,
  ExpiredReservationRow,
} from "./reservation.types";
const { normalizePagination } = require("../../middlewares/numericInput");

const db = require("../../db") as Pool;
const outboxRepository = require("../delivery-outbox/outbox.repository");
const { metadataValue } = require("../catalog/catalog.projection");
const { availableToBorrow, hasActiveBookPolicy, hasAccession } = require("../catalog/copyEligibility");
const { enqueueAuditEvent } = require("../analytics/analytics.audit.service");
const { copyLabel } = require("../analytics/audit.copy-label");

type QueryConnection = Pool | PoolConnection;

function getConnection(): Promise<PoolConnection> {
  return db.getConnection();
}

async function getReservationNotificationTarget(reservationId: number, conn: QueryConnection = db): Promise<ReservationNotificationTarget | null> {
  const [rows] = await conn.query<ReservationNotificationTarget[]>(
    `SELECT r.id, r.user_id, r.status, bk.title
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id AND bk.deleted_at IS NULL
     WHERE r.id = ? LIMIT 1`,
    [reservationId]
  );
  return rows[0] || null;
}

async function syncExpired(): Promise<ExpiredReservationRow[]> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [expiredRows] = await conn.query<ExpiredReservationRow[]>(
      `SELECT r.id, r.user_id, r.reserved_copy_id, bc.barcode, bk.title
         FROM reservations r
         JOIN books bk ON bk.id = r.book_id
         LEFT JOIN book_copies bc ON bc.id = r.reserved_copy_id
        WHERE r.status IN ('pending', 'ready') AND r.expires_at IS NOT NULL
          AND r.expires_at < NOW() AND r.deleted_at IS NULL
        ORDER BY r.id FOR UPDATE`,
    );
    const changedRows: ExpiredReservationRow[] = [];
    for (const row of expiredRows) {
      const [result] = await conn.query<ResultSetHeader>(
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

async function findActiveReservations(userId: number): Promise<RowDataPacket[]> {
  const [rows] = await db.query<RowDataPacket[]>(
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

async function findReservationHistory(userId: number, { page, limit }: ReservationHistoryOptions = {}): Promise<RowDataPacket[] | { rows: RowDataPacket[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const { paged, safePage, safeLimit, offset } = normalizePagination(page, limit, 20, 100);
  const [countRows] = paged
    ? await db.query<Array<RowDataPacket & { total: number | string }>>(
      `SELECT COUNT(*) AS total FROM reservations
       WHERE user_id = ? AND status IN ('cancelled', 'expired', 'fulfilled') AND deleted_at IS NULL`,
      [userId]
    )
    : [[{ total: 0 } as RowDataPacket & { total: number }]];
  const total = countRows[0].total;
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT r.id, bk.title, bk.author,
            r.status, r.reserved_at, r.expires_at,
            r.fulfilled_at, r.cancelled_at
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id
     WHERE r.user_id = ?
       AND r.status IN ('cancelled', 'expired', 'fulfilled')
       AND r.deleted_at IS NULL
     ORDER BY r.reserved_at DESC${paged ? " LIMIT ? OFFSET ?" : " LIMIT 50"}`,
    paged ? [userId, safeLimit, offset] : [userId]
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

async function searchCatalogue(query: string, { page, limit, showUnheldInOpac = true }: CatalogueSearchOptions = {}): Promise<RowDataPacket[] | { rows: RowDataPacket[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const like = `%${query}%`;
  const { paged, safePage, safeLimit, offset } = normalizePagination(page, limit, 20, 100);
  const visibilityFilter = showUnheldInOpac ? "" : `AND EXISTS (
    SELECT 1 FROM book_copies held_bc
     WHERE held_bc.book_id = bk.id AND held_bc.deleted_at IS NULL AND held_bc.is_active = 1
       AND held_bc.condition IN ('good','damaged') AND ${hasAccession("held_bc")}
  )`;
  const [countRows] = paged
      ? await db.query<Array<RowDataPacket & { total: number | string }>>(
        `SELECT COUNT(*) AS total FROM books bk
       WHERE bk.deleted_at IS NULL AND bk.material_type = 'book'
         AND (bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ?)
         ${visibilityFilter}`,
      [like, like, like]
    )
    : [[{ total: 0 } as RowDataPacket & { total: number }]];
  const total = countRows[0].total;
  const [rows] = await db.query<RowDataPacket[]>(
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
    paged ? [like, like, like, safeLimit, offset] : [like, like, like]
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

async function findBookForReservation(bookId: number, conn: PoolConnection): Promise<ReservationBook | null> {
  const [rows] = await conn.query<ReservationBook[]>(
    `SELECT bk.id, bk.title, bk.material_type, ${hasActiveBookPolicy("bk")} AS has_active_policy,
       (SELECT COUNT(*) FROM book_copies bc JOIN copy_holdings h ON h.copy_id = bc.id
         WHERE bc.book_id = bk.id AND bc.deleted_at IS NULL AND bc.is_active = 1
           AND bc.condition IN ('good','damaged') AND ${hasAccession("bc", "h")}) AS registered_copy_count
     FROM books bk WHERE bk.id = ? AND bk.deleted_at IS NULL FOR UPDATE`,
    [bookId]
  );
  return rows[0] || null;
}

async function findActiveReservationByUserBook(userId: number, bookId: number, conn: PoolConnection): Promise<(RowDataPacket & { id: number }) | null> {
  const [rows] = await conn.query<Array<RowDataPacket & { id: number }>>(
    `SELECT id FROM reservations
     WHERE user_id = ? AND book_id = ? AND status IN ('pending', 'ready')
       AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId, bookId]
  );
  return rows[0] || null;
}

async function findActiveBorrowingByUserBook(userId: number, bookId: number, conn: PoolConnection): Promise<(RowDataPacket & { id: number }) | null> {
  const [rows] = await conn.query<Array<RowDataPacket & { id: number }>>(
    `SELECT id FROM borrowings
      WHERE user_id = ? AND book_id = ? AND deleted_at IS NULL
        AND status IN ('borrowed','overdue') LIMIT 1 FOR UPDATE`,
    [userId, bookId],
  );
  return rows[0] || null;
}

async function getOpenReservationCountForBook(bookId: number, conn: PoolConnection): Promise<number> {
  const [rows] = await conn.query<Array<RowDataPacket & { total: number | string }>>(
    "SELECT COUNT(*) AS total FROM reservations WHERE book_id = ? AND status IN ('pending','ready') AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())",
    [bookId],
  );
  return Number(rows[0].total || 0);
}

async function createReservation(userId: number, bookId: number, expiryHours: number, conn: PoolConnection): Promise<ResultSetHeader> {
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO reservations (user_id, book_id, status, expires_at)
     VALUES (?, ?, 'pending', TIMESTAMPADD(HOUR, ?, NOW()))`,
    [userId, bookId, expiryHours]
  );
  return result;
}

async function findReservationForUserCancel(reservationId: number, conn: PoolConnection): Promise<ReservationCancelRow | null> {
  const [rows] = await conn.query<ReservationCancelRow[]>(
    `SELECT id, user_id, status FROM reservations
     WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
    [reservationId]
  );
  return rows[0] || null;
}

async function cancelReservation(reservationId: number, conn: PoolConnection): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(
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
}: AdminReservationOptions): Promise<ReservationAdminPage> {
  const offset = (page - 1) * limit;
  const conditions = [`r.deleted_at IS ${archived ? "NOT NULL" : "NULL"}`];
  const params: Array<string | number> = [];

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

  const [countRows] = await db.query<Array<RowDataPacket & { total: number | string }>>(
    `SELECT COUNT(*) AS total
     ${baseFromClause}`,
    params
  );

  const [summaryRows] = await db.query<Array<RowDataPacket & { total_records: number | string; pending_count: number | string | null; ready_count: number | string | null; fulfilled_count: number | string | null; cancelled_count: number | string | null; expired_count: number | string | null }>>(
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

  const [rows] = await db.query<RowDataPacket[]>(
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
    total: countRows[0].total,
    page,
    totalPages: Math.ceil(Number(countRows[0].total) / limit),
    summary: {
      total_records: Number(summaryRows[0]?.total_records ?? 0),
      pending_count: Number(summaryRows[0]?.pending_count ?? 0),
      ready_count: Number(summaryRows[0]?.ready_count ?? 0),
      fulfilled_count: Number(summaryRows[0]?.fulfilled_count ?? 0),
      cancelled_count: Number(summaryRows[0]?.cancelled_count ?? 0),
      expired_count: Number(summaryRows[0]?.expired_count ?? 0),
    },
  };
}

async function findReservationForReady(reservationId: number, conn: PoolConnection): Promise<ReservationReadyRow | null> {
  const [rows] = await conn.query<ReservationReadyRow[]>(
    `SELECT r.id, r.book_id, r.user_id, r.status, r.expires_at,
            (r.expires_at IS NULL OR r.expires_at > NOW()) AS within_deadline, bk.title
       FROM reservations r JOIN books bk ON bk.id = r.book_id
      WHERE r.id = ? AND r.deleted_at IS NULL FOR UPDATE`,
    [reservationId]
  );
  return rows[0] || null;
}

async function findReservationBookId(reservationId: number, conn: PoolConnection): Promise<ReservationIdentity | null> {
  const [rows] = await conn.query<ReservationIdentity[]>(
    "SELECT book_id FROM reservations WHERE id = ? AND deleted_at IS NULL",
    [reservationId],
  );
  return rows[0] || null;
}

async function findAvailableCopyForReservation(bookId: number, conn: PoolConnection): Promise<ReservationCopy | null> {
  const [rows] = await conn.query<ReservationCopy[]>(
    `SELECT bc.id
     FROM book_copies bc
     WHERE bc.book_id = ? AND ${availableToBorrow("bc")}
     LIMIT 1 FOR UPDATE`,
    [bookId]
  );
  return rows[0] || null;
}

async function markReady(reservationId: number, copyId: number, pickupHours: number, conn: PoolConnection): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(
    `UPDATE reservations SET status = 'ready', reserved_copy_id = ?,
       expires_at = TIMESTAMPADD(HOUR, ?, NOW())
     WHERE id = ? AND status = 'pending' AND deleted_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [copyId, pickupHours, reservationId]
  );
  return result.affectedRows;
}

async function findReservationForAudit(reservationId: number, conn: PoolConnection): Promise<ReservationAuditRow | null> {
  const [rows] = await conn.query<ReservationAuditRow[]>(
    `SELECT r.id, r.book_id, r.user_id, r.status, r.reserved_copy_id, r.expires_at,
            bk.title, bc.barcode
       FROM reservations r JOIN books bk ON bk.id = r.book_id
       LEFT JOIN book_copies bc ON bc.id = r.reserved_copy_id
      WHERE r.id = ? LIMIT 1`,
    [reservationId],
  );
  return rows[0] || null;
}

async function findReservationForAdminCancel(reservationId: number, conn: PoolConnection): Promise<ReservationAdminCancelRow | null> {
  const [rows] = await conn.query<ReservationAdminCancelRow[]>(
    `SELECT r.id, r.user_id, r.book_id, r.status, bk.title
       FROM reservations r JOIN books bk ON bk.id = r.book_id
      WHERE r.id = ? AND r.deleted_at IS NULL FOR UPDATE`,
    [reservationId]
  );
  return rows[0] || null;
}

async function cancelReservationAdmin(reservationId: number, conn: PoolConnection): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(
    "UPDATE reservations SET status = 'cancelled', cancelled_at = NOW() WHERE id = ? AND status IN ('pending','ready') AND deleted_at IS NULL",
    [reservationId]
  );
  return result.affectedRows;
}

async function findArchivedReservation(reservationId: number, conn: PoolConnection): Promise<(RowDataPacket & { id: number }) | null> {
  const [rows] = await conn.query<Array<RowDataPacket & { id: number }>>(
    "SELECT id FROM reservations WHERE id = ? AND deleted_at IS NOT NULL FOR UPDATE",
    [reservationId]
  );
  return rows[0] || null;
}

async function restoreReservation(reservationId: number, conn: PoolConnection): Promise<void> {
  await conn.query(
    "UPDATE reservations SET deleted_at = NULL, deleted_by = NULL WHERE id = ?",
    [reservationId]
  );
}

async function archiveReservation(reservationId: number, deletedBy: number): Promise<void> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<Array<RowDataPacket & { id: number; status: string; deleted_at: Date | string | null; title: string }>>(
      `SELECT r.id, r.status, r.deleted_at, bk.title
         FROM reservations r JOIN books bk ON bk.id = r.book_id
        WHERE r.id = ? FOR UPDATE`,
      [reservationId],
    );
    const [row] = rows;
    if (!row || row.deleted_at) throw Object.assign(new Error("Reservation not found"), { status: 404 });
    if (["pending", "ready"].includes(row.status)) throw Object.assign(new Error("Cancel or fulfil the reservation before archiving it"), { status: 409 });
    const [result] = await conn.query<ResultSetHeader>("UPDATE reservations SET deleted_at = NOW(), deleted_by = ? WHERE id = ? AND deleted_at IS NULL", [deletedBy, reservationId]);
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

export = {
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

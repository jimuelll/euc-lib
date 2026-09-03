const db = require("../../db");
const { mapBorrowingsWithFineDetails, syncOverdueBorrowings } = require("../borrowing/overdue.helper");
const { syncExpired } = require("../reservation/reservation.service");
const { getActiveSubscriptions } = require("../subscriptions/subscriptions.service");
const notificationsService = require("../notifications/notifications.service");

const getUserProfile = async (userId) => {
  const [[user]] = await db.query(
    `SELECT id, name, role, student_employee_id, email, profile_picture, address, contact
     FROM users
     WHERE id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [userId]
  );

  return user ?? null;
};

const getActiveBorrows = async (userId) => {
  const [rows] = await db.query(
    `SELECT
       b.id,
       bk.title,
       bk.author,
       bk.category,
       bk.location,
       b.borrowed_at,
       b.due_date,
       b.status,
       b.notes,
       bc.barcode AS copy_barcode
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id
     LEFT JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
     WHERE b.user_id = ?
       AND b.status IN ('borrowed', 'overdue')
       AND b.deleted_at IS NULL
     ORDER BY b.due_date ASC, b.borrowed_at DESC`,
    [userId]
  );

  return mapBorrowingsWithFineDetails(rows);
};

const getBorrowHistory = async (userId) => {
  const [rows] = await db.query(
    `SELECT
       b.id,
       bk.title,
       bk.author,
       b.borrowed_at,
       b.returned_at,
       b.due_date,
       b.status,
       bc.barcode AS copy_barcode
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id
     LEFT JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
     WHERE b.user_id = ?
       AND b.status = 'returned'
       AND b.deleted_at IS NULL
     ORDER BY b.returned_at DESC
     LIMIT 50`,
    [userId]
  );

  return rows;
};

const getActiveReservations = async (userId) => {
  const [rows] = await db.query(
    `SELECT
       r.id,
       bk.title,
       bk.author,
       bk.location,
       r.status,
       r.reserved_at,
       r.expires_at,
       r.notes
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id
     WHERE r.user_id = ?
       AND r.status IN ('pending', 'ready')
       AND r.deleted_at IS NULL
     ORDER BY r.reserved_at DESC`,
    [userId]
  );

  return rows;
};

const getReservationHistory = async (userId) => {
  const [rows] = await db.query(
    `SELECT
       r.id,
       bk.title,
       bk.author,
       r.status,
       r.reserved_at,
       r.expires_at,
       r.fulfilled_at,
       r.cancelled_at
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id
     WHERE r.user_id = ?
       AND r.status IN ('cancelled', 'expired', 'fulfilled')
       AND r.deleted_at IS NULL
     ORDER BY r.reserved_at DESC
     LIMIT 50`,
    [userId]
  );

  return rows;
};

const getAttendanceLogs = async (userId) => {
  const [rows] = await db.query(
    `SELECT id, type, created_at AS timestamp
     FROM attendance_logs
     WHERE user_id = ?
       AND purpose = 'entry_exit'
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId]
  );

  return rows;
};

const getHistory = async (userId, { page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const [[{ total }]] = await db.query(
    `SELECT (
       (SELECT COUNT(*) FROM borrowings WHERE user_id = ? AND status = 'returned' AND deleted_at IS NULL) +
       (SELECT COUNT(*) FROM reservations WHERE user_id = ? AND status IN ('cancelled', 'expired', 'fulfilled') AND deleted_at IS NULL)
     ) AS total`,
    [userId, userId]
  );
  const [rows] = await db.query(
    `SELECT * FROM (
       SELECT b.id, bk.title, bk.author, 'borrowing' AS kind, b.status,
              b.returned_at AS occurred_at, b.borrowed_at, b.returned_at, NULL AS reserved_at
       FROM borrowings b
       JOIN books bk ON bk.id = b.book_id
       WHERE b.user_id = ? AND b.status = 'returned' AND b.deleted_at IS NULL
       UNION ALL
       SELECT r.id, bk.title, bk.author, 'reservation' AS kind, r.status,
              COALESCE(r.fulfilled_at, r.cancelled_at, r.reserved_at) AS occurred_at,
              NULL AS borrowed_at, NULL AS returned_at, r.reserved_at
       FROM reservations r
       JOIN books bk ON bk.id = r.book_id
       WHERE r.user_id = ? AND r.status IN ('cancelled', 'expired', 'fulfilled') AND r.deleted_at IS NULL
     ) AS history
     ORDER BY occurred_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [userId, userId, safeLimit, (safePage - 1) * safeLimit]
  );
  return { rows, pagination: { page: safePage, limit: safeLimit, total: Number(total), totalPages: Math.ceil(Number(total) / safeLimit) } };
};

const toIsoDate = (value) => {
  if (!value) return null;
  return new Date(value).toISOString();
};

const buildAttendanceSessions = (logs) => {
  const chronological = [...logs].reverse();
  const sessions = [];
  let openSession = null;

  for (const log of chronological) {
    if (log.type === "check_in") {
      if (openSession) {
        sessions.push(openSession);
      }

      openSession = {
        date: toIsoDate(log.timestamp),
        time_in: toIsoDate(log.timestamp),
        time_out: null,
      };
      continue;
    }

    if (log.type === "check_out") {
      if (openSession) {
        openSession.time_out = toIsoDate(log.timestamp);
        sessions.push(openSession);
        openSession = null;
      } else {
        sessions.push({
          date: toIsoDate(log.timestamp),
          time_in: null,
          time_out: toIsoDate(log.timestamp),
        });
      }
    }
  }

  if (openSession) {
    sessions.push(openSession);
  }

  return sessions.reverse();
};

const getAttendanceHistory = async (userId, { page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const [logs] = await db.query(
    `SELECT id, type, created_at AS timestamp
     FROM attendance_logs
     WHERE user_id = ? AND purpose = 'entry_exit'
     ORDER BY created_at DESC`,
    [userId]
  );
  const sessions = buildAttendanceSessions(logs);
  return {
    rows: sessions.slice((safePage - 1) * safeLimit, safePage * safeLimit),
    pagination: { page: safePage, limit: safeLimit, total: sessions.length, totalPages: Math.ceil(sessions.length / safeLimit) },
  };
};

const getDashboard = async (userId) => {
  await Promise.all([syncOverdueBorrowings(), syncExpired()]);

  const profile = await getUserProfile(userId);

  const [
    activeBorrows,
    borrowHistory,
    activeReservations,
    reservationHistory,
    attendanceLogs,
    subscriptions,
    notifications,
  ] = await Promise.all([
    getActiveBorrows(userId),
    getBorrowHistory(userId),
    getActiveReservations(userId),
    getReservationHistory(userId),
    getAttendanceLogs(userId),
    getActiveSubscriptions(),
    notificationsService.listForUser({ userId, role: profile?.role ?? "student", limit: 6 }),
  ]);

  const dueSoonCount = activeBorrows.filter((borrow) => {
    if (!borrow.due_date || borrow.status === "overdue") return false;
    const dueDate = new Date(borrow.due_date);
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue <= 3;
  }).length;

  const readyReservationsCount = activeReservations.filter(
    (reservation) => reservation.status === "ready"
  ).length;

  return {
    profile,
    summary: {
      active_borrows: activeBorrows.length,
      overdue_borrows: activeBorrows.filter((borrow) => borrow.status === "overdue").length,
      due_soon_borrows: dueSoonCount,
      total_fines_due: Number(
        activeBorrows.reduce((sum, borrow) => sum + Number(borrow.fine_amount || 0), 0).toFixed(2)
      ),
      active_reservations: activeReservations.length,
      ready_reservations: readyReservationsCount,
      attendance_logs: attendanceLogs.length,
    },
    active_borrows: activeBorrows,
    borrow_history: borrowHistory,
    active_reservations: activeReservations,
    reservation_history: reservationHistory,
    attendance_sessions: buildAttendanceSessions(attendanceLogs).slice(0, 8),
    subscriptions: subscriptions.slice(0, 3),
    notifications,
  };
};

module.exports = {
  getDashboard,
  getHistory,
  getAttendanceHistory,
};

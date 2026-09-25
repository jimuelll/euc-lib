const repository = require("./my-library.repository");
const { mapBorrowingsWithFineDetails, syncOverdueBorrowings } = require("../borrowing/overdue.helper");
const { syncExpired } = require("../reservation/reservation.service");
const { getActiveSubscriptions } = require("../subscriptions/subscriptions.service");
const notificationsService = require("../notifications/notifications.service");

const getUserProfile = async (userId) => repository.findUserProfile(userId);
const getUserBarcode = async (userId) => repository.findUserBarcode(userId);

const getActiveBorrows = async (userId) =>
  mapBorrowingsWithFineDetails(await repository.findActiveBorrows(userId));

const getBorrowHistory = async (userId) => repository.findBorrowHistory(userId);
const getActiveReservations = async (userId) => repository.findActiveReservations(userId);
const getReservationHistory = async (userId) => repository.findReservationHistory(userId);
const getAttendanceLogs = async (userId) => repository.findAttendanceLogs(userId);

const getHistory = async (userId, { page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const result = await repository.getHistory(userId, safePage, safeLimit);
  return {
    rows: result.rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: result.total,
      totalPages: Math.ceil(result.total / safeLimit),
    },
  };
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
      if (openSession) sessions.push(openSession);
      openSession = { date: toIsoDate(log.timestamp), time_in: toIsoDate(log.timestamp), time_out: null };
      continue;
    }
    if (log.type === "check_out") {
      if (openSession) {
        openSession.time_out = toIsoDate(log.timestamp);
        sessions.push(openSession);
        openSession = null;
      } else {
        sessions.push({ date: toIsoDate(log.timestamp), time_in: null, time_out: toIsoDate(log.timestamp) });
      }
    }
  }
  if (openSession) sessions.push(openSession);
  return sessions.reverse();
};

const getAttendanceHistory = async (userId, { page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const sessions = buildAttendanceSessions(await repository.findAllAttendanceLogs(userId));
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
    const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilDue <= 3;
  }).length;
  const readyReservationsCount = activeReservations.filter((reservation) => reservation.status === "ready").length;

  return {
    profile,
    summary: {
      active_borrows: activeBorrows.length,
      overdue_borrows: activeBorrows.filter((borrow) => borrow.status === "overdue").length,
      due_soon_borrows: dueSoonCount,
      total_fines_due: Number(activeBorrows.reduce((sum, borrow) => sum + Number(borrow.fine_amount || 0), 0).toFixed(2)),
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

module.exports = { getDashboard, getHistory, getAttendanceHistory, getUserBarcode };

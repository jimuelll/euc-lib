import repository = require("./my-library.repository");
import overdueHelper = require("../borrowing/overdue.helper");
import reservationService = require("../reservation/reservation.service");
import subscriptionService = require("../subscriptions/subscriptions.service");
import notificationsService = require("../notifications/notifications.service");
import type {
  ActiveBorrowRow,
  ActiveReservationRow,
  AttendanceLogRow,
  AttendanceSession,
  PaginationOptions,
} from "./my-library.types";

const { mapBorrowingsWithFineDetails, syncOverdueBorrowings } = overdueHelper;
const { syncExpired } = reservationService;
const { getActiveSubscriptions } = subscriptionService;

const getUserProfile = async (userId: number) => repository.findUserProfile(userId);
const getUserBarcode = async (userId: number) => repository.findUserBarcode(userId);
const getActiveBorrows = async (userId: number): Promise<ActiveBorrowRow[]> =>
  mapBorrowingsWithFineDetails(await repository.findActiveBorrows(userId));
const getBorrowHistory = async (userId: number) => repository.findBorrowHistory(userId);
const getActiveReservations = async (userId: number) => repository.findActiveReservations(userId);
const getReservationHistory = async (userId: number) => repository.findReservationHistory(userId);
const getAttendanceLogs = async (userId: number) => repository.findAttendanceLogs(userId);

const getHistory = async (userId: number, { page = 1, limit = 20 }: PaginationOptions = {}) => {
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

const toIsoDate = (value: Date | string | null): string | null => {
  if (!value) return null;
  return new Date(value as string).toISOString();
};

const buildAttendanceSessions = (logs: AttendanceLogRow[]): AttendanceSession[] => {
  const chronological = [...logs].reverse();
  const sessions: AttendanceSession[] = [];
  let openSession: AttendanceSession | null = null;

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

const getAttendanceHistory = async (userId: number, { page = 1, limit = 20 }: PaginationOptions = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const sessions = buildAttendanceSessions(await repository.findAllAttendanceLogs(userId));
  return {
    rows: sessions.slice((safePage - 1) * safeLimit, safePage * safeLimit),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: sessions.length,
      totalPages: Math.ceil(sessions.length / safeLimit),
    },
  };
};

const getDashboard = async (userId: number) => {
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
  ] as const);

  const dueSoonCount = activeBorrows.filter((borrow: ActiveBorrowRow) => {
    if (!borrow.due_date || borrow.status === "overdue") return false;
    const dueDate = new Date(borrow.due_date as string);
    const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilDue <= 3;
  }).length;
  const readyReservationsCount = activeReservations.filter((reservation: ActiveReservationRow) => reservation.status === "ready").length;

  return {
    profile,
    summary: {
      active_borrows: activeBorrows.length,
      overdue_borrows: activeBorrows.filter((borrow: ActiveBorrowRow) => borrow.status === "overdue").length,
      due_soon_borrows: dueSoonCount,
      total_fines_due: Number(activeBorrows.reduce((sum: number, borrow: ActiveBorrowRow) => sum + Number(borrow.fine_amount || 0), 0).toFixed(2)),
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

export = { getDashboard, getHistory, getAttendanceHistory, getUserBarcode };

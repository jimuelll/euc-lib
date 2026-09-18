const repository = require("./attendance.repository");

const recordScan = async ({ scannedId, type, scannedBy, ipAddress }) => {
  if (!scannedId || scannedId === "null") {
    throw Object.assign(new Error("Invalid scanned ID"), { status: 400 });
  }

  const user = await repository.resolveUser(scannedId);
  if (!user) throw Object.assign(new Error("ID not recognised — user not found"), { status: 404 });

  const lockName = `att_scan_${user.id}`;
  if (!(await repository.acquireScanLock(lockName))) {
    throw Object.assign(new Error("Could not acquire scan lock — please try again"), { status: 503 });
  }

  try {
    const lastLog = await repository.getLatestEntryExitLog(user.id);
    if (lastLog?.type === type) {
      const isCheckIn = type === "check_in";
      throw Object.assign(
        new Error(isCheckIn ? `${user.name} is already timed in for today.` : `${user.name} is already timed out for today.`),
        {
          status: 409,
          code: isCheckIn ? "ALREADY_TIMED_IN" : "ALREADY_TIMED_OUT",
          user: { id: user.id, name: user.name, student_employee_id: user.student_employee_id },
          type,
        },
      );
    }
    await repository.insertScan({ userId: user.id, scannedId, type, scannedBy, ipAddress });
  } finally {
    await repository.releaseScanLock(lockName);
  }

  return {
    type,
    user: { id: user.id, name: user.name, student_employee_id: user.student_employee_id },
  };
};

const getTodayLogs = async ({ limit = 100, lastId = null } = {}) => {
  const safeLimit = Math.min(Math.max(1, Number(limit) || 100), 200);
  return repository.getTodayLogs({ limit: safeLimit, lastId });
};

const getLogs = async ({ page = 1, limit = 25, search = "", type = "all", purpose = "all", dateFrom = "", dateTo = "" } = {}) => {
  const result = await repository.getLogs({ page, limit, search, type, purpose, dateFrom, dateTo });
  const total = result.total;
  return {
    rows: result.rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    summary: {
      total_records: Number(result.summary?.total_records ?? 0),
      check_in_count: Number(result.summary?.check_in_count ?? 0),
      check_out_count: Number(result.summary?.check_out_count ?? 0),
      unique_users: Number(result.summary?.unique_users ?? 0),
      borrowing_scan_count: Number(result.summary?.borrowing_scan_count ?? 0),
    },
  };
};

const getSessionsForDate = async (date) => {
  if (!date) return [];
  const rows = await repository.getSessionsForDate(date);
  return rows.map((row) => ({
    ...row,
    duration_minutes: row.checked_out_at
      ? Math.max(0, Math.round((new Date(row.checked_out_at) - new Date(row.checked_in_at)) / 60000))
      : null,
    status: row.checked_out_at ? "complete" : "incomplete",
  }));
};

const getMyLogs = async (userId, { page, limit } = {}) => {
  const paged = Number.isFinite(Number(page));
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const result = await repository.getMyLogs(userId, {
    paged,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  });
  return paged
    ? { rows: result.rows, pagination: { page: safePage, limit: safeLimit, total: result.total, totalPages: Math.ceil(result.total / safeLimit) } }
    : result.rows;
};

module.exports = { recordScan, getTodayLogs, getLogs, getSessionsForDate, getMyLogs };

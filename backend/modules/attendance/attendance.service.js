const db = require("../../db");

/**
 * Resolve a user from either their barcode or student_employee_id.
 */
const resolveUser = async (scannedId) => {
  const [[user]] = await db.query(
    `SELECT id, name, role, student_employee_id, barcode
     FROM users
     WHERE (barcode = ? OR student_employee_id = ?)
       AND is_active = 1
     LIMIT 1`,
    [scannedId, scannedId]
  );
  return user ?? null;
};

/**
 * Record a check-in or check-out.
 *
 * Uses GET_LOCK per user to prevent race conditions where two simultaneous
 * scans both pass the "last log" check before either inserts.
 *
 * Business rule: a user cannot check-in twice in a row without checking out,
 * and vice versa. We look at the most recent log to enforce this.
 */
const recordScan = async ({ scannedId, type, scannedBy, ipAddress }) => {
  // FIX: Guard against null/empty scannedId reaching the resolver
  if (!scannedId || scannedId === "null") {
    throw Object.assign(new Error("Invalid scanned ID"), { status: 400 });
  }

  const user = await resolveUser(scannedId);
  if (!user) {
    throw Object.assign(new Error("ID not recognised — user not found"), { status: 404 });
  }

  // FIX: Use GET_LOCK to serialize concurrent scans for the same user,
  // preventing the race condition where two requests both pass the duplicate check.
  const lockName = `att_scan_${user.id}`;
  const [[lockRow]] = await db.query("SELECT GET_LOCK(?, 5) AS acquired", [lockName]);
  if (!lockRow.acquired) {
    throw Object.assign(new Error("Could not acquire scan lock — please try again"), { status: 503 });
  }

  try {
    // FIX: Use a range query on created_at instead of DATE(created_at) = CURDATE()
    // so the composite index idx_user_date (user_id, created_at) can be used efficiently.
    const [[lastLog]] = await db.query(
      `SELECT type FROM attendance_logs
       WHERE user_id = ?
         AND created_at >= CURDATE()
         AND created_at < CURDATE() + INTERVAL 1 DAY
         AND purpose = 'entry_exit'
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id]
    );

    // Prevent duplicate consecutive check-in / check-out
    if (lastLog?.type === type) {
      const isCheckIn = type === "check_in";
      throw Object.assign(
        new Error(
          isCheckIn
            ? `${user.name} is already timed in for today.`
            : `${user.name} is already timed out for today.`
        ),
        {
          status: 409,
          code: isCheckIn ? "ALREADY_TIMED_IN" : "ALREADY_TIMED_OUT",
          user: {
            id: user.id,
            name: user.name,
            student_employee_id: user.student_employee_id,
          },
          type,
        }
      );
    }

    await db.query(
      `INSERT INTO attendance_logs
         (user_id, scanned_id, type, purpose, scanned_by, ip_address)
       VALUES (?, ?, ?, 'entry_exit', ?, ?)`,
      [user.id, scannedId, type, scannedBy ?? null, ipAddress ?? null]
    );
  } finally {
    // Always release the lock, even if an error was thrown
    await db.query("SELECT RELEASE_LOCK(?)", [lockName]);
  }

  return {
    type,
    user: {
      id: user.id,
      name: user.name,
      student_employee_id: user.student_employee_id,
    },
  };
};

/**
 * All entry/exit logs for today (scanner / admin dashboard use).
 * FIX: Added cursor-based pagination via `lastId` to prevent unbounded result sets.
 *      Uses range query on created_at to leverage the idx_user_date index.
 *
 * @param {object} options
 * @param {number} [options.limit=100]   - Max rows to return
 * @param {number} [options.lastId=null] - Cursor: return rows with id < lastId (older)
 */
const getTodayLogs = async ({ limit = 100, lastId = null } = {}) => {
  const params = [];
  let cursorClause = "";

  if (lastId) {
    cursorClause = "AND al.id < ?";
    params.push(lastId);
  }

  // Cap limit to 200 to prevent accidental large fetches
  const safeLimit = Math.min(Math.max(1, Number(limit) || 100), 200);
  params.push(safeLimit);

  const [rows] = await db.query(
    `SELECT
       al.id,
       al.type,
       al.created_at AS timestamp,
       u.name,
       u.student_employee_id,
       u.role
     FROM attendance_logs al
     JOIN users u ON u.id = al.user_id
     WHERE al.created_at >= CURDATE()
       AND al.created_at < CURDATE() + INTERVAL 1 DAY
       AND al.purpose = 'entry_exit'
       ${cursorClause}
     ORDER BY al.created_at DESC
     LIMIT ?`,
    params
  );
  return rows;
};

/**
 * Logged-in user's own attendance history.
 */
const getMyLogs = async (userId) => {
  const [rows] = await db.query(
    `SELECT id, type, created_at AS timestamp
     FROM attendance_logs
     WHERE user_id = ? AND purpose = 'entry_exit'
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId]
  );
  return rows;
};

module.exports = { recordScan, getTodayLogs, getMyLogs };

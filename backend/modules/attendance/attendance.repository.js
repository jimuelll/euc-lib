const db = require("../../db");

const resolveUser = async (scannedId) => {
  const [[user]] = await db.query(
    `SELECT id, name, role, student_employee_id, barcode
       FROM users
      WHERE (barcode = ? OR student_employee_id = ?)
        AND is_active = 1
      LIMIT 1`,
    [scannedId, scannedId],
  );
  return user ?? null;
};

const acquireScanLock = async (lockName) => {
  const [[row]] = await db.query("SELECT GET_LOCK(?, 5) AS acquired", [lockName]);
  return Boolean(row?.acquired);
};

const getLatestEntryExitLog = async (userId) => {
  const [[row]] = await db.query(
    `SELECT type FROM attendance_logs
      WHERE user_id = ?
        AND created_at >= CURDATE()
        AND created_at < CURDATE() + INTERVAL 1 DAY
        AND purpose = 'entry_exit'
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId],
  );
  return row ?? null;
};

const insertScan = async ({ userId, scannedId, type, scannedBy, ipAddress }) => {
  await db.query(
    `INSERT INTO attendance_logs
      (user_id, scanned_id, type, purpose, scanned_by, ip_address)
     VALUES (?, ?, ?, 'entry_exit', ?, ?)`,
    [userId, scannedId, type, scannedBy ?? null, ipAddress ?? null],
  );
};

const releaseScanLock = (lockName) => db.query("SELECT RELEASE_LOCK(?)", [lockName]);

const getTodayLogs = async ({ limit, lastId = null }) => {
  const params = [];
  const cursorClause = lastId ? "AND al.id < ?" : "";
  if (lastId) params.push(lastId);
  params.push(limit);
  const [rows] = await db.query(
    `SELECT al.id, al.type, al.created_at AS timestamp,
            u.name, u.student_employee_id, u.role
       FROM attendance_logs al
       JOIN users u ON u.id = al.user_id
      WHERE al.created_at >= CURDATE()
        AND al.created_at < CURDATE() + INTERVAL 1 DAY
        AND al.purpose = 'entry_exit'
        ${cursorClause}
      ORDER BY al.created_at DESC
      LIMIT ?`,
    params,
  );
  return rows;
};

const getLogs = async ({ page, limit, search = "", type = "all", purpose = "all", dateFrom = "", dateTo = "" }) => {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  if (type && type !== "all") { conditions.push("al.type = ?"); params.push(type); }
  if (purpose && purpose !== "all") { conditions.push("al.purpose = ?"); params.push(purpose); }
  if (dateFrom) { conditions.push("al.created_at >= ?"); params.push(`${dateFrom} 00:00:00`); }
  if (dateTo) { conditions.push("al.created_at < DATE_ADD(?, INTERVAL 1 DAY)"); params.push(dateTo); }
  if (search.trim()) {
    const like = `%${search.trim()}%`;
    conditions.push(`(u.name LIKE ? OR u.student_employee_id LIKE ? OR al.scanned_id LIKE ? OR scanner.name LIKE ?)`);
    params.push(like, like, like, like);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const baseFromClause = `
    FROM attendance_logs al
    JOIN users u ON u.id = al.user_id
    LEFT JOIN users scanner ON scanner.id = al.scanned_by
    ${whereClause}`;

  const [[totalRow]] = await db.query(`SELECT COUNT(*) AS total ${baseFromClause}`, params);
  const [[summaryRow]] = await db.query(
    `SELECT COUNT(*) AS total_records,
            SUM(CASE WHEN al.type = 'check_in' THEN 1 ELSE 0 END) AS check_in_count,
            SUM(CASE WHEN al.type = 'check_out' THEN 1 ELSE 0 END) AS check_out_count,
            COUNT(DISTINCT al.user_id) AS unique_users,
            SUM(CASE WHEN al.purpose = 'borrowing' THEN 1 ELSE 0 END) AS borrowing_scan_count
       ${baseFromClause}`,
    params,
  );
  const [rows] = await db.query(
    `SELECT al.id, al.type, al.purpose, al.scanned_id,
            al.created_at AS timestamp, u.name, u.student_employee_id,
            u.role, scanner.name AS scanned_by_name
       ${baseFromClause}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return { rows, total: Number(totalRow?.total ?? 0), summary: summaryRow };
};

const getSessionsForDate = async (date) => {
  const [rows] = await db.query(
    `SELECT in_log.id, u.name, u.student_employee_id,
            in_log.created_at AS checked_in_at,
            (SELECT out_log.created_at
               FROM attendance_logs out_log
              WHERE out_log.user_id = in_log.user_id
                AND out_log.purpose = 'entry_exit'
                AND out_log.type = 'check_out'
                AND out_log.created_at > in_log.created_at
                AND out_log.created_at < DATE_ADD(?, INTERVAL 1 DAY)
                AND NOT EXISTS (
                  SELECT 1 FROM attendance_logs next_in
                   WHERE next_in.user_id = in_log.user_id
                     AND next_in.purpose = 'entry_exit'
                     AND next_in.type = 'check_in'
                     AND next_in.created_at > in_log.created_at
                     AND next_in.created_at < out_log.created_at
                )
              ORDER BY out_log.created_at ASC LIMIT 1) AS checked_out_at
       FROM attendance_logs in_log
       JOIN users u ON u.id = in_log.user_id
      WHERE in_log.purpose = 'entry_exit'
        AND in_log.type = 'check_in'
        AND in_log.created_at >= ?
        AND in_log.created_at < DATE_ADD(?, INTERVAL 1 DAY)
      ORDER BY in_log.created_at ASC`,
    [date, date, date],
  );
  return rows;
};

const getMyLogs = async (userId, { paged, limit, offset }) => {
  const [[{ total }]] = paged
    ? await db.query("SELECT COUNT(*) AS total FROM attendance_logs WHERE user_id = ? AND purpose = 'entry_exit'", [userId])
    : [[{ total: 0 }]];
  const [rows] = await db.query(
    `SELECT id, type, created_at AS timestamp
       FROM attendance_logs
      WHERE user_id = ? AND purpose = 'entry_exit'
      ORDER BY created_at DESC${paged ? " LIMIT ? OFFSET ?" : " LIMIT 100"}`,
    paged ? [userId, limit, offset] : [userId],
  );
  return { rows, total: Number(total) };
};

module.exports = {
  resolveUser,
  acquireScanLock,
  getLatestEntryExitLog,
  insertScan,
  releaseScanLock,
  getTodayLogs,
  getLogs,
  getSessionsForDate,
  getMyLogs,
};

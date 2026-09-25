const db = require("../../db");
const { availableToBorrow, hasAccession } = require("../catalog/copyEligibility");
const { enrichCopyAuditRows } = require("./audit.copy-label");
const { enrichAuditLookupRows } = require("./audit.lookup-labels");
const AUDIT_CATEGORIES = ["all", "auth", "users", "catalog", "academic_settings", "attendance", "borrowing", "reservation", "bulletin", "events", "content", "subscriptions", "notifications", "backup", "clearance", "system"];
const AUDIT_COLLATION = "utf8mb4_unicode_ci";

async function recordSiteVisit({ visitorId, userId = null, path = "/", ipAddress = null, userAgent = null }) {
  await db.query(
    `INSERT INTO site_daily_visits
       (visit_date, visitor_id, user_id, first_path, last_path, first_visited_at, last_visited_at, hit_count, ip_address, user_agent)
     VALUES
       (CURDATE(), ?, ?, ?, ?, NOW(), NOW(), 1, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = COALESCE(VALUES(user_id), user_id),
       last_path = VALUES(last_path),
       last_visited_at = NOW(),
       hit_count = hit_count + 1,
       ip_address = VALUES(ip_address),
       user_agent = VALUES(user_agent)`,
    [visitorId, userId, path, path, ipAddress, userAgent]
  );
}

async function hasRecordedActivity({ startAt, nextAt, date }) {
  const [[row]] = await db.query(
    `SELECT (
       EXISTS(SELECT 1 FROM borrowings WHERE
         (borrowed_at >= ? AND borrowed_at < ?) OR (returned_at >= ? AND returned_at < ?)
       ) OR EXISTS(SELECT 1 FROM fine_ledger_entries WHERE effective_at >= ? AND effective_at < ?)
       OR EXISTS(SELECT 1 FROM reservations WHERE
         (reserved_at >= ? AND reserved_at < ?) OR (fulfilled_at >= ? AND fulfilled_at < ?) OR (cancelled_at >= ? AND cancelled_at < ?)
       )) OR EXISTS(SELECT 1 FROM attendance_logs WHERE created_at >= ? AND created_at < ?)
       OR EXISTS(SELECT 1 FROM site_daily_visits WHERE visit_date = ?)
     ) AS recorded`,
    [startAt, nextAt, startAt, nextAt, startAt, nextAt, startAt, nextAt, startAt, nextAt, startAt, nextAt, startAt, nextAt, date]
  );
  return Boolean(Number(row?.recorded));
}

async function recordAuditEvent({ actorId = null, actorName = null, actorRole = null, category, action, description, route = null, metadata = null, eventKey = null }) {
  if (actorId) {
    const [[actor]] = await db.query("SELECT name, role FROM users WHERE id = ? LIMIT 1", [actorId]);
    actorName ||= actor?.name ?? null;
    actorRole ||= actor?.role ?? null;
  }
  await db.query(
    `INSERT ${eventKey ? "IGNORE " : ""}INTO audit_events
       (actor_id, actor_name, actor_role, category, action, description, route, metadata, event_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [actorId ?? null, actorName, actorRole, category, action, description, route, metadata ? JSON.stringify(metadata) : null, eventKey]
  );
}

function auditFilters({ category = "all", action = "", query = "", dateFrom = "", dateTo = "" } = {}) {
  const filters = ["occurred_at IS NOT NULL"];
  const params = [];
  if (category && category !== "all") {
    filters.push("category = ?");
    params.push(category);
  }
  if (action && action.trim()) {
    filters.push("action = ?");
    params.push(action.trim());
  }
  const normalizedQuery = String(query ?? "").trim().slice(0, 120);
  if (normalizedQuery) {
    const searchableColumns = ["category", "action", "actor_name", "actor_role", "description", "route", "CAST(metadata AS CHAR)"];
    filters.push(`(${searchableColumns.map((column) => `LOCATE(LOWER(?), LOWER(COALESCE(${column}, ''))) > 0`).join(" OR ")})`);
    params.push(...searchableColumns.map(() => normalizedQuery));
  }
  if (dateFrom) {
    filters.push("DATE(occurred_at) >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    filters.push("DATE(occurred_at) <= ?");
    params.push(dateTo);
  }
  return { whereClause: `WHERE ${filters.join(" AND ")}`, params };
}

async function getAuditLog({ limit = 20, page = 1, category = "all", action = "", query = "", dateFrom = "", dateTo = "" } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;
  const { whereClause, params } = auditFilters({ category, action, query, dateFrom, dateTo });
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM audit_events
     ${whereClause}`,
    params
  );
  const [rows] = await db.query(
    `SELECT occurred_at, category, action, actor_name, actor_role, description, metadata, route,
            restore_status, reversed_at, reversed_by_restore_id
     FROM audit_events
     ${whereClause}
     ORDER BY occurred_at DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
  let displayRows = rows;
  try {
    displayRows = await enrichAuditLookupRows(displayRows, db.query.bind(db));
  } catch (error) {
    console.error("[analytics] Failed to resolve audit lookup labels:", error.message);
  }
  try {
    displayRows = await enrichCopyAuditRows(displayRows, db.query.bind(db));
  } catch (error) {
    console.error("[analytics] Failed to resolve copy audit labels:", error.message);
    displayRows = displayRows.map(({ route, ...row }) => row);
  }
  return {
    rows: displayRows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1),
    },
    filters: { category, action, query: String(query ?? "").trim().slice(0, 120), dateFrom, dateTo },
  };
}

async function getAuditLogMeta() {
  const [actionRows] = await db.query(
    `SELECT DISTINCT category, action
     FROM audit_events
     WHERE occurred_at IS NOT NULL
     ORDER BY category ASC, action ASC`
  );
  const actionsByCategory = {};
  for (const row of actionRows) {
    (actionsByCategory[row.category] ??= []).push(row.action);
  }
  return {
    categories: AUDIT_CATEGORIES,
    actions: [...new Set(actionRows.map((row) => row.action))],
    actionsByCategory,
  };
}

async function getDashboardOverviewData(daysAgo) {
  const [
    [[stats]],
    [visitTrend],
    [circulationTrend],
    [attendanceTrend],
    [reservationTrend],
    [borrowingStatus],
    [reservationStatus],
    [userRoles],
    [popularBooks],
    [catalogByCategory],
    [copyCondition],
    [borrowingByRole],
    [fineCollectionTrend],
    [recentActivity],
  ] = await Promise.all([
    db.query(
      `SELECT
         (SELECT COUNT(*) FROM books WHERE deleted_at IS NULL) AS total_books,
         (SELECT COUNT(*) FROM book_copies WHERE deleted_at IS NULL AND is_active = 1) AS total_book_copies,
         (SELECT COUNT(*) FROM book_copies bc WHERE ${availableToBorrow("bc")}) AS available_book_copies,
         (SELECT COUNT(*) FROM book_copies bc WHERE bc.deleted_at IS NULL AND bc.is_active = 1 AND ${hasAccession("bc")}) AS active_accessioned_copies,
         (SELECT COUNT(*) FROM book_copies bc WHERE bc.deleted_at IS NULL AND bc.is_active = 1 AND NOT ${hasAccession("bc")}) AS needs_accession_copies,
         (SELECT COUNT(*) FROM borrowings WHERE deleted_at IS NULL AND status IN ('borrowed', 'overdue')) AS borrowed_book_copies,
         (SELECT COUNT(*) FROM book_copies WHERE deleted_at IS NULL AND is_active = 1 AND \`condition\` = 'damaged') AS damaged_book_copies,
         (SELECT COUNT(*) FROM book_copies WHERE deleted_at IS NULL AND is_active = 1 AND \`condition\` = 'lost') AS lost_book_copies,
         (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND is_active = 1) AS active_users,
         (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS total_users,
         (SELECT COUNT(*) FROM borrowings WHERE deleted_at IS NULL AND status = 'borrowed') AS active_borrowings,
         (SELECT COUNT(*) FROM borrowings WHERE deleted_at IS NULL AND status = 'overdue') AS overdue_borrowings,
         (SELECT COUNT(*) FROM borrowings WHERE DATE(borrowed_at) = CURDATE()) AS borrowings_today,
         (SELECT COUNT(*) FROM borrowings WHERE returned_at IS NOT NULL AND DATE(returned_at) = CURDATE()) AS returns_today,
         (SELECT COALESCE(COUNT(*), 0) FROM reservations WHERE deleted_at IS NULL AND status IN ('pending', 'ready') AND (expires_at IS NULL OR expires_at > NOW())) AS active_reservations,
         (SELECT COALESCE(COUNT(*), 0) FROM reservations WHERE deleted_at IS NULL AND status = 'ready' AND (expires_at IS NULL OR expires_at > NOW())) AS ready_reservations,
         (SELECT COUNT(*) FROM reservations WHERE DATE(reserved_at) = CURDATE()) AS reservations_today,
         (SELECT COUNT(*) FROM reservations WHERE fulfilled_at IS NOT NULL AND DATE(fulfilled_at) = CURDATE()) AS fulfilled_reservations_today,
         (SELECT COUNT(*) FROM attendance_logs WHERE DATE(created_at) = CURDATE()) AS attendance_today,
         (SELECT COUNT(*) FROM attendance_logs WHERE DATE(created_at) = CURDATE() AND purpose = 'borrowing') AS borrowing_attendance_today,
         (SELECT COUNT(*) FROM attendance_logs WHERE DATE(created_at) = CURDATE() AND purpose = 'entry_exit') AS entry_exit_attendance_today,
         (SELECT COUNT(*) FROM site_daily_visits WHERE visit_date = CURDATE()) AS unique_visitors_today,
         (SELECT COALESCE(SUM(hit_count), 0) FROM site_daily_visits WHERE visit_date = CURDATE()) AS visit_hits_today,
         (SELECT COUNT(DISTINCT visitor_id) FROM site_daily_visits) AS total_unique_visitors,
         (SELECT COALESCE(SUM(hit_count), 0) FROM site_daily_visits) AS total_visit_hits,
         (SELECT COUNT(*) FROM notifications WHERE is_active = 1) AS active_notifications,
         (SELECT COUNT(*) FROM academic_subscriptions WHERE deleted_at IS NULL AND is_active = 1) AS active_subscriptions,
         (SELECT COUNT(*) FROM library_holidays WHERE is_active = 1 AND holiday_date >= CURDATE()) AS upcoming_holidays,
         (SELECT COALESCE(SUM(CASE WHEN kind IN ('payment','legacy_credit','reversal') THEN -amount ELSE 0 END), 0) FROM fine_ledger_entries) AS settled_fines_total,
         (SELECT COALESCE(SUM(TIMESTAMPDIFF(HOUR, due_date, NOW())), 0) FROM borrowings WHERE deleted_at IS NULL AND status = 'overdue' AND due_date < NOW()) AS overdue_hours_total,
         (SELECT overdue_fine_per_hour FROM library_circulation_settings WHERE id = 1 LIMIT 1) AS overdue_fine_per_hour`
    ),
    db.query(
      `SELECT DATE_FORMAT(visit_date, '%Y-%m-%d') AS label, COUNT(*) AS unique_visitors, COALESCE(SUM(hit_count), 0) AS visit_hits
       FROM site_daily_visits WHERE visit_date >= CURDATE() - INTERVAL ? DAY GROUP BY DATE_FORMAT(visit_date, '%Y-%m-%d') ORDER BY label ASC`,
      [daysAgo]
    ),
    db.query(
      `SELECT label, SUM(borrowed_count) AS borrowed_count, SUM(returned_count) AS returned_count
       FROM (
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS label, COUNT(*) AS borrowed_count, 0 AS returned_count FROM borrowings WHERE created_at >= CURDATE() - INTERVAL ? DAY GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
         UNION ALL
         SELECT DATE_FORMAT(returned_at, '%Y-%m-%d') AS label, 0 AS borrowed_count, COUNT(*) AS returned_count FROM borrowings WHERE returned_at IS NOT NULL AND returned_at >= CURDATE() - INTERVAL ? DAY GROUP BY DATE_FORMAT(returned_at, '%Y-%m-%d')
       ) circulation GROUP BY label ORDER BY label ASC`,
      [daysAgo, daysAgo]
    ),
    db.query(
      `SELECT label, SUM(entry_exit_count) AS entry_exit_count, SUM(borrowing_count) AS borrowing_count
       FROM (
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS label, COUNT(*) AS entry_exit_count, 0 AS borrowing_count FROM attendance_logs WHERE created_at >= CURDATE() - INTERVAL ? DAY AND purpose = 'entry_exit' GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
         UNION ALL
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS label, 0 AS entry_exit_count, COUNT(*) AS borrowing_count FROM attendance_logs WHERE created_at >= CURDATE() - INTERVAL ? DAY AND purpose = 'borrowing' GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
       ) attendance GROUP BY label ORDER BY label ASC`,
      [daysAgo, daysAgo]
    ),
    db.query(
      `SELECT label, SUM(created_count) AS created_count, SUM(fulfilled_count) AS fulfilled_count, SUM(cancelled_count) AS cancelled_count
       FROM (
         SELECT DATE_FORMAT(reserved_at, '%Y-%m-%d') AS label, COUNT(*) AS created_count, 0 AS fulfilled_count, 0 AS cancelled_count FROM reservations WHERE reserved_at >= CURDATE() - INTERVAL ? DAY GROUP BY DATE_FORMAT(reserved_at, '%Y-%m-%d')
         UNION ALL
         SELECT DATE_FORMAT(fulfilled_at, '%Y-%m-%d') AS label, 0 AS created_count, COUNT(*) AS fulfilled_count, 0 AS cancelled_count FROM reservations WHERE fulfilled_at IS NOT NULL AND fulfilled_at >= CURDATE() - INTERVAL ? DAY GROUP BY DATE_FORMAT(fulfilled_at, '%Y-%m-%d')
         UNION ALL
         SELECT DATE_FORMAT(cancelled_at, '%Y-%m-%d') AS label, 0 AS created_count, 0 AS fulfilled_count, COUNT(*) AS cancelled_count FROM reservations WHERE cancelled_at IS NOT NULL AND cancelled_at >= CURDATE() - INTERVAL ? DAY GROUP BY DATE_FORMAT(cancelled_at, '%Y-%m-%d')
       ) reservations_flow GROUP BY label ORDER BY label ASC`,
      [daysAgo, daysAgo, daysAgo]
    ),
    db.query("SELECT status AS name, COUNT(*) AS value FROM borrowings GROUP BY status ORDER BY FIELD(status, 'borrowed', 'overdue', 'returned')"),
    db.query("SELECT status AS name, COUNT(*) AS value FROM reservations GROUP BY status ORDER BY FIELD(status, 'pending', 'ready', 'fulfilled', 'cancelled', 'expired')"),
    db.query("SELECT role AS name, COUNT(*) AS value FROM users WHERE deleted_at IS NULL GROUP BY role ORDER BY value DESC, role ASC"),
    db.query(
      `SELECT COALESCE(bk.title, 'Deleted book') AS name, COUNT(*) AS total FROM borrowings b LEFT JOIN books bk ON bk.id = b.book_id
       WHERE b.created_at >= CURDATE() - INTERVAL ? DAY
       GROUP BY b.book_id, bk.title ORDER BY total DESC, bk.title ASC LIMIT 5`,
      [daysAgo]
    ),
    db.query(
      `SELECT COALESCE(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(bk.metadata, '$.category'))), ''), 'Uncategorized') AS name,
              COUNT(DISTINCT bk.id) AS titles, COUNT(bc.id) AS copies
       FROM books bk LEFT JOIN book_copies bc ON bc.book_id = bk.id AND bc.deleted_at IS NULL
       WHERE bk.deleted_at IS NULL
       GROUP BY COALESCE(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(bk.metadata, '$.category'))), ''), 'Uncategorized')
       ORDER BY titles DESC, name ASC LIMIT 8`
    ),
    db.query("SELECT \`condition\` AS name, COUNT(*) AS value FROM book_copies WHERE deleted_at IS NULL AND is_active = 1 GROUP BY \`condition\` ORDER BY FIELD(\`condition\`, 'good', 'damaged', 'lost')"),
    db.query(
      `SELECT u.role AS name, COUNT(*) AS value FROM borrowings b JOIN users u ON u.id = b.user_id
       WHERE b.created_at >= CURDATE() - INTERVAL ? DAY
       GROUP BY u.role ORDER BY value DESC, u.role ASC`,
      [daysAgo]
    ),
    db.query(
      `SELECT DATE_FORMAT(effective_at, '%Y-%m') AS label,
              COALESCE(SUM(CASE WHEN kind IN ('payment','legacy_credit','reversal') THEN -amount ELSE 0 END), 0) AS settled_amount
       FROM fine_ledger_entries WHERE kind IN ('payment','legacy_credit','reversal')
         AND effective_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')
       GROUP BY DATE_FORMAT(effective_at, '%Y-%m') ORDER BY label ASC`
    ),
    db.query(
      `SELECT occurred_at, activity_type, description
       FROM (
         SELECT b.created_at AS occurred_at, CAST('borrowed' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS activity_type, CONVERT(CONCAT(u.name, ' borrowed "', bk.title, '"') USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
         FROM borrowings b JOIN users u ON u.id = b.user_id JOIN books bk ON bk.id = b.book_id
         UNION ALL
         SELECT b.returned_at AS occurred_at, CAST('returned' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS activity_type, CONVERT(CONCAT(u.name, ' returned "', bk.title, '"') USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
         FROM borrowings b JOIN users u ON u.id = b.user_id JOIN books bk ON bk.id = b.book_id WHERE b.returned_at IS NOT NULL
         UNION ALL
         SELECT r.reserved_at AS occurred_at, CAST('reserved' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS activity_type, CONVERT(CONCAT(u.name, ' reserved "', bk.title, '"') USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
         FROM reservations r JOIN users u ON u.id = r.user_id JOIN books bk ON bk.id = r.book_id
       ) recent_activity
       WHERE occurred_at IS NOT NULL ORDER BY occurred_at DESC LIMIT 6`
    ),
  ]);
  return { stats, visitTrend, circulationTrend, attendanceTrend, reservationTrend, borrowingStatus, reservationStatus, userRoles, popularBooks, catalogByCategory, copyCondition, borrowingByRole, fineCollectionTrend, recentActivity };
}

async function getReportRangeBounds() {
  const [[row]] = await db.query(
    `SELECT
       DATE_FORMAT(COALESCE(MIN(event_date), CURDATE()), '%Y-%m-%d') AS dateFrom,
       DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS dateTo
     FROM (
       SELECT MIN(borrowed_at) AS event_date FROM borrowings
       UNION ALL SELECT MIN(returned_at) FROM borrowings WHERE returned_at IS NOT NULL
       UNION ALL SELECT MIN(reserved_at) FROM reservations
       UNION ALL SELECT MIN(fulfilled_at) FROM reservations WHERE fulfilled_at IS NOT NULL
       UNION ALL SELECT MIN(cancelled_at) FROM reservations WHERE cancelled_at IS NOT NULL
       UNION ALL SELECT MIN(created_at) FROM attendance_logs
       UNION ALL SELECT MIN(visit_date) FROM site_daily_visits
       UNION ALL SELECT MIN(effective_at) FROM fine_ledger_entries WHERE kind IN ('payment','legacy_credit','reversal')
     ) report_events`
  );
  return row;
}

async function getAiReportQueryData({ range, previousRange, startAt, endExclusive, previousStartAt, previousEndAt }) {
  const [
    [circulationRows],
    [reservationRows],
    [attendanceRows],
    [visitRows],
    [fineRows],
    [topBooks],
    [watchRows],
    [previousCirculationRows],
    [previousReservationRows],
    [previousAttendanceRows],
    [previousVisitRows],
    [previousFineRows],
    [dailyActivity],
    [topBorrowers],
  ] = await Promise.all([
    db.query(
      `SELECT SUM(borrowed_at >= ? AND borrowed_at < DATE_ADD(?, INTERVAL 1 DAY)) AS borrowed,
              SUM(returned_at IS NOT NULL AND returned_at >= ? AND returned_at < DATE_ADD(?, INTERVAL 1 DAY)) AS returned
       FROM borrowings`,
      [startAt, endExclusive, startAt, endExclusive]
    ),
    db.query(
      `SELECT SUM(reserved_at >= ? AND reserved_at < DATE_ADD(?, INTERVAL 1 DAY)) AS created,
              SUM(fulfilled_at IS NOT NULL AND fulfilled_at >= ? AND fulfilled_at < DATE_ADD(?, INTERVAL 1 DAY)) AS fulfilled,
              SUM(cancelled_at IS NOT NULL AND cancelled_at >= ? AND cancelled_at < DATE_ADD(?, INTERVAL 1 DAY)) AS cancelled
       FROM reservations`,
      [startAt, endExclusive, startAt, endExclusive, startAt, endExclusive]
    ),
    db.query(
      `SELECT SUM(purpose = 'entry_exit') AS entry_exit_scans, SUM(purpose = 'borrowing') AS borrowing_scans
       FROM attendance_logs WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [startAt, endExclusive]
    ),
    db.query(
      `SELECT COUNT(DISTINCT visitor_id) AS unique_visitors, COALESCE(SUM(hit_count), 0) AS page_hits
       FROM site_daily_visits WHERE visit_date >= ? AND visit_date <= ?`,
      [range.dateFrom, range.dateTo]
    ),
    db.query(
      `SELECT COALESCE(SUM(CASE WHEN kind IN ('payment','legacy_credit','reversal') THEN -amount ELSE 0 END), 0) AS settled_amount
       FROM fine_ledger_entries WHERE kind IN ('payment','legacy_credit','reversal')
         AND effective_at >= ? AND effective_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [startAt, endExclusive]
    ),
    db.query(
      `SELECT bk.title AS title, COUNT(*) AS borrowings
       FROM borrowings b LEFT JOIN books bk ON bk.id = b.book_id
       WHERE b.borrowed_at >= ? AND b.borrowed_at < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY b.book_id, bk.id, bk.title ORDER BY borrowings DESC, bk.title ASC LIMIT 5`,
      [startAt, endExclusive]
    ),
    db.query(
      `SELECT (SELECT COUNT(*) FROM borrowings WHERE deleted_at IS NULL AND status = 'overdue') AS overdue_borrowings,
              (SELECT COUNT(*) FROM reservations WHERE deleted_at IS NULL AND status = 'ready' AND (expires_at IS NULL OR expires_at > NOW())) AS ready_reservations`
    ),
    db.query(
      `SELECT SUM(borrowed_at >= ? AND borrowed_at < DATE_ADD(?, INTERVAL 1 DAY)) AS borrowed,
              SUM(returned_at IS NOT NULL AND returned_at >= ? AND returned_at < DATE_ADD(?, INTERVAL 1 DAY)) AS returned
       FROM borrowings`,
      [previousStartAt, previousEndAt, previousStartAt, previousEndAt]
    ),
    db.query(
      `SELECT SUM(reserved_at >= ? AND reserved_at < DATE_ADD(?, INTERVAL 1 DAY)) AS created,
              SUM(fulfilled_at IS NOT NULL AND fulfilled_at >= ? AND fulfilled_at < DATE_ADD(?, INTERVAL 1 DAY)) AS fulfilled,
              SUM(cancelled_at IS NOT NULL AND cancelled_at >= ? AND cancelled_at < DATE_ADD(?, INTERVAL 1 DAY)) AS cancelled
       FROM reservations`,
      [previousStartAt, previousEndAt, previousStartAt, previousEndAt, previousStartAt, previousEndAt]
    ),
    db.query(
      `SELECT SUM(purpose = 'entry_exit') AS entry_exit_scans, SUM(purpose = 'borrowing') AS borrowing_scans
       FROM attendance_logs WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [previousStartAt, previousEndAt]
    ),
    db.query(
      `SELECT COUNT(DISTINCT visitor_id) AS unique_visitors, COALESCE(SUM(hit_count), 0) AS page_hits
       FROM site_daily_visits WHERE visit_date >= ? AND visit_date <= ?`,
      [previousRange.dateFrom, previousRange.dateTo]
    ),
    db.query(
      `SELECT COALESCE(SUM(CASE WHEN kind IN ('payment','legacy_credit','reversal') THEN -amount ELSE 0 END), 0) AS settled_amount
       FROM fine_ledger_entries WHERE kind IN ('payment','legacy_credit','reversal')
         AND effective_at >= ? AND effective_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [previousStartAt, previousEndAt]
    ),
    db.query(
      `SELECT day, SUM(borrowed) AS borrowed, SUM(returned) AS returned,
         SUM(entry_exit_scans) AS entry_exit_scans, SUM(library_entries) AS library_entries,
         SUM(unique_library_visitors) AS unique_library_visitors, SUM(borrowing_scans) AS borrowing_scans,
         SUM(unique_visitors) AS unique_visitors, SUM(page_hits) AS page_hits
       FROM (
         SELECT DATE_FORMAT(borrowed_at, '%Y-%m-%d') AS day, COUNT(*) AS borrowed, 0 AS returned, 0 AS entry_exit_scans, 0 AS library_entries, 0 AS unique_library_visitors, 0 AS borrowing_scans, 0 AS unique_visitors, 0 AS page_hits
         FROM borrowings WHERE borrowed_at >= ? AND borrowed_at < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY DATE_FORMAT(borrowed_at, '%Y-%m-%d')
         UNION ALL
         SELECT DATE_FORMAT(returned_at, '%Y-%m-%d'), 0, COUNT(*), 0, 0, 0, 0, 0, 0
         FROM borrowings WHERE returned_at IS NOT NULL AND returned_at >= ? AND returned_at < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY DATE_FORMAT(returned_at, '%Y-%m-%d')
         UNION ALL
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d'), 0, 0, SUM(purpose = 'entry_exit'), SUM(purpose = 'entry_exit' AND type = 'check_in'), COUNT(DISTINCT CASE WHEN purpose = 'entry_exit' AND type = 'check_in' THEN user_id END), SUM(purpose = 'borrowing'), 0, 0
         FROM attendance_logs WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
         UNION ALL
         SELECT DATE_FORMAT(visit_date, '%Y-%m-%d'), 0, 0, 0, 0, 0, 0, COUNT(DISTINCT visitor_id), COALESCE(SUM(hit_count), 0)
         FROM site_daily_visits WHERE visit_date >= ? AND visit_date <= ? GROUP BY DATE_FORMAT(visit_date, '%Y-%m-%d')
       ) daily GROUP BY day ORDER BY day ASC`,
      [startAt, endExclusive, startAt, endExclusive, startAt, endExclusive, range.dateFrom, range.dateTo]
    ),
    db.query(
      `SELECT u.name, COUNT(*) AS borrowings
       FROM borrowings b JOIN users u ON u.id = b.user_id
       WHERE b.borrowed_at >= ? AND b.borrowed_at < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY u.id, u.name ORDER BY borrowings DESC, u.name ASC LIMIT 1`,
      [startAt, endExclusive]
    ),
  ]);
  return {
    circulation: circulationRows[0],
    reservations: reservationRows[0],
    attendance: attendanceRows[0],
    visits: visitRows[0],
    fines: fineRows[0],
    topBooks,
    watchItems: watchRows[0],
    previousCirculation: previousCirculationRows[0],
    previousReservations: previousReservationRows[0],
    previousAttendance: previousAttendanceRows[0],
    previousVisits: previousVisitRows[0],
    previousFines: previousFineRows[0],
    dailyActivity,
    topBorrower: topBorrowers[0] || null,
  };
}

module.exports = { recordSiteVisit, hasRecordedActivity, recordAuditEvent, getAuditLog, getAuditLogMeta, getDashboardOverviewData, getReportRangeBounds, getAiReportQueryData };

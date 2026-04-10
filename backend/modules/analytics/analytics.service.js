const { randomUUID } = require("crypto");
const db = require("../../db");
const { syncOverdueBorrowings, listUnsettledBorrowings } = require("../borrowing/overdue.helper");
const AUDIT_COLLATION = "utf8mb4_unicode_ci";

let ensured = false;

async function ensureSiteDailyVisitsTable() {
  if (ensured) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS site_daily_visits (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      visit_date DATE NOT NULL,
      visitor_id VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED DEFAULT NULL,
      first_path VARCHAR(255) DEFAULT NULL,
      last_path VARCHAR(255) DEFAULT NULL,
      first_visited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_visited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      hit_count INT UNSIGNED NOT NULL DEFAULT 1,
      ip_address VARCHAR(45) DEFAULT NULL,
      user_agent VARCHAR(255) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_site_daily_visits_date_visitor (visit_date, visitor_id),
      KEY idx_site_daily_visits_user_date (user_id, visit_date),
      KEY idx_site_daily_visits_last_visited_at (last_visited_at)
    )
  `);

  ensured = true;
}

function toSafePath(value) {
  if (!value || typeof value !== "string") return "/";
  return value.slice(0, 255);
}

function newVisitorId() {
  return `visitor_${randomUUID()}`;
}

function buildDateLabels(days) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}

function buildMonthLabels(months) {
  return Array.from({ length: months }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (months - 1 - index), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

function normalizeSeries(rows, labels, fields) {
  const byLabel = new Map(rows.map((row) => [row.label, row]));

  return labels.map((label) => {
    const row = byLabel.get(label) || {};
    const point = { label };

    for (const field of fields) {
      point[field] = Number(row[field] || 0);
    }

    return point;
  });
}

async function logSiteVisit({ visitorId, userId = null, path = "/", ipAddress = null, userAgent = null }) {
  await ensureSiteDailyVisitsTable();

  const safePath = toSafePath(path);
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
    [visitorId, userId, safePath, safePath, ipAddress, userAgent ? userAgent.slice(0, 255) : null]
  );
}

function buildAuditFeedQuery() {
  return `SELECT *
    FROM (
      SELECT
        u.last_login AS occurred_at,
        CAST('auth' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('login' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(u.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(u.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT(u.name, ' signed in') USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM users u
      WHERE u.last_login IS NOT NULL

      UNION ALL

      SELECT
        u.created_at AS occurred_at,
        CAST('users' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('created' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CAST(NULL AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CAST(NULL AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT('User account created: ', u.name, ' (', u.student_employee_id, ')') USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM users u

      UNION ALL

      SELECT
        u.deleted_at AS occurred_at,
        CAST('users' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('archived' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(actor.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(actor.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT('User archived: ', u.name, ' (', u.student_employee_id, ')') USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM users u
      LEFT JOIN users actor ON actor.id = u.deleted_by
      WHERE u.deleted_at IS NOT NULL

      UNION ALL

      SELECT
        al.created_at AS occurred_at,
        CAST('attendance' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CONVERT(al.type USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(scanner.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(scanner.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT(target.name, ' ', IF(al.type = 'check_in', 'checked in', 'checked out')) USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM attendance_logs al
      JOIN users target ON target.id = al.user_id
      LEFT JOIN users scanner ON scanner.id = al.scanned_by

      UNION ALL

      SELECT
        b.created_at AS occurred_at,
        CAST('borrowing' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('borrowed' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(issuer.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(issuer.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT(borrower.name, ' borrowed "', bk.title, '"') USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM borrowings b
      JOIN users borrower ON borrower.id = b.user_id
      JOIN books bk ON bk.id = b.book_id
      LEFT JOIN users issuer ON issuer.id = b.issued_by

      UNION ALL

      SELECT
        b.returned_at AS occurred_at,
        CAST('borrowing' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('returned' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(borrower.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(borrower.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT(borrower.name, ' returned "', bk.title, '"') USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM borrowings b
      JOIN users borrower ON borrower.id = b.user_id
      JOIN books bk ON bk.id = b.book_id
      WHERE b.returned_at IS NOT NULL

      UNION ALL

      SELECT
        b.deleted_at AS occurred_at,
        CAST('borrowing' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('archived' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(actor.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(actor.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT('Borrowing record archived for ', borrower.name, ' on "', bk.title, '"') USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM borrowings b
      JOIN users borrower ON borrower.id = b.user_id
      JOIN books bk ON bk.id = b.book_id
      LEFT JOIN users actor ON actor.id = b.deleted_by
      WHERE b.deleted_at IS NOT NULL

      UNION ALL

      SELECT
        r.reserved_at AS occurred_at,
        CAST('reservation' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('created' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(requester.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(requester.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT(requester.name, ' reserved "', bk.title, '"') USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM reservations r
      JOIN users requester ON requester.id = r.user_id
      JOIN books bk ON bk.id = r.book_id

      UNION ALL

      SELECT
        r.cancelled_at AS occurred_at,
        CAST('reservation' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('cancelled' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(requester.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(requester.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT('Reservation cancelled for ', requester.name, ' on "', bk.title, '"') USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM reservations r
      JOIN users requester ON requester.id = r.user_id
      JOIN books bk ON bk.id = r.book_id
      WHERE r.cancelled_at IS NOT NULL

      UNION ALL

      SELECT
        r.fulfilled_at AS occurred_at,
        CAST('reservation' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('fulfilled' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CAST(NULL AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CAST(NULL AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT('Reservation fulfilled for ', requester.name, ' on "', bk.title, '"') USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM reservations r
      JOIN users requester ON requester.id = r.user_id
      JOIN books bk ON bk.id = r.book_id
      WHERE r.fulfilled_at IS NOT NULL

      UNION ALL

      SELECT
        bp.created_at AS occurred_at,
        CAST('bulletin' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('post_created' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(author.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(author.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT('Bulletin post created: ', bp.title) USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM bulletin_posts bp
      LEFT JOIN users author ON author.id = bp.author_id

      UNION ALL

      SELECT
        s.created_at AS occurred_at,
        CAST('subscriptions' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('created' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(creator.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(creator.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT('Subscription created: ', s.title) USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM academic_subscriptions s
      LEFT JOIN users creator ON creator.id = s.created_by

      UNION ALL

      SELECT
        n.created_at AS occurred_at,
        CAST('notifications' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CONVERT(n.type USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(creator.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(creator.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT('Notification created: ', n.title) USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM notifications n
      LEFT JOIN users creator ON creator.id = n.created_by
    ) audit_feed`;
}

function buildAuditFilters({ category = "all", action = "", dateFrom = "", dateTo = "" } = {}) {
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

  if (dateFrom) {
    filters.push("DATE(occurred_at) >= ?");
    params.push(dateFrom);
  }

  if (dateTo) {
    filters.push("DATE(occurred_at) <= ?");
    params.push(dateTo);
  }

  return {
    whereClause: `WHERE ${filters.join(" AND ")}`,
    params,
  };
}

async function getAuditLog({
  limit = 20,
  page = 1,
  category = "all",
  action = "",
  dateFrom = "",
  dateTo = "",
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;
  const auditFeedQuery = buildAuditFeedQuery();
  const { whereClause, params } = buildAuditFilters({ category, action, dateFrom, dateTo });

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM (${auditFeedQuery}) audit_feed
     ${whereClause}`,
    params
  );

  const [rows] = await db.query(
    `SELECT *
     FROM (${auditFeedQuery}) audit_feed
     ${whereClause}
     ORDER BY occurred_at DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  return {
    rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1),
    },
    filters: {
      category,
      action,
      dateFrom,
      dateTo,
    },
  };
}

async function getAuditLogMeta() {
  const auditFeedQuery = buildAuditFeedQuery();
  const [actionRows] = await db.query(
    `SELECT DISTINCT category, action
     FROM (${auditFeedQuery}) audit_feed
     WHERE occurred_at IS NOT NULL
     ORDER BY category ASC, action ASC`
  );

  const actionsByCategory = {};
  for (const row of actionRows) {
    if (!actionsByCategory[row.category]) {
      actionsByCategory[row.category] = [];
    }
    actionsByCategory[row.category].push(row.action);
  }

  return {
    categories: ["all", "auth", "users", "attendance", "borrowing", "reservation", "bulletin", "subscriptions", "notifications"],
    actions: [...new Set(actionRows.map((row) => row.action))],
    actionsByCategory,
  };
}

async function getDashboardOverview() {
  await ensureSiteDailyVisitsTable();
  await syncOverdueBorrowings();

  const dayLabels = buildDateLabels(7);
  const monthLabels = buildMonthLabels(6);

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
    unsettledOverview,
  ] = await Promise.all([
    db.query(
      `SELECT
         (SELECT COUNT(*) FROM books WHERE deleted_at IS NULL) AS total_books,
         (SELECT COUNT(*) FROM book_copies WHERE deleted_at IS NULL AND is_active = 1) AS total_book_copies,
         (SELECT COUNT(*)
            FROM book_copies bc
           WHERE bc.deleted_at IS NULL
             AND bc.is_active = 1
             AND bc.condition = 'good'
             AND NOT EXISTS (
               SELECT 1
               FROM borrowings b
               WHERE b.copy_id = bc.id
                 AND b.deleted_at IS NULL
                 AND b.status IN ('borrowed', 'overdue')
             )) AS available_book_copies,
         (SELECT COUNT(*)
            FROM borrowings
           WHERE deleted_at IS NULL
             AND status IN ('borrowed', 'overdue')) AS borrowed_book_copies,
         (SELECT COUNT(*) FROM book_copies WHERE deleted_at IS NULL AND is_active = 1 AND \`condition\` = 'damaged') AS damaged_book_copies,
         (SELECT COUNT(*) FROM book_copies WHERE deleted_at IS NULL AND is_active = 1 AND \`condition\` = 'lost') AS lost_book_copies,
         (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND is_active = 1) AS active_users,
         (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS total_users,
         (SELECT COUNT(*) FROM borrowings WHERE deleted_at IS NULL AND status = 'borrowed') AS active_borrowings,
         (SELECT COUNT(*) FROM borrowings WHERE deleted_at IS NULL AND status = 'overdue') AS overdue_borrowings,
         (SELECT COUNT(*) FROM borrowings WHERE deleted_at IS NULL AND DATE(borrowed_at) = CURDATE()) AS borrowings_today,
         (SELECT COUNT(*) FROM borrowings WHERE deleted_at IS NULL AND returned_at IS NOT NULL AND DATE(returned_at) = CURDATE()) AS returns_today,
         (SELECT COALESCE(COUNT(*), 0) FROM reservations WHERE deleted_at IS NULL AND status IN ('pending', 'ready')) AS active_reservations,
         (SELECT COALESCE(COUNT(*), 0) FROM reservations WHERE deleted_at IS NULL AND status = 'ready') AS ready_reservations,
         (SELECT COUNT(*) FROM reservations WHERE deleted_at IS NULL AND DATE(reserved_at) = CURDATE()) AS reservations_today,
         (SELECT COUNT(*) FROM reservations WHERE deleted_at IS NULL AND fulfilled_at IS NOT NULL AND DATE(fulfilled_at) = CURDATE()) AS fulfilled_reservations_today,
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
         (SELECT COALESCE(SUM(settled_amount), 0) FROM borrowings WHERE deleted_at IS NULL AND settled_at IS NOT NULL) AS settled_fines_total,
         (SELECT COALESCE(SUM(TIMESTAMPDIFF(HOUR, due_date, NOW())), 0)
            FROM borrowings
           WHERE deleted_at IS NULL
             AND status = 'overdue'
             AND due_date < NOW()) AS overdue_hours_total,
         (SELECT overdue_fine_per_hour FROM library_circulation_settings WHERE id = 1 LIMIT 1) AS overdue_fine_per_hour`
    ),
    db.query(
      `SELECT
         DATE_FORMAT(visit_date, '%Y-%m-%d') AS label,
         COUNT(*) AS unique_visitors,
         COALESCE(SUM(hit_count), 0) AS visit_hits
       FROM site_daily_visits
       WHERE visit_date >= CURDATE() - INTERVAL 6 DAY
       GROUP BY visit_date
       ORDER BY visit_date ASC`
    ),
    db.query(
      `SELECT
         label,
         SUM(borrowed_count) AS borrowed_count,
         SUM(returned_count) AS returned_count
       FROM (
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS label, COUNT(*) AS borrowed_count, 0 AS returned_count
         FROM borrowings
         WHERE deleted_at IS NULL
           AND created_at >= CURDATE() - INTERVAL 6 DAY
         GROUP BY DATE(created_at)
         UNION ALL
         SELECT DATE_FORMAT(returned_at, '%Y-%m-%d') AS label, 0 AS borrowed_count, COUNT(*) AS returned_count
         FROM borrowings
         WHERE deleted_at IS NULL
           AND returned_at IS NOT NULL
           AND returned_at >= CURDATE() - INTERVAL 6 DAY
         GROUP BY DATE(returned_at)
       ) circulation
       GROUP BY label
       ORDER BY label ASC`
    ),
    db.query(
      `SELECT
         label,
         SUM(entry_exit_count) AS entry_exit_count,
         SUM(borrowing_count) AS borrowing_count
       FROM (
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS label, COUNT(*) AS entry_exit_count, 0 AS borrowing_count
         FROM attendance_logs
         WHERE created_at >= CURDATE() - INTERVAL 6 DAY
           AND purpose = 'entry_exit'
         GROUP BY DATE(created_at)
         UNION ALL
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS label, 0 AS entry_exit_count, COUNT(*) AS borrowing_count
         FROM attendance_logs
         WHERE created_at >= CURDATE() - INTERVAL 6 DAY
           AND purpose = 'borrowing'
         GROUP BY DATE(created_at)
       ) attendance
       GROUP BY label
       ORDER BY label ASC`
    ),
    db.query(
      `SELECT
         label,
         SUM(created_count) AS created_count,
         SUM(fulfilled_count) AS fulfilled_count,
         SUM(cancelled_count) AS cancelled_count
       FROM (
         SELECT DATE_FORMAT(reserved_at, '%Y-%m-%d') AS label, COUNT(*) AS created_count, 0 AS fulfilled_count, 0 AS cancelled_count
         FROM reservations
         WHERE deleted_at IS NULL
           AND reserved_at >= CURDATE() - INTERVAL 6 DAY
         GROUP BY DATE(reserved_at)
         UNION ALL
         SELECT DATE_FORMAT(fulfilled_at, '%Y-%m-%d') AS label, 0 AS created_count, COUNT(*) AS fulfilled_count, 0 AS cancelled_count
         FROM reservations
         WHERE deleted_at IS NULL
           AND fulfilled_at IS NOT NULL
           AND fulfilled_at >= CURDATE() - INTERVAL 6 DAY
         GROUP BY DATE(fulfilled_at)
         UNION ALL
         SELECT DATE_FORMAT(cancelled_at, '%Y-%m-%d') AS label, 0 AS created_count, 0 AS fulfilled_count, COUNT(*) AS cancelled_count
         FROM reservations
         WHERE deleted_at IS NULL
           AND cancelled_at IS NOT NULL
           AND cancelled_at >= CURDATE() - INTERVAL 6 DAY
         GROUP BY DATE(cancelled_at)
       ) reservations_flow
       GROUP BY label
       ORDER BY label ASC`
    ),
    db.query(
      `SELECT status AS name, COUNT(*) AS value
       FROM borrowings
       WHERE deleted_at IS NULL
       GROUP BY status
       ORDER BY FIELD(status, 'borrowed', 'overdue', 'returned')`
    ),
    db.query(
      `SELECT status AS name, COUNT(*) AS value
       FROM reservations
       WHERE deleted_at IS NULL
       GROUP BY status
       ORDER BY FIELD(status, 'pending', 'ready', 'fulfilled', 'cancelled', 'expired')`
    ),
    db.query(
      `SELECT role AS name, COUNT(*) AS value
       FROM users
       WHERE deleted_at IS NULL
       GROUP BY role
       ORDER BY value DESC, role ASC`
    ),
    db.query(
      `SELECT bk.title AS name, COUNT(*) AS total
       FROM borrowings b
       JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
       WHERE b.deleted_at IS NULL
       GROUP BY b.book_id, bk.title
       ORDER BY total DESC, bk.title ASC
       LIMIT 5`
    ),
    db.query(
      `SELECT
         COALESCE(NULLIF(TRIM(category), ''), 'Uncategorized') AS name,
         COUNT(*) AS titles,
         COALESCE(SUM(CASE WHEN copies IS NULL OR copies < 0 THEN 0 ELSE copies END), 0) AS copies
       FROM books
       WHERE deleted_at IS NULL
       GROUP BY COALESCE(NULLIF(TRIM(category), ''), 'Uncategorized')
       ORDER BY titles DESC, name ASC
       LIMIT 8`
    ),
    db.query(
      `SELECT \`condition\` AS name, COUNT(*) AS value
       FROM book_copies
       WHERE deleted_at IS NULL
         AND is_active = 1
       GROUP BY \`condition\`
       ORDER BY FIELD(\`condition\`, 'good', 'damaged', 'lost')`
    ),
    db.query(
      `SELECT
         u.role AS name,
         COUNT(*) AS value
       FROM borrowings b
       JOIN users u ON u.id = b.user_id
       WHERE b.deleted_at IS NULL
         AND u.deleted_at IS NULL
       GROUP BY u.role
       ORDER BY value DESC, u.role ASC`
    ),
    db.query(
      `SELECT
         DATE_FORMAT(settled_at, '%Y-%m') AS label,
         COALESCE(SUM(settled_amount), 0) AS settled_amount
       FROM borrowings
       WHERE deleted_at IS NULL
         AND settled_at IS NOT NULL
         AND settled_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')
       GROUP BY DATE_FORMAT(settled_at, '%Y-%m')
       ORDER BY label ASC`
    ),
    listUnsettledBorrowings({ limit: null }),
  ]);
  const overdueFinePerHour = Number(stats.overdue_fine_per_hour || 0);
  const outstandingFines = Number(unsettledOverview.summary.total_unsettled_amount || 0);

  return {
    stats: {
      total_books: Number(stats.total_books || 0),
      total_book_copies: Number(stats.total_book_copies || 0),
      available_book_copies: Number(stats.available_book_copies || 0),
      borrowed_book_copies: Number(stats.borrowed_book_copies || 0),
      damaged_book_copies: Number(stats.damaged_book_copies || 0),
      lost_book_copies: Number(stats.lost_book_copies || 0),
      active_users: Number(stats.active_users || 0),
      total_users: Number(stats.total_users || 0),
      active_borrowings: Number(stats.active_borrowings || 0),
      overdue_borrowings: Number(stats.overdue_borrowings || 0),
      borrowings_today: Number(stats.borrowings_today || 0),
      returns_today: Number(stats.returns_today || 0),
      active_reservations: Number(stats.active_reservations || 0),
      ready_reservations: Number(stats.ready_reservations || 0),
      reservations_today: Number(stats.reservations_today || 0),
      fulfilled_reservations_today: Number(stats.fulfilled_reservations_today || 0),
      attendance_today: Number(stats.attendance_today || 0),
      borrowing_attendance_today: Number(stats.borrowing_attendance_today || 0),
      entry_exit_attendance_today: Number(stats.entry_exit_attendance_today || 0),
      unique_visitors_today: Number(stats.unique_visitors_today || 0),
      visit_hits_today: Number(stats.visit_hits_today || 0),
      total_unique_visitors: Number(stats.total_unique_visitors || 0),
      total_visit_hits: Number(stats.total_visit_hits || 0),
      active_notifications: Number(stats.active_notifications || 0),
      active_subscriptions: Number(stats.active_subscriptions || 0),
      upcoming_holidays: Number(stats.upcoming_holidays || 0),
      settled_fines_total: Number(stats.settled_fines_total || 0),
      overdue_fine_per_hour: overdueFinePerHour,
      outstanding_fines: outstandingFines,
    },
    charts: {
      visitTrend: normalizeSeries(visitTrend, dayLabels, ["unique_visitors", "visit_hits"]),
      circulationTrend: normalizeSeries(circulationTrend, dayLabels, ["borrowed_count", "returned_count"]),
      attendanceTrend: normalizeSeries(attendanceTrend, dayLabels, ["entry_exit_count", "borrowing_count"]),
      reservationTrend: normalizeSeries(reservationTrend, dayLabels, ["created_count", "fulfilled_count", "cancelled_count"]),
      borrowingStatus: borrowingStatus.map((row) => ({
        name: row.name,
        value: Number(row.value || 0),
      })),
      reservationStatus: reservationStatus.map((row) => ({
        name: row.name,
        value: Number(row.value || 0),
      })),
      userRoles: userRoles.map((row) => ({
        name: row.name,
        value: Number(row.value || 0),
      })),
      popularBooks: popularBooks.map((row) => ({
        name: row.name,
        total: Number(row.total || 0),
      })),
      catalogByCategory: catalogByCategory.map((row) => ({
        name: row.name,
        titles: Number(row.titles || 0),
        copies: Number(row.copies || 0),
      })),
      copyCondition: copyCondition.map((row) => ({
        name: row.name,
        value: Number(row.value || 0),
      })),
      borrowingByRole: borrowingByRole.map((row) => ({
        name: row.name,
        value: Number(row.value || 0),
      })),
      fineCollectionTrend: normalizeSeries(fineCollectionTrend, monthLabels, ["settled_amount"]),
    },
  };
}

module.exports = {
  ensureSiteDailyVisitsTable,
  getAuditLog,
  getAuditLogMeta,
  getDashboardOverview,
  logSiteVisit,
  newVisitorId,
};

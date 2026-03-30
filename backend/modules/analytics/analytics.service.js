const { randomUUID } = require("crypto");
const db = require("../../db");
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
        r.deleted_at AS occurred_at,
        CAST('reservation' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('archived' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(actor.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(actor.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT('Reservation archived for ', requester.name, ' on "', bk.title, '"') USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM reservations r
      JOIN users requester ON requester.id = r.user_id
      JOIN books bk ON bk.id = r.book_id
      LEFT JOIN users actor ON actor.id = r.deleted_by
      WHERE r.deleted_at IS NOT NULL

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
        bp.deleted_at AS occurred_at,
        CAST('bulletin' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('post_archived' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(actor.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(actor.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT('Bulletin post archived: ', bp.title) USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM bulletin_posts bp
      LEFT JOIN users actor ON actor.id = bp.deleted_by
      WHERE bp.deleted_at IS NOT NULL

      UNION ALL

      SELECT
        bc.created_at AS occurred_at,
        CAST('bulletin' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('comment_created' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(commenter.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(commenter.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT(commenter.name, ' commented on bulletin post #', bc.post_id) USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM bulletin_comments bc
      LEFT JOIN users commenter ON commenter.id = bc.user_id

      UNION ALL

      SELECT
        bc.deleted_at AS occurred_at,
        CAST('bulletin' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('comment_archived' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(actor.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(actor.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT('Bulletin comment archived on post #', bc.post_id) USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM bulletin_comments bc
      LEFT JOIN users actor ON actor.id = bc.deleted_by
      WHERE bc.deleted_at IS NOT NULL

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
        s.updated_at AS occurred_at,
        CAST('subscriptions' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('updated' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(editor.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(editor.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT('Subscription updated: ', s.title) USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM academic_subscriptions s
      LEFT JOIN users editor ON editor.id = s.updated_by
      WHERE s.updated_at > s.created_at

      UNION ALL

      SELECT
        s.deleted_at AS occurred_at,
        CAST('subscriptions' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('archived' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(actor.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(actor.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CONVERT(CONCAT('Subscription archived: ', s.title) USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM academic_subscriptions s
      LEFT JOIN users actor ON actor.id = s.deleted_by
      WHERE s.deleted_at IS NOT NULL

      UNION ALL

      SELECT
        a.updated_at AS occurred_at,
        CAST('about' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS category,
        CAST('updated' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS action,
        CONVERT(editor.name USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_name,
        CONVERT(editor.role USING utf8mb4) COLLATE ${AUDIT_COLLATION} AS actor_role,
        CAST('Updated About page settings' AS CHAR CHARACTER SET utf8mb4) COLLATE ${AUDIT_COLLATION} AS description
      FROM about_settings a
      LEFT JOIN users editor ON editor.id = a.updated_by
    ) audit_feed`;
}

async function getDashboardOverview({
  limit = 20,
  page = 1,
  category = "all",
  action = "",
  dateFrom = "",
  dateTo = "",
} = {}) {
  await ensureSiteDailyVisitsTable();

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const [[stats]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM books WHERE deleted_at IS NULL) AS total_books,
       (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND is_active = 1) AS active_users,
       (SELECT COUNT(*) FROM site_daily_visits WHERE visit_date = CURDATE()) AS unique_visitors_today,
       (SELECT COALESCE(SUM(hit_count), 0) FROM site_daily_visits WHERE visit_date = CURDATE()) AS visit_hits_today,
       (SELECT COUNT(DISTINCT visitor_id) FROM site_daily_visits) AS total_unique_visitors,
       (SELECT COALESCE(SUM(hit_count), 0) FROM site_daily_visits) AS total_visit_hits`
  );

  const filters = ["occurred_at IS NOT NULL"];
  const filterParams = [];

  if (category && category !== "all") {
    filters.push("category = ?");
    filterParams.push(category);
  }

  if (action && action.trim()) {
    filters.push("action = ?");
    filterParams.push(action.trim());
  }

  if (dateFrom) {
    filters.push("DATE(occurred_at) >= ?");
    filterParams.push(dateFrom);
  }

  if (dateTo) {
    filters.push("DATE(occurred_at) <= ?");
    filterParams.push(dateTo);
  }

  const auditFeedQuery = buildAuditFeedQuery();
  const whereClause = `WHERE ${filters.join(" AND ")}`;

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM (${auditFeedQuery}) audit_feed
     ${whereClause}`,
    filterParams
  );

  const [auditLog] = await db.query(
    `SELECT *
     FROM (${auditFeedQuery}) audit_feed
     ${whereClause}
     ORDER BY occurred_at DESC
     LIMIT ? OFFSET ?`,
    [...filterParams, safeLimit, offset]
  );

  return {
    stats,
    auditLog,
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

module.exports = {
  ensureSiteDailyVisitsTable,
  getDashboardOverview,
  logSiteVisit,
  newVisitorId,
};

const db = require("../../db");

const PAGE_LIMIT = 25;
const EXPORT_LIMIT = 10000;
const REPORTS = {
  fined: { label: "Fined", dateLabel: "Charge date" },
  daily_users: { label: "Daily Library Users", dateLabel: "Attendance date" },
  date_due: { label: "Date Due", dateLabel: "Due date" },
  top_users: { label: "Top 10 Users", dateLabel: "Activity date" },
  daily_stats: { label: "Statistics for Daily Users", dateLabel: "Attendance date" },
  resource_usage: { label: "Statistics for Resource Usage", dateLabel: "Borrow date" },
};

const columns = {
  fined: [
    ["borrower", "Borrower", "text"], ["studentEmployeeId", "Student / employee ID", "text"], ["title", "Book", "text"],
    ["chargedAt", "Charged", "dateTime"], ["assessedAmount", "Assessed", "number"], ["paidAmount", "Paid", "number"],
    ["adjustedAmount", "Adjusted", "number"], ["outstandingAmount", "Outstanding", "number"], ["status", "Status", "text"],
  ],
  daily_users: [["date", "Date", "date"], ["uniqueUsers", "Unique users", "number"], ["checkIns", "Check-ins", "number"]],
  date_due: [["borrower", "Borrower", "text"], ["studentEmployeeId", "Student / employee ID", "text"], ["title", "Book", "text"], ["dueDate", "Due", "dateTime"], ["status", "Status", "text"]],
  top_users: [["rank", "Rank", "number"], ["name", "User", "text"], ["studentEmployeeId", "Student / employee ID", "text"], ["activityCount", "Activity count", "number"], ["activityType", "Ranked by", "text"]],
  daily_stats: [["date", "Date", "date"], ["uniqueUsers", "Unique users", "number"], ["checkIns", "Check-ins", "number"], ["averageCheckInsPerUser", "Average check-ins / user", "number"]],
  resource_usage: [["title", "Book", "text"], ["bookType", "Book type", "text"], ["borrowings", "Borrowings", "number"], ["uniqueBorrowers", "Unique borrowers", "number"]],
};

const validDate = (value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
const reportValue = (filters, key) => typeof filters[key] === "string" ? filters[key].trim() : "";
const safePage = (value) => Math.max(Number.parseInt(value, 10) || 1, 1);
const safeLimit = (value, max = 100) => Math.min(Math.max(Number.parseInt(value, 10) || PAGE_LIMIT, 1), max);

function getReport(name) {
  if (!Object.hasOwn(REPORTS, name)) throw Object.assign(new Error("Choose a valid report."), { status: 400 });
  return REPORTS[name];
}

function range(filters) {
  const from = reportValue(filters, "dateFrom"); const to = reportValue(filters, "dateTo");
  if (!validDate(from) || !validDate(to) || (from && to && from > to)) throw Object.assign(new Error("Provide a valid report date range."), { status: 400 });
  return { from, to };
}

function dateWhere(column, from, to, params) {
  const where = [];
  if (from) { where.push(`DATE(${column}) >= ?`); params.push(from); }
  if (to) { where.push(`DATE(${column}) <= ?`); params.push(to); }
  return where;
}

async function rawRows(reportName, filters = {}) {
  const { from, to } = range(filters); const search = reportValue(filters, "search"); const params = []; const like = `%${search.slice(0, 120)}%`;
  if (reportName === "fined") {
    const chargeRange = dateWhere("ch.effective_at", from, to, params);
    const where = ["b.deleted_at IS NULL", "u.deleted_at IS NULL", "bk.deleted_at IS NULL", `EXISTS (SELECT 1 FROM fine_ledger_entries ch WHERE ch.borrowing_id = b.id AND ch.kind IN ('charge','legacy_charge')${chargeRange.length ? ` AND ${chargeRange.join(" AND ")}` : ""})`];
    if (search) { where.push("(u.name LIKE ? OR u.student_employee_id LIKE ? OR bk.title LIKE ?)"); params.push(like, like, like); }
    const [rows] = await db.query(`SELECT u.name AS borrower, u.student_employee_id AS studentEmployeeId, bk.title,
      MIN(fe.effective_at) AS chargedAt,
      COALESCE(SUM(CASE WHEN fe.kind IN ('charge','legacy_charge') THEN fe.amount ELSE 0 END), 0) AS assessedAmount,
      COALESCE(-SUM(CASE WHEN fe.kind IN ('payment','reversal','legacy_credit') THEN fe.amount ELSE 0 END), 0) AS paidAmount,
      COALESCE(-SUM(CASE WHEN fe.kind = 'adjustment' THEN fe.amount ELSE 0 END), 0) AS adjustedAmount,
      COALESCE(SUM(fe.amount), 0) AS outstandingAmount,
      CASE WHEN COALESCE(SUM(fe.amount), 0) <= 0 THEN 'Settled' ELSE 'Outstanding' END AS status
      FROM borrowings b JOIN users u ON u.id=b.user_id JOIN books bk ON bk.id=b.book_id
      JOIN fine_accounts fa ON fa.borrowing_id=b.id JOIN fine_ledger_entries fe ON fe.borrowing_id=b.id
      WHERE ${where.join(" AND ")} GROUP BY b.id,u.name,u.student_employee_id,bk.title ORDER BY chargedAt DESC,b.id DESC`, params);
    return rows;
  }
  if (reportName === "date_due") {
    const where = ["b.deleted_at IS NULL", "b.status IN ('borrowed','overdue')", "u.deleted_at IS NULL", "bk.deleted_at IS NULL", ...dateWhere("b.due_date", from, to, params)];
    if (search) { where.push("(u.name LIKE ? OR u.student_employee_id LIKE ? OR bk.title LIKE ?)"); params.push(like, like, like); }
    const [rows] = await db.query(`SELECT u.name AS borrower,u.student_employee_id AS studentEmployeeId,bk.title,b.due_date AS dueDate,b.status FROM borrowings b JOIN users u ON u.id=b.user_id JOIN books bk ON bk.id=b.book_id WHERE ${where.join(" AND ")} ORDER BY b.due_date ASC,b.id ASC`, params); return rows;
  }
  if (reportName === "daily_users" || reportName === "daily_stats") {
    const where = ["a.purpose='entry_exit'", "a.type='check_in'", "u.deleted_at IS NULL", ...dateWhere("a.created_at", from, to, params)];
    const [rows] = await db.query(`SELECT DATE(a.created_at) AS date, COUNT(DISTINCT a.user_id) AS uniqueUsers, COUNT(*) AS checkIns, ROUND(COUNT(*) / NULLIF(COUNT(DISTINCT a.user_id),0), 2) AS averageCheckInsPerUser FROM attendance_logs a JOIN users u ON u.id=a.user_id WHERE ${where.join(" AND ")} GROUP BY DATE(a.created_at) ORDER BY date DESC`, params); return rows;
  }
  if (reportName === "top_users") {
    const ranking = reportValue(filters, "ranking") || "borrowings";
    if (!["borrowings", "checkins"].includes(ranking)) throw Object.assign(new Error("Choose a valid user ranking."), { status: 400 });
    const params2 = []; const where = ["u.deleted_at IS NULL", ...dateWhere(ranking === "borrowings" ? "b.borrowed_at" : "a.created_at", from, to, params2)];
    const source = ranking === "borrowings" ? "borrowings b JOIN users u ON u.id=b.user_id AND b.deleted_at IS NULL" : "attendance_logs a JOIN users u ON u.id=a.user_id";
    if (ranking === "checkins") where.push("a.purpose='entry_exit'", "a.type='check_in'");
    if (search) { where.push("(u.name LIKE ? OR u.student_employee_id LIKE ?)"); params2.push(like, like); }
    const [rows] = await db.query(`SELECT u.name,u.student_employee_id AS studentEmployeeId,COUNT(*) AS activityCount,'${ranking === "borrowings" ? "Borrowings" : "Library check-ins"}' AS activityType FROM ${source} WHERE ${where.join(" AND ")} GROUP BY u.id,u.name,u.student_employee_id ORDER BY activityCount DESC,u.name ASC LIMIT 10`, params2);
    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  }
  if (reportName === "resource_usage") {
    const where = ["b.deleted_at IS NULL", "u.deleted_at IS NULL", "bk.deleted_at IS NULL", ...dateWhere("b.borrowed_at", from, to, params)];
    if (search) { where.push("(bk.title LIKE ? OR bt.name LIKE ?)"); params.push(like, like); }
    const [rows] = await db.query(`SELECT bk.title,COALESCE(bt.name,'Unassigned') AS bookType,COUNT(*) AS borrowings,COUNT(DISTINCT b.user_id) AS uniqueBorrowers FROM borrowings b JOIN users u ON u.id=b.user_id JOIN books bk ON bk.id=b.book_id LEFT JOIN book_types bt ON bt.id=bk.book_type_id WHERE ${where.join(" AND ")} GROUP BY bk.id,bk.title,bt.name ORDER BY borrowings DESC,bk.title ASC`, params); return rows;
  }
  throw Object.assign(new Error("Report is not implemented."), { status: 400 });
}

function shape(reportName, rows) { return rows.map((row) => Object.fromEntries(columns[reportName].map(([key]) => [key, row[key] ?? null]))); }
async function listReport({ report: reportName = "fined", page, limit, ...filters }) { getReport(reportName); const all = shape(reportName, await rawRows(reportName, filters)); const currentPage = safePage(page); const currentLimit = safeLimit(limit); const total = all.length; return { report: reportName, label: REPORTS[reportName].label, columns: columns[reportName].map(([key,label,type]) => ({ key,label,type })), rows: all.slice((currentPage-1)*currentLimit,currentPage*currentLimit), pagination: { page: currentPage, limit: currentLimit, total, totalPages: Math.max(Math.ceil(total/currentLimit),1) }, filters }; }
async function exportReport({ report: reportName = "fined", ...filters }) { getReport(reportName); const rows = shape(reportName, await rawRows(reportName, filters)); if (rows.length > EXPORT_LIMIT) throw Object.assign(new Error(`Exports are limited to ${EXPORT_LIMIT.toLocaleString()} records.`), { status: 400 }); return { report: reportName, label: REPORTS[reportName].label, columns: columns[reportName].map(([key,label,type]) => ({ key,label,type })), rows, filters }; }
module.exports = { REPORTS, columns, listReport, exportReport };

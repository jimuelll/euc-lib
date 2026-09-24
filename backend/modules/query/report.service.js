const db = require("../../db");
const { availableToBorrow, hasAccession } = require("../catalog/copyEligibility");

const PAGE_LIMIT = 25;
const EXPORT_LIMIT = 10000;
const REPORTS = {
  fined: { label: "Fined", dateLabel: "Charge date" },
  daily_users: { label: "Daily Library Users", dateLabel: "Attendance date" },
  date_due: { label: "Date Due", dateLabel: "Due date" },
  top_users: { label: "Top 10 Users", dateLabel: "Activity date" },
  daily_stats: { label: "Statistics for Daily Users", dateLabel: "Attendance date" },
  resource_usage: { label: "Statistics for Resource Usage", dateLabel: "Borrow date" },
  holdings_inventory: { label: "Holdings Inventory", dateLabel: null, snapshot: true },
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
  holdings_inventory: [
    ["copyId", "Copy ID", "number"], ["title", "Title", "text"], ["author", "Author", "text"], ["materialType", "Material type", "text"],
    ["isbn", "ISBN", "text"], ["barcode", "Copy barcode", "text"], ["accessionNumber", "Accession number", "text"], ["accessionStatus", "Accession status", "text"],
    ["price", "Price (PHP)", "number"], ["program", "Program / course", "text"], ["courseCode", "Course code", "text"],
    ["location", "Location", "text"], ["dateAcquired", "Date acquired", "date"], ["distributor", "Distributor", "text"],
    ["invoiceReference", "Invoice reference", "text"], ["condition", "Condition", "text"], ["active", "Active", "text"],
    ["circulationState", "Circulation state", "text"], ["lendingEligibility", "Lending eligibility", "text"],
  ],
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
  if (reportValue(filters, "report") === "holdings_inventory" && (reportValue(filters, "dateFrom") || reportValue(filters, "dateTo"))) throw Object.assign(new Error("Date filters do not apply to the current inventory snapshot."), { status: 400 });
  const from = reportValue(filters, "dateFrom"); const to = reportValue(filters, "dateTo");
  if (!validDate(from) || !validDate(to) || (from && to && from > to)) throw Object.assign(new Error("Provide a valid report date range."), { status: 400 });
  return { from, to };
}

function holdingsWhere(filters = {}) {
  const where = ["bc.deleted_at IS NULL", "bk.deleted_at IS NULL"];
  const params = [];
  const search = reportValue(filters, "search").slice(0, 120);
  if (search) {
    where.push("(bk.title LIKE ? OR bk.author LIKE ? OR bk.isbn LIKE ? OR bc.barcode LIKE ? OR h.accession_number LIKE ? OR h.course_code LIKE ? OR h.location LIKE ? OR h.distributor LIKE ? OR h.invoice_reference LIKE ? OR ap.name LIKE ?)");
    params.push(...Array(10).fill(`%${search}%`));
  }
  const program = reportValue(filters, "program");
  if (program && program !== "all") {
    if (!/^\d+$/.test(program)) throw Object.assign(new Error("Choose a valid program or course."), { status: 400 });
    where.push("h.program_id = ?"); params.push(Number(program));
  }
  const completion = reportValue(filters, "completion");
  if (completion && completion !== "all") {
    if (!["complete", "missing"].includes(completion)) throw Object.assign(new Error("Choose a valid holdings completion filter."), { status: 400 });
    where.push(completion === "complete" ? hasAccession("bc", "h") : `NOT ${hasAccession("bc", "h")}`);
  }
  const status = reportValue(filters, "status");
  if (status && status !== "all") {
    const predicates = {
      available: availableToBorrow("bc"),
      borrowed: "EXISTS (SELECT 1 FROM borrowings s WHERE s.copy_id = bc.id AND s.deleted_at IS NULL AND s.status IN ('borrowed','overdue'))",
      reserved: "EXISTS (SELECT 1 FROM reservations s WHERE s.reserved_copy_id = bc.id AND s.deleted_at IS NULL AND s.status = 'ready' AND (s.expires_at IS NULL OR s.expires_at > NOW()))",
      inactive: "bc.is_active = 0",
      needs_accession: `bc.is_active = 1 AND NOT ${hasAccession("bc", "h")}`,
      voided: "EXISTS (SELECT 1 FROM accession_claim_voids void_filter WHERE void_filter.accession_number = h.accession_number)",
      damaged: "bc.condition = 'damaged'",
      lost: "bc.condition = 'lost'",
      unavailable: `(bc.is_active = 1 AND h.copy_id IS NOT NULL AND NOT ${availableToBorrow("bc")})`,
    };
    if (!Object.hasOwn(predicates, status)) throw Object.assign(new Error("Choose a valid inventory status."), { status: 400 });
    where.push(predicates[status]);
  }
  return { where: where.join(" AND "), params };
}

async function holdingsRows(filters = {}, { limit = null, offset = 0 } = {}) {
  const { where, params } = holdingsWhere(filters);
  const select = `SELECT bc.id AS copyId, bk.title, bk.author, bk.material_type AS materialType, bk.isbn, bc.barcode,
    h.accession_number AS accessionNumber,
    CASE WHEN voided_accession.accession_number IS NOT NULL THEN 'Voided' WHEN ${hasAccession("bc", "h")} THEN 'Assigned' ELSE 'Needs accession' END AS accessionStatus,
    h.price, COALESCE(ap.name, 'Unassigned') AS program, h.course_code AS courseCode,
    h.location, h.date_acquired AS dateAcquired, h.distributor, h.invoice_reference AS invoiceReference, bc.condition,
    IF(bc.is_active = 1, 'Active', 'Inactive') AS active,
    CASE WHEN EXISTS (SELECT 1 FROM borrowings loan WHERE loan.copy_id = bc.id AND loan.deleted_at IS NULL AND loan.status IN ('borrowed','overdue')) THEN 'Borrowed'
         WHEN EXISTS (SELECT 1 FROM reservations ready WHERE ready.reserved_copy_id = bc.id AND ready.deleted_at IS NULL AND ready.status = 'ready' AND (ready.expires_at IS NULL OR ready.expires_at > NOW())) THEN 'Reserved'
         WHEN bc.is_active = 0 THEN 'Inactive'
         WHEN bk.material_type = 'thesis' THEN 'Reference only'
         WHEN voided_accession.accession_number IS NOT NULL THEN 'Accession voided'
         WHEN NOT ${hasAccession("bc", "h")} THEN 'Needs accession'
         WHEN ${availableToBorrow("bc")} THEN 'Available'
         ELSE 'Unavailable' END AS circulationState,
    IF(${availableToBorrow("bc")}, 'Eligible', 'Not eligible') AS lendingEligibility
    FROM book_copies bc JOIN books bk ON bk.id = bc.book_id
    LEFT JOIN copy_holdings h ON h.copy_id = bc.id LEFT JOIN academic_programs ap ON ap.id = h.program_id
    LEFT JOIN accession_claim_voids voided_accession ON voided_accession.accession_number = h.accession_number
    WHERE ${where} ORDER BY bk.title ASC, bc.id ASC`;
  const suffix = limit == null ? "" : " LIMIT ? OFFSET ?";
  const [rows] = await db.query(`${select}${suffix}`, limit == null ? params : [...params, limit, offset]);
  return rows;
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
    const where = ["b.id IS NOT NULL", `EXISTS (SELECT 1 FROM fine_ledger_entries ch WHERE ch.borrowing_id = b.id AND ch.kind IN ('charge','legacy_charge')${chargeRange.length ? ` AND ${chargeRange.join(" AND ")}` : ""})`];
    if (search) { where.push("(u.name LIKE ? OR u.student_employee_id LIKE ? OR bk.title LIKE ?)"); params.push(like, like, like); }
    const [rows] = await db.query(`SELECT COALESCE(u.name, 'Deleted patron') AS borrower, u.student_employee_id AS studentEmployeeId, COALESCE(bk.title, 'Deleted book') AS title,
      MIN(fe.effective_at) AS chargedAt,
      COALESCE(SUM(CASE WHEN fe.kind IN ('charge','legacy_charge') THEN fe.amount ELSE 0 END), 0) AS assessedAmount,
      COALESCE(-SUM(CASE WHEN fe.kind IN ('payment','reversal','legacy_credit') THEN fe.amount ELSE 0 END), 0) AS paidAmount,
      COALESCE(-SUM(CASE WHEN fe.kind = 'adjustment' THEN fe.amount ELSE 0 END), 0) AS adjustedAmount,
      COALESCE(SUM(fe.amount), 0) AS outstandingAmount,
      CASE WHEN COALESCE(SUM(fe.amount), 0) <= 0 THEN 'Settled' ELSE 'Outstanding' END AS status
      FROM borrowings b LEFT JOIN users u ON u.id=b.user_id LEFT JOIN books bk ON bk.id=b.book_id
      JOIN fine_accounts fa ON fa.borrowing_id=b.id JOIN fine_ledger_entries fe ON fe.borrowing_id=b.id
      WHERE ${where.join(" AND ")} GROUP BY b.id,u.name,u.student_employee_id,bk.title ORDER BY chargedAt DESC,b.id DESC`, params);
    return rows;
  }
  if (reportName === "date_due") {
    const where = ["b.deleted_at IS NULL", "b.status IN ('borrowed','overdue')", ...dateWhere("b.due_date", from, to, params)];
    if (search) { where.push("(u.name LIKE ? OR u.student_employee_id LIKE ? OR bk.title LIKE ?)"); params.push(like, like, like); }
    const [rows] = await db.query(`SELECT COALESCE(u.name,'Deleted patron') AS borrower,u.student_employee_id AS studentEmployeeId,COALESCE(bk.title,'Deleted book') AS title,b.due_date AS dueDate,b.status FROM borrowings b LEFT JOIN users u ON u.id=b.user_id LEFT JOIN books bk ON bk.id=b.book_id WHERE ${where.join(" AND ")} ORDER BY b.due_date ASC,b.id ASC`, params); return rows;
  }
  if (reportName === "daily_users" || reportName === "daily_stats") {
    const where = ["a.purpose='entry_exit'", "a.type='check_in'", ...dateWhere("a.created_at", from, to, params)];
    const [rows] = await db.query(`SELECT DATE(a.created_at) AS date, COUNT(DISTINCT a.user_id) AS uniqueUsers, COUNT(*) AS checkIns, ROUND(COUNT(*) / NULLIF(COUNT(DISTINCT a.user_id),0), 2) AS averageCheckInsPerUser FROM attendance_logs a LEFT JOIN users u ON u.id=a.user_id WHERE ${where.join(" AND ")} GROUP BY DATE(a.created_at) ORDER BY date DESC`, params); return rows;
  }
  if (reportName === "top_users") {
    const ranking = reportValue(filters, "ranking") || "borrowings";
    if (!["borrowings", "checkins"].includes(ranking)) throw Object.assign(new Error("Choose a valid user ranking."), { status: 400 });
    const params2 = []; const where = ["1=1", ...dateWhere(ranking === "borrowings" ? "b.borrowed_at" : "a.created_at", from, to, params2)];
    const source = ranking === "borrowings" ? "borrowings b LEFT JOIN users u ON u.id=b.user_id" : "attendance_logs a LEFT JOIN users u ON u.id=a.user_id";
    if (ranking === "borrowings") where.push("b.id IS NOT NULL");
    if (ranking === "checkins") where.push("a.purpose='entry_exit'", "a.type='check_in'");
    if (search) { where.push("(u.name LIKE ? OR u.student_employee_id LIKE ?)"); params2.push(like, like); }
    const [rows] = await db.query(`SELECT COALESCE(u.name,'Deleted patron') AS name,u.student_employee_id AS studentEmployeeId,COUNT(*) AS activityCount,'${ranking === "borrowings" ? "Borrowings" : "Library check-ins"}' AS activityType FROM ${source} WHERE ${where.join(" AND ")} GROUP BY u.id,u.name,u.student_employee_id ORDER BY activityCount DESC,u.name ASC LIMIT 10`, params2);
    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  }
  if (reportName === "resource_usage") {
    const where = ["b.id IS NOT NULL", ...dateWhere("b.borrowed_at", from, to, params)];
    if (search) { where.push("(bk.title LIKE ? OR b.loan_policy_name_snapshot LIKE ?)"); params.push(like, like); }
    const [rows] = await db.query(`SELECT COALESCE(bk.title,'Deleted book') AS title,COALESCE(NULLIF(b.loan_policy_name_snapshot,''),'Unknown historical policy') AS bookType,COUNT(*) AS borrowings,COUNT(DISTINCT b.user_id) AS uniqueBorrowers FROM borrowings b LEFT JOIN users u ON u.id=b.user_id LEFT JOIN books bk ON bk.id=b.book_id WHERE ${where.join(" AND ")} GROUP BY b.book_id,bk.title,b.loan_policy_name_snapshot ORDER BY borrowings DESC,title ASC`, params); return rows;
  }
  throw Object.assign(new Error("Report is not implemented."), { status: 400 });
}

function shape(reportName, rows) { return rows.map((row) => Object.fromEntries(columns[reportName].map(([key]) => [key, row[key] ?? null]))); }
async function listReport({ report: reportName = "fined", page, limit, ...filters }) {
  getReport(reportName); const currentPage = safePage(page); const currentLimit = safeLimit(limit);
  if (reportName === "holdings_inventory") {
    if (filters.dateFrom || filters.dateTo) throw Object.assign(new Error("Date filters do not apply to the current inventory snapshot."), { status: 400 });
    const { where, params } = holdingsWhere(filters);
    const [[count]] = await db.query(`SELECT COUNT(*) AS total FROM book_copies bc JOIN books bk ON bk.id = bc.book_id LEFT JOIN copy_holdings h ON h.copy_id = bc.id LEFT JOIN academic_programs ap ON ap.id = h.program_id WHERE ${where}`, params);
    const rows = shape(reportName, await holdingsRows(filters, { limit: currentLimit, offset: (currentPage - 1) * currentLimit }));
    const total = Number(count.total || 0);
    return { report: reportName, label: REPORTS[reportName].label, columns: columns[reportName].map(([key,label,type]) => ({ key,label,type })), rows, pagination: { page: currentPage, limit: currentLimit, total, totalPages: Math.max(Math.ceil(total/currentLimit),1) }, filters };
  }
  const all = shape(reportName, await rawRows(reportName, filters)); const total = all.length;
  return { report: reportName, label: REPORTS[reportName].label, columns: columns[reportName].map(([key,label,type]) => ({ key,label,type })), rows: all.slice((currentPage-1)*currentLimit,currentPage*currentLimit), pagination: { page: currentPage, limit: currentLimit, total, totalPages: Math.max(Math.ceil(total/currentLimit),1) }, filters };
}
async function exportReport({ report: reportName = "fined", ...filters }) {
  getReport(reportName);
  let raw;
  if (reportName === "holdings_inventory") {
    if (filters.dateFrom || filters.dateTo) throw Object.assign(new Error("Date filters do not apply to the current inventory snapshot."), { status: 400 });
    raw = await holdingsRows(filters, { limit: EXPORT_LIMIT + 1 });
  } else raw = await rawRows(reportName, filters);
  const rows = shape(reportName, raw);
  if (rows.length > EXPORT_LIMIT) throw Object.assign(new Error(`Exports are limited to ${EXPORT_LIMIT.toLocaleString()} records.`), { status: 400 });
  return { report: reportName, label: REPORTS[reportName].label, columns: columns[reportName].map(([key,label,type]) => ({ key,label,type })), rows, filters };
}
module.exports = { REPORTS, columns, listReport, exportReport, holdingsWhere, holdingsRows };

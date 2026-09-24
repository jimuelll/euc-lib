const db = require("../../db");
const clearanceService = require("../clearance/clearance.service");
const { availableToBorrow, hasAccession } = require("../catalog/copyEligibility");

const PAGE_LIMIT = 25;
const EXPORT_LIMIT = 10000;
const ROLES = ["scanner", "employee", "alumni", "student", "staff", "admin", "super_admin"];
const BORROWING_STATUSES = ["borrowed", "overdue", "returned"];
const RESERVATION_STATUSES = ["pending", "ready", "fulfilled", "cancelled", "expired"];

const DATASETS = {
  catalog: {
    label: "Catalog",
    dateField: "b.created_at",
    columns: [
      ["title", "Title"], ["author", "Author"], ["materialType", "Material type"], ["bookType", "Book type"],
      ["category", "Category"], ["isbn", "ISBN"], ["copies", "Physical copies"], ["activeAccessionedCopies", "Active accessioned"],
      ["needsAccessionCopies", "Needs accession"], ["availableCopies", "Available to borrow"], ["createdAt", "Added"],
    ],
    from: "FROM books b LEFT JOIN book_types bt ON bt.id = b.book_type_id",
    select: `b.title, b.author, b.material_type AS materialType, COALESCE(bt.name, 'Unassigned') AS bookType, COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(b.metadata, '$.category')), ''), 'Uncategorized') AS category, b.isbn,
      (SELECT COUNT(*) FROM book_copies physical WHERE physical.book_id = b.id AND physical.deleted_at IS NULL) AS copies,
      (SELECT COUNT(*) FROM book_copies active_h WHERE active_h.book_id = b.id AND active_h.deleted_at IS NULL AND active_h.is_active = 1 AND ${hasAccession("active_h")}) AS activeAccessionedCopies,
      (SELECT COUNT(*) FROM book_copies missing_h WHERE missing_h.book_id = b.id AND missing_h.deleted_at IS NULL AND missing_h.is_active = 1 AND NOT ${hasAccession("missing_h")}) AS needsAccessionCopies,
      (SELECT COUNT(*) FROM book_copies available_copy WHERE available_copy.book_id = b.id AND ${availableToBorrow("available_copy")}) AS availableCopies,
      b.created_at AS createdAt`,
    base: "b.deleted_at IS NULL",
    search: ["b.title", "b.author", "b.isbn"],
    order: "b.created_at DESC, b.id DESC",
    filters: ["materialType", "bookType", "category", "availability", "condition"],
  },
  users: {
    label: "Users",
    dateField: "u.created_at",
    columns: [["name", "Name"], ["studentEmployeeId", "Student / employee ID"], ["email", "Email"], ["role", "Role"], ["program", "Program / course"], ["status", "Account status"], ["createdAt", "Added"]],
    from: "FROM users u LEFT JOIN academic_programs ap ON ap.id = u.program_id",
    select: "u.name, u.student_employee_id AS studentEmployeeId, u.email, u.role, COALESCE(ap.name, 'Unassigned') AS program, IF(u.is_active = 1, 'Active', 'Inactive') AS status, u.created_at AS createdAt",
    base: "u.deleted_at IS NULL",
    search: ["u.name", "u.student_employee_id", "u.email"],
    order: "u.created_at DESC, u.id DESC",
    filters: ["role", "accountStatus", "program"],
  },
  borrowings: {
    label: "Borrowings",
    dateField: "b.borrowed_at",
    columns: [["borrower", "Borrower"], ["studentEmployeeId", "Student / employee ID"], ["borrowerRole", "Borrower role"], ["title", "Book"], ["bookType", "Loan policy at checkout"], ["barcode", "Copy barcode"], ["status", "Status"], ["borrowedAt", "Borrowed"], ["dueDate", "Due"], ["returnedAt", "Returned"], ["issuedBy", "Issued by"]],
    from: "FROM borrowings b LEFT JOIN users u ON u.id = b.user_id LEFT JOIN books bk ON bk.id = b.book_id LEFT JOIN book_copies bc ON bc.id = b.copy_id LEFT JOIN users issuer ON issuer.id = b.issued_by",
    select: "COALESCE(u.name, 'Deleted patron') AS borrower, u.student_employee_id AS studentEmployeeId, u.role AS borrowerRole, COALESCE(bk.title, 'Deleted book') AS title, COALESCE(NULLIF(b.loan_policy_name_snapshot, ''), 'Unknown historical policy') AS bookType, bc.barcode, b.status, b.borrowed_at AS borrowedAt, b.due_date AS dueDate, b.returned_at AS returnedAt, COALESCE(issuer.name, 'System') AS issuedBy",
    base: "b.id IS NOT NULL",
    search: ["u.name", "u.student_employee_id", "bk.title", "bc.barcode"],
    order: "b.borrowed_at DESC, b.id DESC",
    filters: ["status", "borrowerRole", "bookType", "issuedBy"],
  },
  reservations: {
    label: "Reservations",
    dateField: "r.reserved_at",
    columns: [["requester", "Requester"], ["studentEmployeeId", "Student / employee ID"], ["title", "Book"], ["bookType", "Current book policy"], ["status", "Status"], ["reservedAt", "Reserved"], ["expiresAt", "Expires"], ["fulfilledAt", "Fulfilled"]],
    from: "FROM reservations r LEFT JOIN users u ON u.id = r.user_id LEFT JOIN books b ON b.id = r.book_id LEFT JOIN book_types bt ON bt.id = b.book_type_id",
    select: "COALESCE(u.name, 'Deleted patron') AS requester, u.student_employee_id AS studentEmployeeId, COALESCE(b.title, 'Deleted book') AS title, COALESCE(bt.name, 'Unassigned') AS bookType, r.status, r.reserved_at AS reservedAt, r.expires_at AS expiresAt, r.fulfilled_at AS fulfilledAt",
    base: "r.id IS NOT NULL",
    search: ["u.name", "u.student_employee_id", "b.title"],
    order: "r.reserved_at DESC, r.id DESC",
    filters: ["status", "bookType"],
  },
  attendance: {
    label: "Attendance",
    dateField: "a.created_at",
    columns: [["name", "Patron"], ["studentEmployeeId", "Student / employee ID"], ["purpose", "Purpose"], ["type", "Scan type"], ["scannedBy", "Scanned by"], ["createdAt", "Scanned at"]],
    from: "FROM attendance_logs a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN users scanner ON scanner.id = a.scanned_by",
    select: "COALESCE(u.name, 'Deleted patron') AS name, u.student_employee_id AS studentEmployeeId, a.purpose, a.type, COALESCE(scanner.name, 'Self-service') AS scannedBy, a.created_at AS createdAt",
    base: "a.id IS NOT NULL",
    search: ["u.name", "u.student_employee_id"],
    order: "a.created_at DESC, a.id DESC",
    filters: ["purpose", "scanType"],
  },
  notifications: {
    label: "Notifications",
    dateField: "n.created_at",
    columns: [["title", "Title"], ["type", "Type"], ["audience", "Audience"], ["status", "Status"], ["expiresAt", "Expires"], ["createdAt", "Created"]],
    from: "FROM notifications n",
    select: "n.title, n.type, CASE n.audience_type WHEN 'user' THEN 'Individual user' WHEN 'role' THEN CONCAT('Role: ', n.audience_role) ELSE 'All users' END AS audience, CASE WHEN n.is_active = 0 THEN 'Inactive' WHEN n.expires_at IS NOT NULL AND n.expires_at < NOW() THEN 'Expired' ELSE 'Active' END AS status, n.expires_at AS expiresAt, n.created_at AS createdAt",
    base: "1 = 1",
    search: ["n.title", "n.body", "n.type"],
    order: "n.created_at DESC, n.id DESC",
    filters: ["audience", "notificationStatus"],
  },
  subscriptions: {
    label: "Academic subscriptions",
    dateField: "s.created_at",
    columns: [["title", "Title"], ["category", "Category"], ["url", "URL"], ["status", "Status"], ["createdAt", "Added"]],
    from: "FROM academic_subscriptions s",
    select: "s.title, COALESCE(s.category, 'Uncategorized') AS category, s.url, IF(s.is_active = 1, 'Active', 'Inactive') AS status, s.created_at AS createdAt",
    base: "s.deleted_at IS NULL",
    search: ["s.title", "s.description", "s.category"],
    order: "s.created_at DESC, s.id DESC",
    filters: ["category", "subscriptionStatus"],
  },
  clearance: {
    label: "Clearance exceptions",
    columns: [["name", "Patron"], ["studentEmployeeId", "Student / employee ID"], ["overdueCount", "Overdue returns"], ["oldestDueDate", "Oldest due date"], ["overdueTitles", "Overdue titles"], ["outstandingAmount", "Unpaid fines (PHP)"], ["fineRecords", "Fine records"]],
    filters: ["clearanceReason"],
  },
};

const isDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const value = (filters, key) => typeof filters[key] === "string" ? filters[key].trim() : "";
const safePage = (input) => Math.max(Number.parseInt(input, 10) || 1, 1);
const safeLimit = (input, max = 100) => Math.min(Math.max(Number.parseInt(input, 10) || PAGE_LIMIT, 1), max);

function getDataset(name) {
  if (!Object.hasOwn(DATASETS, name)) throw Object.assign(new Error("Choose a valid record type."), { status: 400 });
  return DATASETS[name];
}

function pushInFilter(where, params, column, rawValue, allowed) {
  if (!rawValue || rawValue === "all") return;
  if (!allowed.includes(rawValue)) throw Object.assign(new Error("One or more filters are invalid."), { status: 400 });
  where.push(`${column} = ?`); params.push(rawValue);
}

function pushIdFilter(where, params, column, rawValue) {
  if (!rawValue || rawValue === "all") return;
  if (!/^\d+$/.test(rawValue)) throw Object.assign(new Error("One or more filters are invalid."), { status: 400 });
  where.push(`${column} = ?`); params.push(Number(rawValue));
}

function buildWhere(datasetName, filters = {}) {
  const dataset = getDataset(datasetName);
  if (datasetName === "clearance") throw Object.assign(new Error("Clearance exceptions use a live query."), { status: 400 });
  const where = [dataset.base]; const params = [];
  const search = value(filters, "search");
  if (search) { where.push(`(${dataset.search.map((field) => `${field} LIKE ?`).join(" OR ")})`); params.push(...dataset.search.map(() => `%${search.slice(0, 120)}%`)); }
  const dateFrom = value(filters, "dateFrom"); const dateTo = value(filters, "dateTo");
  if (dateFrom && !isDate(dateFrom) || dateTo && !isDate(dateTo) || dateFrom && dateTo && dateFrom > dateTo) throw Object.assign(new Error("Provide a valid date range."), { status: 400 });
  if (dateFrom) { where.push(`DATE(${dataset.dateField}) >= ?`); params.push(dateFrom); }
  if (dateTo) { where.push(`DATE(${dataset.dateField}) <= ?`); params.push(dateTo); }

  if (datasetName === "catalog") {
    pushInFilter(where, params, "b.material_type", value(filters, "materialType"), ["book", "thesis"]);
    const bookType = value(filters, "bookType"); pushIdFilter(where, params, "bt.id", bookType);
    const category = value(filters, "category"); if (category && category !== "all") { where.push("JSON_UNQUOTE(JSON_EXTRACT(b.metadata, '$.category')) = ?"); params.push(category); }
    const availability = value(filters, "availability"); if (availability && availability !== "all") { if (!["available", "unavailable"].includes(availability)) throw Object.assign(new Error("One or more filters are invalid."), { status: 400 }); const hasAvailable = `EXISTS (SELECT 1 FROM book_copies avail_filter WHERE avail_filter.book_id = b.id AND ${availableToBorrow("avail_filter")})`; where.push(availability === "available" ? hasAvailable : `NOT ${hasAvailable}`); }
    const condition = value(filters, "condition"); if (condition && condition !== "all") { if (!["good", "damaged", "lost"].includes(condition)) throw Object.assign(new Error("One or more filters are invalid."), { status: 400 }); where.push("EXISTS (SELECT 1 FROM book_copies bc3 WHERE bc3.book_id = b.id AND bc3.deleted_at IS NULL AND bc3.condition = ?)"); params.push(condition); }
  }
  if (datasetName === "users") { pushInFilter(where, params, "u.role", value(filters, "role"), ROLES); const status = value(filters, "accountStatus"); if (status && status !== "all") { pushInFilter(where, params, "u.is_active", status, ["0", "1"]); } pushIdFilter(where, params, "ap.id", value(filters, "program")); }
  if (datasetName === "borrowings") {
    pushInFilter(where, params, "b.status", value(filters, "status"), BORROWING_STATUSES);
    pushInFilter(where, params, "u.role", value(filters, "borrowerRole"), ROLES);
    const policy = value(filters, "bookType");
    if (policy === "0") where.push("(b.loan_policy_id_snapshot IS NULL OR b.loan_policy_name_snapshot = 'Unknown historical policy')");
    else pushIdFilter(where, params, "b.loan_policy_id_snapshot", policy);
    pushIdFilter(where, params, "issuer.id", value(filters, "issuedBy"));
  }
  if (datasetName === "reservations") { pushInFilter(where, params, "r.status", value(filters, "status"), RESERVATION_STATUSES); pushIdFilter(where, params, "bt.id", value(filters, "bookType")); }
  if (datasetName === "attendance") { pushInFilter(where, params, "a.purpose", value(filters, "purpose"), ["entry_exit", "borrowing"]); pushInFilter(where, params, "a.type", value(filters, "scanType"), ["check_in", "check_out"]); }
  if (datasetName === "notifications") { const audience = value(filters, "audience"); if (audience && audience !== "all") { pushInFilter(where, params, "n.audience_type", audience === "public" ? "all" : audience, ["all", "user", "role"]); } const status = value(filters, "notificationStatus"); if (status === "active") where.push("n.is_active = 1 AND (n.expires_at IS NULL OR n.expires_at >= NOW())"); else if (status === "inactive") where.push("n.is_active = 0"); else if (status === "expired") where.push("n.expires_at IS NOT NULL AND n.expires_at < NOW()"); else if (status && status !== "all") throw Object.assign(new Error("One or more filters are invalid."), { status: 400 }); }
  if (datasetName === "subscriptions") { const category = value(filters, "category"); if (category && category !== "all") { where.push("s.category = ?"); params.push(category); } const status = value(filters, "subscriptionStatus"); if (status && status !== "all") pushInFilter(where, params, "s.is_active", status, ["0", "1"]); }
  return { dataset, clause: where.join(" AND "), params };
}

function queryColumns(dataset) {
  return dataset.columns.map(([key, label]) => ({ key, label, type: key === "oldestDueDate" ? "date" : ["createdAt", "borrowedAt", "dueDate", "returnedAt", "reservedAt", "expiresAt", "fulfilledAt"].includes(key) ? "dateTime" : ["copies", "activeAccessionedCopies", "needsAccessionCopies", "availableCopies", "overdueCount", "outstandingAmount", "fineRecords"].includes(key) ? "number" : "text" }));
}

function validateClearanceFilters(filters) {
  if (value(filters, "dateFrom") || value(filters, "dateTo")) throw Object.assign(new Error("Date filters do not apply to live clearance exceptions."), { status: 400 });
  const reason = value(filters, "clearanceReason");
  if (reason && !["all", "overdue", "fines", "both"].includes(reason)) throw Object.assign(new Error("Choose a valid clearance reason."), { status: 400 });
  return { search: value(filters, "search").slice(0, 120).toLocaleLowerCase(), reason };
}

function filterClearanceRows(rows, filters) {
  const { search, reason } = validateClearanceFilters(filters);
  return rows.filter((row) => {
    if (search && !`${row.name} ${row.studentEmployeeId} ${row.overdueTitles.join(" ")}`.toLocaleLowerCase().includes(search)) return false;
    if (reason === "overdue" && !row.overdueCount || reason === "fines" && !row.outstandingAmount || reason === "both" && (!row.overdueCount || !row.outstandingAmount)) return false;
    return true;
  }).map((row) => ({ ...row, overdueTitles: row.overdueTitles.join("; ") }));
}

async function getClearanceRows(filters) {
  validateClearanceFilters(filters);
  return filterClearanceRows(await clearanceService.getClearanceQueue(), filters);
}

async function listQuery({ dataset: datasetName = "catalog", page, limit, ...filters }) {
  const currentPage = safePage(page); const currentLimit = safeLimit(limit);
  if (datasetName === "clearance") {
    const dataset = getDataset(datasetName); const rows = await getClearanceRows(filters); const total = rows.length;
    const summary = rows.reduce((totals, row) => ({ overduePatrons: totals.overduePatrons + Number(row.overdueCount > 0), unpaidFinePatrons: totals.unpaidFinePatrons + Number(row.outstandingAmount > 0), overdueItems: totals.overdueItems + row.overdueCount, outstandingAmount: totals.outstandingAmount + row.outstandingAmount }), { overduePatrons: 0, unpaidFinePatrons: 0, overdueItems: 0, outstandingAmount: 0 });
    return { dataset: datasetName, label: dataset.label, columns: queryColumns(dataset), rows: rows.slice((currentPage - 1) * currentLimit, currentPage * currentLimit), pagination: { page: currentPage, limit: currentLimit, total, totalPages: Math.max(Math.ceil(total / currentLimit), 1) }, summary, filters };
  }
  const { dataset, clause, params } = buildWhere(datasetName, filters);
  const [[count]] = await db.query(`SELECT COUNT(*) AS total ${dataset.from} WHERE ${clause}`, params);
  const [rows] = await db.query(`SELECT ${dataset.select} ${dataset.from} WHERE ${clause} ORDER BY ${dataset.order} LIMIT ? OFFSET ?`, [...params, currentLimit, (currentPage - 1) * currentLimit]);
  return { dataset: datasetName, label: dataset.label, columns: queryColumns(dataset), rows, pagination: { page: currentPage, limit: currentLimit, total: Number(count.total), totalPages: Math.max(Math.ceil(Number(count.total) / currentLimit), 1) }, filters };
}

async function exportQuery({ dataset: datasetName = "catalog", ...filters }) {
  if (datasetName === "clearance") {
    const dataset = getDataset(datasetName); const rows = await getClearanceRows(filters);
    if (rows.length > EXPORT_LIMIT) throw Object.assign(new Error(`Exports are limited to ${EXPORT_LIMIT.toLocaleString()} records. Narrow the filters and try again.`), { status: 400 });
    return { dataset: datasetName, label: dataset.label, columns: queryColumns(dataset), rows, filters };
  }
  const { dataset, clause, params } = buildWhere(datasetName, filters);
  const [rows] = await db.query(`SELECT ${dataset.select} ${dataset.from} WHERE ${clause} ORDER BY ${dataset.order} LIMIT ?`, [...params, EXPORT_LIMIT + 1]);
  if (rows.length > EXPORT_LIMIT) throw Object.assign(new Error(`Exports are limited to ${EXPORT_LIMIT.toLocaleString()} records. Narrow the filters and try again.`), { status: 400 });
  return { dataset: datasetName, label: dataset.label, columns: queryColumns(dataset), rows, filters };
}

async function getQueryMeta() {
  const [[bookTypes], [categories], [programs], [issuers], [subscriptionCategories]] = await Promise.all([
    db.query("SELECT id, name FROM book_types WHERE is_active = 1 UNION SELECT DISTINCT COALESCE(loan_policy_id_snapshot, 0) AS id, COALESCE(NULLIF(loan_policy_name_snapshot, ''), 'Unknown historical policy') AS name FROM borrowings ORDER BY name ASC"),
    db.query("SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.category')) AS value FROM books WHERE deleted_at IS NULL AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.category')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.category')) <> '' ORDER BY value ASC"),
    db.query("SELECT id, name FROM academic_programs ORDER BY name ASC"),
    db.query("SELECT id, name FROM users WHERE deleted_at IS NULL AND role IN ('staff', 'admin', 'super_admin') ORDER BY name ASC"),
    db.query("SELECT DISTINCT category AS value FROM academic_subscriptions WHERE deleted_at IS NULL AND category IS NOT NULL AND category <> '' ORDER BY value ASC"),
  ]);
  return { datasets: Object.entries(DATASETS).map(([value, dataset]) => ({ value, label: dataset.label, filters: dataset.filters })), bookTypes, categories, programs, issuers, subscriptionCategories, roles: ROLES };
}

module.exports = { listQuery, exportQuery, getQueryMeta, buildWhere, filterClearanceRows, queryColumns, DATASETS };

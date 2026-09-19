const db = require("../db");
const { recordAuditEvent } = require("../modules/analytics/audit.service");

const ignoredPaths = new Set([
  "/api/analytics/visit",
  "/api/auth/refresh",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/change-password",
]);

function getCategory(path) {
  if (path.includes("/books") || path.includes("catalog-schema") || path.includes("book-types") || path.includes("/copies")) return "catalog";
  if (path.includes("/academic-") || path.includes("/library-") || path.includes("/holidays") || path.includes("/departments")) return "academic_settings";
  if (path.includes("/users")) return "users";
  if (path.includes("/borrowing") || path.includes("/borrows") || path.includes("/circulation")) return "borrowing";
  if (path.includes("/reservations")) return "reservation";
  if (path.includes("/bulletin")) return "bulletin";
  if (path.includes("/events")) return "events";
  if (path.includes("/site-content") || path.includes("/about")) return "content";
  if (path.includes("/notifications")) return "notifications";
  if (path.includes("/subscriptions")) return "subscriptions";
  if (path.includes("/user-guide")) return "content";
  if (path.includes("/backup")) return "backup";
  if (path.includes("/clearance")) return "clearance";
  if (path.includes("/attendance")) return "attendance";
  return "system";
}

function getAction(method, path) {
  if (path.includes("/restore")) return "restored";
  if (path.includes("/publish")) return "published";
  if (path.includes("/unpublish")) return "unpublished";
  if (path.includes("/reorder")) return "reordered";
 if (path.includes("/pin")) return "pinned";
  if (path.includes("/ready")) return "marked_ready";
  if (path.includes("/fulfill")) return "fulfilled";
  if (path.includes("/cancel")) return "cancelled";
 if (path.includes("/current")) return "set_current";
 if (path.includes("/reverse")) return "reversed";
 if (path.includes("/adjust")) return "adjusted";
 if (path.includes("/payment")) return "payment_recorded";
 if (path.includes("/scan")) return "scanned";
  if (path.endsWith("/return")) return "returned";
  if (path.endsWith("/renew")) return "renewed";
  if (path.endsWith("/borrow")) return "borrowed";
  return { POST: "created", PUT: "updated", PATCH: "updated", DELETE: "deleted" }[method] ?? "changed";
}

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const valueFor = (value) => {
  if (value === undefined) return "Not set";
  if (value === null || value === "") return "Cleared";
  if (value === true || value === 1 || value === "1") return "Yes";
  if (value === false || value === 0 || value === "0") return "No";
  if (typeof value === "object") {
    try {
      if (Array.isArray(value)) return value.map((entry) => typeof entry === "object" ? JSON.stringify(entry) : String(entry)).join(", ").slice(0, 240);
      return Object.entries(value).map(([key, entry]) => `${humanizeFieldKey(key)}=${typeof entry === "object" ? JSON.stringify(entry) : String(entry)}`).join("; ").slice(0, 240);
    } catch { return "[object]"; }
  }
  return String(value).slice(0, 180);
};

function describeTarget(body = {}, path = "", snapshot = null) {
  const value = body.title ?? body.name ?? body.label ?? snapshot?.title ?? snapshot?.name;
  if (typeof value === "string" && value.trim()) return `: “${value.trim().slice(0, 160)}”`;
  if (body.student_employee_id) return `: account ${String(body.student_employee_id).slice(0, 80)}`;
 if (body.userBarcode && body.bookBarcode) return `: copy ${String(body.bookBarcode).slice(0, 80)} for ${String(body.userBarcode).slice(0, 80)}`;
 if (body.bookId || body.book_id) return `: book #${body.bookId ?? body.book_id}`;
  if (body.borrowingId != null) return `: borrowing #${body.borrowingId}`;
  if (body.reservationId != null) return `: reservation #${body.reservationId}`;
  if (body.transactionId != null) return `: transaction #${body.transactionId}`;
  const identifier = path.match(/\/(\d+)(?:\/|$)/)?.[1] ?? path.match(/\/users\/([^/]+)(?:\/|$)/)?.[1];
  if (identifier) return ` (#${identifier})`;
  return "";
}

const fieldSets = [
  ["catalog-schema", [["key", "Field key"], ["label", "Label"], ["type", "Field type"], ["options", "Options"], ["required", "Required"], ["locked", "Locked"], ["public", "Public"], ["order", "Display order"], ["scope", "Applies to"], ["archived", "Archived"]]],
  ["book-types", [["name", "Policy name"], ["default_borrow_days", "Borrow days"], ["loan_duration_minutes", "Loan duration"], ["loan_duration_unit", "Duration unit"], ["fine_per_hour", "Recurring fine (PHP)"], ["fine_interval", "Fine interval"], ["initial_fine", "Initial fine (PHP)"], ["is_active", "Active"]]],
  ["/books", [["title", "Title"], ["author", "Author"], ["isbn", "ISBN"], ["material_type", "Material"], ["book_type_id", "Book type"], ["copies", "Copies"], ["metadata", "Catalogue details"], ["deleted_at", "Archived"]]],
  ["/copies", [["condition", "Condition"], ["notes", "Notes"], ["is_active", "Active"], ["deleted_at", "Archived"]]],
  ["/users", [["name", "Name"], ["student_employee_id", "Student / employee ID"], ["email", "Email"], ["role", "Role"], ["is_active", "Active"], ["program_id", "Program / course"], ["academic_term_id", "Academic term"], ["department_id", "Department"], ["address", "Address"], ["contact", "Contact"], ["year_level", "Year level"], ["remarks", "Remarks"], ["deleted_at", "Archived"]]],
  ["academic-terms", [["name", "Term"], ["starts_on", "Starts"], ["ends_on", "Ends"], ["is_current", "Current term"]]],
  ["academic-programs", [["name", "Program / course"], ["is_active", "Active"]]],
  ["departments", [["name", "Department"], ["is_active", "Active"]]],
  ["library-holidays", [["name", "Holiday"], ["holiday_date", "Date"], ["description", "Note"], ["is_active", "Active"]]],
  ["library-settings", [["overdue_fine_per_hour", "Overdue fine per hour (PHP)"]]],
  ["/events", [["title", "Event"], ["starts_at", "Starts"], ["ends_at", "Ends"]]],
  ["/notifications", [["title", "Title"], ["type", "Type"], ["audience_type", "Audience"], ["audience_role", "Audience role"], ["expires_at", "Expires"]]],
  ["/clearance", [["student_employee_id", "Patron ID"], ["amount", "Amount (PHP)"], ["reason", "Reason"], ["transactionId", "Transaction"]]],
  ["/circulation", [["userBarcode", "Borrower"], ["copyBarcode", "Copy barcode"], ["bookBarcode", "Copy barcode"], ["userId", "Borrower account"], ["bookId", "Book"], ["borrowingId", "Borrowing"], ["reservationId", "Reservation"], ["status", "Status"], ["due_date", "Due date"], ["returned_at", "Returned at"]]],
  ["/borrows", [["userBarcode", "Borrower"], ["bookBarcode", "Copy barcode"], ["dueDate", "Due date"], ["status", "Status"]]],
  ["/reservations", [["userBarcode", "Borrower"], ["bookId", "Book"], ["status", "Status"], ["notes", "Notes"]]],
 ["/subscriptions", [["title", "Title"], ["url", "URL"], ["description", "Description"], ["category", "Category"], ["image_url", "Image"], ["is_active", "Active"], ["sort_order", "Order"], ["deleted_at", "Archived"]]],
  ["/user-guide", [["slug", "Address"], ["title", "Title"], ["category", "Category"], ["summary", "Summary"], ["overview", "Overview"], ["target_path", "Admin link"], ["audience_roles", "Audience"], ["before_you_begin", "Preparation"], ["steps", "Steps"], ["warnings", "Warnings"], ["troubleshooting", "Troubleshooting"], ["image_url", "Image"], ["is_published", "Published"], ["deleted_at", "Archived"]]],
 ["/site-content", [["hero_kicker", "Hero kicker"], ["hero_title", "Hero title"], ["hero_highlight", "Hero highlight"], ["hero_description", "Hero description"], ["hero_image_url", "Hero image"], ["hero_stats", "Hero statistics"], ["hours", "Library hours"], ["address", "Address"], ["contact_email", "Contact email"], ["contact_phone", "Contact phone"]]],
  ["/about", [["library_name", "Library name"], ["established", "Established"], ["mission_title", "Mission title"], ["mission_text", "Mission"], ["history_title", "History title"], ["history_text", "History"], ["policies", "Policies"], ["facilities", "Facilities"], ["staff", "Staff"], ["spaces", "Spaces"]]],
];

function fieldsForPath(path) {
  return fieldSets.find(([needle]) => path.includes(needle))?.[1] ?? [];
}

function humanizeFieldKey(key) {
  return String(key).replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function catalogFieldLabels(before, after) {
  const rows = after?.__auditSchema ?? before?.__auditSchema ?? [];
  return new Map((Array.isArray(rows) ? rows : []).map((field) => [field.key, field.label]));
}

function parseJson(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}

function normalizeComparable(value) {
  const parsed = parseJson(value);
  if (parsed === undefined || parsed === null || (typeof parsed === "string" && !parsed.trim())) return null;
  if (Array.isArray(parsed) && parsed.length === 0) return null;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).length === 0) return null;
  if (parsed && typeof parsed === "object") return JSON.stringify(parsed);
  return parsed == null ? parsed : String(parsed);
}

function change(field, label, before, after) {
  if (normalizeComparable(before) === normalizeComparable(after)) return null;
  return { field: label, before: valueFor(before), after: valueFor(after) };
}

function addedChanges(changes) {
  return changes
    .filter((entry) => entry?.after && entry.after !== "Cleared" && entry.after !== "Not set")
    .map((entry) => ({ field: `Added ${entry.field}`, value: entry.after }));
}

function bodyChanges(path, body = {}, before = null) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  return fieldsForPath(path).map(([key, label]) => {
    if (!has(body, key)) return null;
    return change(key, label, before?.[key], body[key]);
  }).filter(Boolean);
}

function snapshotChanges(path, before, after, body = {}) {
  if (path.includes("/user-guide/")) {
    const oldContent = parseJson(before?.draft_content, {});
    const newContent = after ? parseJson(after.draft_content, {}) : body;
    const fields = fieldsForPath(path);
    return fields.flatMap(([key, label]) => change(key, label, oldContent?.[key] ?? before?.[key], newContent?.[key] ?? after?.[key]) || []);
  }
  if (path.includes("catalog-schema")) {
    const oldFields = Array.isArray(before) ? before : [];
    const newFields = Array.isArray(after) ? after : (Array.isArray(body.fields) ? body.fields : []);
    const oldByKey = new Map(oldFields.map((field) => [field.key, field]));
    const newByKey = new Map(newFields.map((field) => [field.key, field]));
    const keys = new Set([...oldByKey.keys(), ...newByKey.keys()]);
    return [...keys].sort().flatMap((key) => {
      const oldField = oldByKey.get(key); const newField = newByKey.get(key);
      return fieldsForPath(path).flatMap(([field, label]) => change(`${key}.${field}`, `${key} · ${label}`, oldField?.[field], newField?.[field]) || []);
    });
  }
  if (path.includes("/books")) {
    const coreChanges = fieldsForPath(path)
      .filter(([key]) => key !== "metadata")
      .flatMap(([key, label]) => {
        const nextValue = after && has(after, key) ? after[key] : body[key];
        return change(key, label, before?.[key], nextValue) || [];
      });
    const oldMetadata = parseJson(before?.metadata) || {};
    const newMetadata = parseJson(after?.metadata ?? body.metadata) || {};
    const labels = catalogFieldLabels(before, after);
    const metadataKeys = new Set([
      ...Object.keys(oldMetadata || {}),
      ...Object.keys(newMetadata || {}),
      ...Object.keys(body || {}).filter((key) => !["title", "author", "isbn", "material_type", "book_type_id", "copies", "metadata"].includes(key)),
    ]);
    const hasPersistedMetadata = Boolean(after && has(after, "metadata"));
    const metadataChanges = [...metadataKeys].sort().flatMap((key) =>
      change(`metadata.${key}`, labels.get(key) || humanizeFieldKey(key), oldMetadata?.[key], hasPersistedMetadata ? newMetadata?.[key] : body[key]) || []
    );
    return [...coreChanges, ...metadataChanges];
  }
  if (!before && !after) return bodyChanges(path, body);
  const fields = fieldsForPath(path);
  return fields.flatMap(([key, label]) => {
    const nextValue = after ? after[key] : body[key];
    return change(key, label, before?.[key], nextValue) || [];
  });
}

function targetFromPath(path, body = {}) {
  const numeric = path.match(/\/(\d+)(?:\/|$)/)?.[1];
  if (path.includes("/users/")) return { kind: "user", value: decodeURIComponent(path.split("/users/")[1].split("/")[0]) };
 if (path.includes("catalog-schema")) return { kind: "catalog_schema" };
 if (path.includes("library-settings")) return { kind: "library_settings" };
  if (path.includes("/circulation/") && body.borrowingId) return { kind: "id", value: Number(body.borrowingId) };
 if (numeric) return { kind: "id", value: Number(numeric) };
  return body.student_employee_id ? { kind: "user", value: body.student_employee_id } : null;
}

async function readSnapshot(path, body = {}) {
  const target = targetFromPath(path, body);
  if (path.includes("catalog-schema")) {
    const [rows] = await db.query("SELECT `key`, label, type, options, required, locked, `order`, public, archived, scope FROM catalog_schema ORDER BY `order`, `key`");
    return rows;
  }
  if (path.includes("library-settings")) { const [[row]] = await db.query("SELECT overdue_fine_per_hour FROM library_circulation_settings WHERE id = 1 LIMIT 1"); return row || null; }
  if (path.includes("site-content")) { const [[row]] = await db.query("SELECT * FROM site_content_settings LIMIT 1"); return row || null; }
  if (path.includes("/about")) { const [[row]] = await db.query("SELECT * FROM about_settings LIMIT 1"); return row || null; }
  if (path.endsWith("/books")) {
    const [schemaRows] = await db.query("SELECT `key`, label FROM catalog_schema");
    return { __auditSchema: schemaRows };
  }
  if (!target) return null;
  if (path.includes("/circulation/") && body.borrowingId) {
    const [[row]] = await db.query("SELECT id, status, due_date, returned_at, deleted_at, user_id, book_id, copy_id FROM borrowings WHERE id = ? LIMIT 1", [body.borrowingId]);
    return row || null;
  }
  const queries = [
    ["/books/", "SELECT id, title, author, isbn, material_type, book_type_id, copies, metadata, deleted_at FROM books WHERE id = ? LIMIT 1"],
    ["/book-types/", "SELECT id, name, default_borrow_days, loan_duration_minutes, loan_duration_unit, fine_per_hour, fine_interval, initial_fine, is_active FROM book_types WHERE id = ? LIMIT 1"],
    ["/copies/", "SELECT id, condition, notes, is_active, deleted_at FROM book_copies WHERE id = ? LIMIT 1"],
    ["/academic-terms/", "SELECT id, name, starts_on, ends_on, is_current FROM academic_terms WHERE id = ? LIMIT 1"],
    ["/academic-programs/", "SELECT id, name, is_active FROM academic_programs WHERE id = ? LIMIT 1"],
    ["/departments/", "SELECT id, name, is_active FROM departments WHERE id = ? LIMIT 1"],
    ["/library-holidays/", "SELECT id, name, holiday_date, description, is_active FROM library_holidays WHERE id = ? LIMIT 1"],
    ["/events/", "SELECT id, title, starts_at, ends_at FROM library_events WHERE id = ? LIMIT 1"],
    ["/notifications/", "SELECT id, title, type, audience_type, audience_role, expires_at FROM notifications WHERE id = ? LIMIT 1"],
    ["/subscriptions/", "SELECT id, title, url, description, category, image_url, is_active, sort_order, deleted_at FROM academic_subscriptions WHERE id = ? LIMIT 1"],
    ["/user-guide/", "SELECT id, slug, sort_order, draft_content, published_content, is_published, deleted_at FROM user_guide_modules WHERE id = ? LIMIT 1"],
    ["/reservations/", "SELECT id, status, notes, user_id, book_id FROM reservations WHERE id = ? LIMIT 1"],
    ["/borrows/", "SELECT id, status, due_date, returned_at, deleted_at, user_id, book_id, copy_id FROM borrowings WHERE id = ? LIMIT 1"],
    ["/clearance/transactions/", "SELECT id, transaction_type, amount, reason, reverses_transaction_id FROM clearance_transactions WHERE id = ? LIMIT 1"],
  ];
  const found = queries.find(([needle]) => path.includes(needle) && !(needle === "/borrows/" && path.includes("/borrowing/borrows/") && !path.endsWith("/return")));
  if (found) {
    const [[row]] = await db.query(found[1], [target.value]);
    if (!row) return null;
    if (found[0] === "/books/") {
      const [schemaRows] = await db.query("SELECT `key`, label FROM catalog_schema");
      row.__auditSchema = schemaRows;
    }
    return row;
  }
  if (target.kind === "user") {
    const [[row]] = await db.query("SELECT id, student_employee_id, name, email, role, is_active, program_id, academic_term_id, department_id, address, contact, year_level, remarks, deleted_at FROM users WHERE student_employee_id = ? LIMIT 1", [target.value]);
    return row || null;
  }
  return null;
}

function getDescription(method, path, body, before, after) {
  if (path.includes("/backup/snapshots") && method === "POST") return "Saved a manual snapshot";
  if (path.includes("/circulation") && method === "POST") return `Processed circulation${describeTarget(body, path, after || before)}`;
  const resource = path.includes("catalog-schema") ? "catalog schema"
    : path.includes("book-types") ? "book type policy"
      : path.includes("/books") ? "catalog record"
        : path.includes("/copies") ? "copy condition"
          : path.includes("academic-terms") ? "academic term"
            : path.includes("academic-programs") ? "program / course"
              : path.includes("departments") ? "department"
                : path.includes("library-holidays") ? "holiday"
                  : path.includes("library-settings") ? "circulation settings"
                    : path.includes("/users") ? "user account"
                      : path.includes("site-content") ? "homepage content"
                        : path.includes("/about") ? "about content"
                          : path.includes("/events") ? "event"
                            : path.includes("/notifications") ? "notification"
                                : path.includes("/user-guide") ? "user guide"
                                  : path.includes("/reservations") ? "reservation"
                                    : path.includes("/clearance") ? "clearance transaction"
                                      : path.includes("/borrows") || path.includes("/circulation") ? "circulation record"
                                        : path.includes("/subscriptions") ? "subscription"
                                          : path.replace(/^\/api\/(admin\/)?/, "").replace(/\/[0-9]+(?=\/|$)/g, "").replace(/[-_/]/g, " ").replace(/\s+/g, " ").trim();
  const verb = { POST: "Created", PUT: "Updated", PATCH: "Updated", DELETE: "Deleted" }[method] ?? "Changed";
  if (path.includes("/current")) return `Set current ${resource}${describeTarget(body, path, after || before)}`;
  if (path.includes("/restore")) return `Restored ${resource}${describeTarget(body, path, after || before)}`;
  if (path.includes("/publish")) return `Published ${resource}${describeTarget(body, path, after || before)}`;
  if (path.includes("/unpublish")) return `Unpublished ${resource}${describeTarget(body, path, after || before)}`;
  if (path.includes("/return")) return `Returned ${resource}${describeTarget(body, path, after || before)}`;
  if (path.includes("/renew")) return `Renewed ${resource}${describeTarget(body, path, after || before)}`;
  if (path.endsWith("/borrow")) return `Borrowed ${resource}${describeTarget(body, path, after || before)}`;
  if (path.includes("/ready")) return `Marked ready ${resource}${describeTarget(body, path, after || before)}`;
  if (path.includes("/fulfill")) return `Fulfilled ${resource}${describeTarget(body, path, after || before)}`;
  if (path.includes("/cancel")) return `Cancelled ${resource}${describeTarget(body, path, after || before)}`;
  if (path.includes("/reverse")) return `Reversed ${resource}${describeTarget(body, path, after || before)}`;
  if (path.includes("/adjust")) return `Adjusted ${resource}${describeTarget(body, path, after || before)}`;
  return `${verb} ${resource || "system data"}${describeTarget(body, path, after || before)}`;
}

function metadataFor(path, body, before, after, details = null, isCreation = false) {
  const changes = isCreation ? addedChanges(snapshotChanges(path, before, after, body)) : snapshotChanges(path, before, after, body);
  const metadata = { changes };
 if (body.reason && (path.includes("/clearance") || path.includes("/reverse") || path.includes("/adjust"))) metadata.reason = valueFor(body.reason);
  if (path.includes("/users") && body.password) metadata.security_change = "Password value withheld; password changed";
  if (after?.id != null) metadata.target_id = after.id;
  if (body.transactionId != null) metadata.transaction_id = body.transactionId;
 if (body.receiptNumber != null) metadata.receipt_number = body.receiptNumber;
  if (path.includes("/reorder") && Array.isArray(body.ids)) metadata.order = body.ids;
  if (details && typeof details === "object") {
    const detailKeys = { amount: "amount", transactionId: "transaction_id", receiptNumber: "receipt_number", borrowingId: "borrowing_id", reservationId: "reservation_id" };
    for (const [source, target] of Object.entries(detailKeys)) {
      if (details[source] !== undefined && details[source] !== null) metadata[target] = valueFor(details[source]);
    }
  }
  return changes.length || Object.keys(metadata).length > 1 || Boolean(before && after) ? metadata : null;
}

// Captures successful mutations without persisting request bodies, credentials,
// tokens, passwords, or other sensitive input. Supported records are read
// before the handler and again after a successful response.
async function auditLogger(req, res, next) {
  const isSnapshotRestore = req.path.includes("/backup/") && req.path.includes("/restore");
  const shouldAudit = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !ignoredPaths.has(req.path) && !isSnapshotRestore;
  if (!shouldAudit) return next();

  const path = req.originalUrl?.split("?")[0] || req.path;
  let before = null;
  try { before = await readSnapshot(path, req.body); } catch (error) { console.error("[audit] Failed to read pre-change snapshot:", error.message); }

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    void (async () => {
      let after = null;
      try { after = await readSnapshot(path, req.body); } catch (error) { console.error("[audit] Failed to read post-change snapshot:", error.message); }
      const isCreation = req.method === "POST" && getAction(req.method, path) === "created";
      const metadata = metadataFor(path, req.body, before, after, res.locals.auditDetails, isCreation);
      const baseDescription = getDescription(req.method, path, req.body, before, after);
      const noChange = ["PUT", "PATCH"].includes(req.method)
        && before && after && Array.isArray(metadata?.changes) && metadata.changes.length === 0;
      const description = noChange ? baseDescription.replace(/^(Updated|Changed) /, "Saved ") + " with no changes" : baseDescription;
      await recordAuditEvent({
        actorId: req.user?.id ?? null,
        category: getCategory(path),
        action: getAction(req.method, path),
        description,
        route: path.slice(0, 255),
        metadata,
      });
    })().catch((error) => console.error("[audit] Failed to record event:", error.message));
  });
  next();
}

module.exports = auditLogger;

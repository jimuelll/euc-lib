const db = require("../db");
const { enqueueAuditEvent } = require("../modules/analytics/audit.service");
const { copyLabel } = require("../modules/analytics/audit.copy-label");

const ignoredPaths = new Set([
  "/api/analytics/visit",
  "/api/auth/refresh",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/change-password",
]);

const excludedMutationPaths = new Set([
  "/api/admin/dashboard/ai-report",
  "/api/admin/backup/compatibility",
]);

const AUDIT_ROUTE_POLICIES = [
  { prefix: "/api/admin/users/bulk-deactivate-student-like", methods: ["POST"], type: "affected_records" },
  { prefix: "/api/admin/users", methods: ["POST", "PUT", "PATCH", "DELETE"], type: "field_changes" },
  { prefix: "/api/admin/catalog-schema", methods: ["PUT"], type: "field_changes" },
  { prefix: "/api/admin/catalog-settings", methods: ["PUT"], type: "field_changes" },
  { prefix: "/api/admin/book-types", methods: ["POST", "PUT"], type: "field_changes" },
  { prefix: "/api/admin/book-types", methods: ["DELETE"], type: "affected_records" },
  { prefix: "/api/admin/books", methods: ["POST", "PUT", "PATCH", "DELETE"], type: "field_changes" },
  { prefix: "/api/admin/copies", methods: ["PUT", "PATCH"], type: "field_changes" },
  { prefix: "/api/admin/copies", methods: ["POST"], type: "state_transition" },
  { prefix: "/api/admin/academic-terms", methods: ["POST", "PUT", "PATCH", "DELETE"], type: "field_changes" },
  { prefix: "/api/admin/academic-programs", methods: ["POST", "PUT", "PATCH", "DELETE"], type: "field_changes" },
  { prefix: "/api/admin/departments", methods: ["POST", "PUT", "PATCH", "DELETE"], type: "field_changes" },
  { prefix: "/api/admin/library-holidays", methods: ["POST", "PUT", "PATCH", "DELETE"], type: "field_changes" },
  { prefix: "/api/admin/library-settings", methods: ["PUT"], type: "field_changes" },
  { prefix: "/api/site-content", methods: ["PUT"], type: "field_changes" },
  { prefix: "/api/about", methods: ["PUT"], type: "field_changes" },
  { prefix: "/api/admin/about", methods: ["PUT"], type: "field_changes" },
  { prefix: "/api/events", methods: ["POST", "PUT", "PATCH", "DELETE"], type: "field_changes" },
  { prefix: "/api/admin/notifications", methods: ["POST", "PUT", "PATCH", "DELETE"], type: "field_changes" },
  { prefix: "/api/admin/subscriptions", methods: ["POST", "PUT", "PATCH", "DELETE"], type: "field_changes" },
  { prefix: "/api/admin/user-guide", methods: ["POST", "PUT", "PATCH", "DELETE"], type: "field_changes" },
  { prefix: "/api/bulletin", methods: ["POST", "PUT", "PATCH", "DELETE"], type: "state_transition", exclude: /\/(?:like|comments)(?:\/|$)/ },
  { prefix: "/api/attendance/scan", methods: ["POST"], type: "state_transition" },
  { prefix: "/api/admin/circulation", methods: ["POST"], type: "state_transition" },
  { prefix: "/api/borrowing/scan", methods: ["POST"], type: "state_transition" },
  { prefix: "/api/borrowing/borrows", methods: ["POST"], type: "state_transition" },
  { prefix: "/api/borrowing/admin/borrows", methods: ["PATCH", "DELETE"], type: "state_transition" },
  { prefix: "/api/reservations", methods: ["POST", "PATCH", "DELETE"], type: "state_transition" },
  { prefix: "/api/admin/reservations", methods: ["POST", "PATCH", "DELETE"], type: "state_transition" },
  { prefix: "/api/clearance", methods: ["POST", "PATCH", "DELETE"], type: "state_transition" },
  { prefix: "/api/admin/clearance", methods: ["POST", "PATCH", "DELETE"], type: "state_transition" },
  { prefix: "/api/admin/backup", methods: ["POST"], type: "affected_records", exclude: /\/compatibility$/ },
  { prefix: "/api/admin/recommendations/books", methods: ["PUT", "PATCH"], type: "field_changes" },
  { prefix: "/api/admin/recommendations/embeddings/backfill", methods: ["POST"], type: "affected_records" },
  { prefix: "/api/admin/subscriptions/reorder", methods: ["PATCH"], type: "affected_records" },
  { prefix: "/api/admin/user-guide/reorder", methods: ["PATCH"], type: "affected_records" },
  { prefix: "/api/borrowing/admin/payments/settle", methods: ["POST"], type: "affected_records" },
];

function getAuditPolicy(method, path) {
  if (!new Set(["POST", "PUT", "PATCH", "DELETE"]).has(method) || ignoredPaths.has(path) || excludedMutationPaths.has(path)) return null;
  return AUDIT_ROUTE_POLICIES.filter((policy) => path.startsWith(policy.prefix) && policy.methods.includes(method) && !policy.exclude?.test(path)).sort((a, b) => b.prefix.length - a.prefix.length)[0] ?? null;
}

function getCategory(path) {
  if (path.includes("/books") || path.includes("catalog-schema") || path.includes("book-types") || path.includes("/copies") || path.includes("catalog-settings")) return "catalog";
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
const booleanAuditFields = new Set([
  "active", "archived", "is_active", "is_current", "is_published",
  "locked", "public", "required", "show_unheld_in_opac",
]);
const valueFor = (value, field = "") => {
  if (value === undefined) return "Not set";
  if (value === null || value === "") return "Cleared";
  const isBooleanField = booleanAuditFields.has(String(field).toLowerCase());
  if (value === true || (isBooleanField && (value === 1 || value === "1"))) return "Yes";
  if (value === false || (isBooleanField && (value === 0 || value === "0"))) return "No";
  if (typeof value === "object") {
    try {
      if (Array.isArray(value)) return value.map((entry) => typeof entry === "object" ? JSON.stringify(entry) : String(entry)).join(", ").slice(0, 240);
      return Object.entries(value).map(([key, entry]) => `${humanizeFieldKey(key)}=${typeof entry === "object" ? JSON.stringify(entry) : String(entry)}`).join("; ").slice(0, 240);
    } catch { return "[object]"; }
  }
  return String(value).slice(0, 180);
};

function describeTarget(body = {}, path = "", snapshot = null) {
  if (path.includes("/users")) return ": user account";
  const value = body.title ?? body.name ?? body.label ?? snapshot?.title ?? snapshot?.name;
  if (typeof value === "string" && value.trim()) return `: “${value.trim().slice(0, 160)}”`;
 if (body.bookBarcode) return `: copy ${String(body.bookBarcode).slice(0, 80)}`;
 if (body.bookId || body.book_id) return `: book #${body.bookId ?? body.book_id}`;
  if (body.borrowingId != null) return `: borrowing #${body.borrowingId}`;
  if (body.reservationId != null) return `: reservation #${body.reservationId}`;
  if (body.transactionId != null) return `: transaction #${body.transactionId}`;
  const identifier = path.includes("/users/") ? null : path.match(/\/(\d+)(?:\/|$)/)?.[1];
  if (identifier) return ` (#${identifier})`;
  return "";
}

const fieldSets = [
  ["catalog-schema", [["key", "Field key"], ["label", "Label"], ["type", "Field type"], ["options", "Options"], ["required", "Required"], ["locked", "Locked"], ["public", "Public"], ["order", "Display order"], ["scope", "Applies to"], ["archived", "Archived"]]],
  ["book-types", [["name", "Policy name"], ["default_borrow_days", "Borrow days"], ["loan_duration_minutes", "Loan duration"], ["loan_duration_unit", "Duration unit"], ["fine_per_hour", "Recurring fine (PHP)"], ["fine_interval", "Fine interval"], ["initial_fine", "Initial fine (PHP)"], ["is_active", "Active"]]],
  ["/books", [["title", "Title"], ["author", "Author"], ["isbn", "ISBN"], ["material_type", "Material"], ["book_type_id", "Book type"], ["copies", "Copies"], ["metadata", "Catalogue details"], ["deleted_at", "Archived"]]],
  ["/holding", [["accession_number", "Accession number"], ["price", "Price (PHP)"], ["program_id", "Program / course"], ["course_code", "Course code"], ["location", "Location"], ["date_acquired", "Date acquired"], ["distributor", "Distributor"], ["invoice_reference", "Invoice reference"]]],
  ["/copies", [["condition", "Condition"], ["notes", "Notes"], ["is_active", "Active"], ["deleted_at", "Archived"]]],
  ["catalog-settings", [["show_unheld_in_opac", "Show books without holdings in OPAC"]]],
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
  const key = String(field).toLowerCase(); const caption = String(label).toLowerCase();
  const sensitive = /(password|token|secret|email|phone|contact|address|user.?id|student_employee|student employee|personal|birth|date of birth|remarks|notes|reason|distributor)/i.test(`${key} ${caption}`)
    || key === "name" && !/(program|course|term|department|holiday)/i.test(caption)
    || caption === "name";
  if (sensitive) return { field: label, value: "Changed" };
  return { field: label, before: valueFor(before, key), after: valueFor(after, key) };
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
  if (path.includes("/clearance/") && after && has(after, "transaction_type")) {
    const transactionBefore = path.endsWith("/reverse") ? null : before;
    const changes = [change("amount", "Amount (PHP)", transactionBefore?.amount ?? "Not recorded", after.amount)].filter(Boolean);
    if (after.receipt_number && transactionBefore?.receipt_number !== after.receipt_number) {
      changes.push(change("receipt_number", "Receipt reference", transactionBefore?.receipt_number ?? "Not recorded", after.receipt_number));
    }
    if (transactionBefore?.transaction_type !== after.transaction_type) {
      changes.push(change("transaction_type", "Transaction type", transactionBefore?.transaction_type ?? "Not recorded", after.transaction_type));
    }
    return changes;
  }
  if (path.includes("/copies/") && path.endsWith("/holding")) {
    return fieldsForPath(path).flatMap(([key, label]) => {
      const bodyKey = { accession_number: "accession_number", price: "price", program_id: "program_id", course_code: "course_code", location: "location", date_acquired: "date_acquired", distributor: "distributor", invoice_reference: "invoice_reference" }[key];
      return change(key, label, before?.[key], after && has(after, key) ? after[key] : body[bodyKey]) || [];
    });
  }
  if (path.includes("/admin/recommendations/books/")) {
    const oldMetadata = parseJson(before?.enrichment_json) || {};
    const newMetadata = parseJson(after?.enrichment_json ?? body) || {};
    return [
      change("description", "AI book summary", oldMetadata.description, newMetadata.description) || [],
      change("subjects", "AI book subjects", oldMetadata.subjects, newMetadata.subjects) || [],
      change("publisher", "AI book publisher", oldMetadata.publisher, newMetadata.publisher) || [],
      change("categories", "AI book categories", oldMetadata.categories, newMetadata.categories) || [],
      change("language", "AI book language", oldMetadata.language, newMetadata.language) || [],
      change("pageCount", "AI book page count", oldMetadata.pageCount, newMetadata.pageCount) || [],
      change("publishedDate", "AI book publication date", oldMetadata.publishedDate, newMetadata.publishedDate) || [],
    ].flat();
  }
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

const auditValuesEqual = (left, right, field = "") => {
  const normalizeDate = (value) => value instanceof Date
    ? value.toISOString().slice(0, 10)
    : typeof value === "string" && /(?:^date_acquired$|_date$|^starts_on$|^ends_on$|^holiday_date$)/i.test(field)
      ? value.slice(0, 10)
      : value;
  const normalizedLeft = normalizeComparable(normalizeDate(left));
  const normalizedRight = normalizeComparable(normalizeDate(right));
  if (normalizedLeft === normalizedRight) return true;
  if (normalizedLeft == null || normalizedRight == null) return false;
  const leftNumber = Number(normalizedLeft);
  const rightNumber = Number(normalizedRight);
  return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber;
};

// The generic logger reads after the route handler, which may commit before a
// concurrent request updates the same row. Do not attribute a later edit to
// this request: require every allowlisted field to match this request's input
// or its pre-request value before showing a before → after comparison.
function snapshotChangedSinceRequest(path, method, body, before, after, policy) {
  const action = getAction(method, path);
  if (!before || !after || !policy || !["field_changes", "state_transition"].includes(policy.type)) return false;
  if (path.includes("catalog-schema") || path.includes("/recommendations/")) return false;
  const fields = fieldsForPath(path);
  if (!fields.length) return false;

  if (policy.type === "state_transition") {
    const expectedStatus = {
      marked_ready: "ready",
      cancelled: "cancelled",
      fulfilled: "fulfilled",
      returned: "returned",
      borrowed: "borrowed",
    }[action];
    if (expectedStatus && fields.some(([key]) => key === "status") && !auditValuesEqual(after.status, expectedStatus, "status")) return true;
  }
  if (action !== "updated") return false;

  const beforeMetadata = path.includes("/books") ? parseJson(before.metadata) || {} : {};
  const afterMetadata = path.includes("/books") ? parseJson(after.metadata) || {} : {};
  const schemaKeys = new Set((after.__auditSchema ?? before.__auditSchema ?? []).map((field) => field.key));
  for (const [key] of fields) {
    if (key === "metadata" && path.includes("/books")) {
      const metadataKeys = new Set([...Object.keys(beforeMetadata), ...Object.keys(afterMetadata)]);
      for (const metadataKey of metadataKeys) {
        const hasDirectValue = has(body, metadataKey) && schemaKeys.has(metadataKey);
        const hasNestedValue = body.metadata && typeof body.metadata === "object" && has(body.metadata, metadataKey);
        const expected = hasDirectValue ? body[metadataKey] : hasNestedValue ? body.metadata[metadataKey] : beforeMetadata[metadataKey];
        if (!auditValuesEqual(afterMetadata[metadataKey], expected, metadataKey)) return true;
      }
      continue;
    }
    const expected = has(body, key) ? body[key] : before[key];
    if (!auditValuesEqual(after[key], expected, key)) return true;
  }
  return false;
}

function targetFromPath(path, body = {}) {
  if (/^\/api\/reservations\/\d+$/.test(path)) {
    return body.reservationId ? { kind: "id", value: Number(body.reservationId) } : null;
  }
  const numeric = path.match(/\/(\d+)(?:\/|$)/)?.[1];
  if (path.includes("/users/")) return { kind: "user", value: decodeURIComponent(path.split("/users/")[1].split("/")[0]) };
  if (path.includes("catalog-schema")) return { kind: "catalog_schema" };
  if (path.includes("library-settings")) return { kind: "library_settings" };
  if (path.includes("catalog-settings")) return { kind: "catalog_settings" };
  if (path.includes("/circulation/") && body.borrowingId) return { kind: "id", value: Number(body.borrowingId) };
 if (numeric) return { kind: "id", value: Number(numeric) };
  return body.student_employee_id ? { kind: "user", value: body.student_employee_id } : null;
}

async function readSnapshot(path, body = {}, details = null) {
  body = {
    ...body,
    ...(details?.transactionId ? { transactionId: details.transactionId } : {}),
    ...(details?.borrowingId ? { borrowingId: details.borrowingId } : {}),
    ...(details?.reservationId ? { reservationId: details.reservationId } : {}),
  };
  const target = targetFromPath(path, body);
  if (path.includes("/admin/recommendations/books/") && target?.kind === "id") {
    const [[row]] = await db.query(
      `SELECT bk.id, bk.title, enrichment.source, enrichment.status, enrichment.enrichment_json
       FROM books bk LEFT JOIN book_enrichment enrichment ON enrichment.book_id = bk.id
       WHERE bk.id = ? LIMIT 1`,
      [target.value]
    );
    return row || null;
  }
  if (path.includes("catalog-schema")) {
    const [rows] = await db.query("SELECT `key`, label, type, options, required, locked, `order`, public, archived, scope FROM catalog_schema ORDER BY `order`, `key`");
    return rows;
  }
  if (path.includes("catalog-settings")) { const [[row]] = await db.query("SELECT show_unheld_in_opac FROM catalog_settings WHERE id = 1 LIMIT 1"); return row || null; }
  if (path.includes("library-settings")) { const [[row]] = await db.query("SELECT overdue_fine_per_hour FROM library_circulation_settings WHERE id = 1 LIMIT 1"); return row || null; }
  if (path.includes("site-content")) { const [[row]] = await db.query("SELECT * FROM site_content_settings LIMIT 1"); return row || null; }
  if (path.includes("/about")) { const [[row]] = await db.query("SELECT * FROM about_settings LIMIT 1"); return row || null; }
  if (path.endsWith("/books")) {
    const [schemaRows] = await db.query("SELECT `key`, label FROM catalog_schema");
    return { __auditSchema: schemaRows };
  }
  if (path.includes("/clearance/") && body.transactionId) {
    const [[row]] = await db.query("SELECT id, transaction_type, amount, receipt_number FROM clearance_transactions WHERE id = ? LIMIT 1", [body.transactionId]);
    return row || null;
  }
  if (!target) return null;
  if (path.includes("/copies/") && path.endsWith("/holding")) {
    const [[row]] = await db.query(
      `SELECT bc.id, bc.barcode, bk.title, h.accession_number, h.price, h.program_id, h.course_code,
              h.location, h.date_acquired, h.distributor, h.invoice_reference
       FROM book_copies bc JOIN books bk ON bk.id = bc.book_id
       LEFT JOIN copy_holdings h ON h.copy_id = bc.id WHERE bc.id = ? LIMIT 1`,
      [target.value]
    );
    return row || null;
  }
  if (path.includes("/circulation/") && body.borrowingId) {
    const [[row]] = await db.query("SELECT id, status, due_date, returned_at, deleted_at, user_id, book_id, copy_id FROM borrowings WHERE id = ? LIMIT 1", [body.borrowingId]);
    return row || null;
  }
  const queries = [
    ["/books/", "SELECT id, title, author, isbn, material_type, book_type_id, copies, metadata, deleted_at FROM books WHERE id = ? LIMIT 1"],
    ["/book-types/", "SELECT id, name, default_borrow_days, loan_duration_minutes, loan_duration_unit, fine_per_hour, fine_interval, initial_fine, is_active FROM book_types WHERE id = ? LIMIT 1"],
    ["/copies/", "SELECT bc.id, bc.barcode, bk.title, bc.condition, bc.notes, bc.is_active, bc.deleted_at FROM book_copies bc LEFT JOIN books bk ON bk.id = bc.book_id WHERE bc.id = ? LIMIT 1"],
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
    ["/clearance/transactions/", "SELECT id, transaction_type, amount, receipt_number FROM clearance_transactions WHERE id = ? LIMIT 1"],
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

function getDescription(method, path, body, before, after, details = null) {
  if (path.includes("/backup/snapshots") && method === "POST") return "Saved a manual snapshot";
  if (path.includes("/book-types/") && method === "DELETE") {
    const count = Number(details?.affectedCount ?? 0);
    const suffix = count ? ` · ${count} ${count === 1 ? "book needs" : "books need"} a loan policy` : " · no assigned books";
    return `Deleted loan policy${before?.name ? ` “${before.name}”` : ""}${suffix}`;
  }
  if (path.includes("/copies/") && path.endsWith("/holding")) {
    const copy = after || before || { id: path.match(/\/copies\/(\d+)/)?.[1] };
    return `Updated holdings${copy.title ? ` for “${copy.title}”` : ""} · ${copyLabel(copy)}`;
  }
  if (path.includes("/copies/")) {
    const copy = after || before || { id: path.match(/\/copies\/(\d+)/)?.[1] };
    return `Updated condition${copy.title ? ` for “${copy.title}”` : ""} · ${copyLabel(copy)}`;
  }
  if (path.includes("catalog-settings")) return "Updated catalog visibility settings";
  if (path.includes("/admin/recommendations/books/")) return `Updated AI recommendation details${describeTarget(body, path, after || before)}`;
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

function changedCount(body = {}, details = null) {
  for (const value of [details?.affectedCount, body.ids, body.order, body.items, body.records, body.payments]) {
    if (Array.isArray(value)) return value.length;
    if (Number.isSafeInteger(Number(value)) && Number(value) >= 0 && value !== "") return Number(value);
  }
  return null;
}

function affectedRecordType(path) {
  if (path.includes("/book-types/")) return "books now needing a loan policy";
  if (path.includes("/backup/") && path.includes("restore")) return "database records from snapshot";
  if (path.includes("/backup/snapshots")) return "backup snapshot";
  if (path.includes("/recommendations/embeddings/backfill")) return "book embeddings";
  if (path.includes("/subscriptions/reorder")) return "subscriptions";
  if (path.includes("/user-guide/reorder")) return "user guide modules";
  if (path.includes("/payments/settle")) return "payments";
  return "records";
}

function metadataFor(path, body, before, after, details = null, isCreation = false, policy = null, capture = {}) {
  let changes = capture.failed ? [] : (isCreation ? addedChanges(snapshotChanges(path, before, after, body)) : snapshotChanges(path, before, after, body));
  if (policy?.type === "state_transition" && !capture.comparable && !(details?.stateFrom !== undefined && details?.stateTo !== undefined)) changes = [];
  if (policy?.type === "field_changes" && (capture.failed || !capture.comparable && !isCreation)) changes = [];
  const metadata = { changes };
  const detailsObject = details && typeof details === "object" ? details : {};
  if (!capture.failed && detailsObject.stateFrom !== undefined && detailsObject.stateTo !== undefined && (!capture.comparable || !changes.length)) {
    changes = [...changes, { field: detailsObject.stateLabel || "State", before: valueFor(detailsObject.stateFrom), after: valueFor(detailsObject.stateTo) }];
    metadata.changes = changes;
  }
  if (detailsObject.financialChange) changes.push({ field: String(detailsObject.financialChange), value: "Changed" });
  if (changes !== metadata.changes) metadata.changes = changes;
  if (path.includes("/users") && body.password) metadata.security_change = "Password value withheld; password changed";
  if (after?.id != null) metadata.target_id = after.id;
  const transactionId = detailsObject.transactionId ?? body.transactionId;
  if (transactionId != null && Number.isSafeInteger(Number(transactionId))) metadata.transaction_id = Number(transactionId);
  const borrowingId = detailsObject.borrowingId ?? body.borrowingId;
  if (borrowingId != null && Number.isSafeInteger(Number(borrowingId))) metadata.borrowing_id = Number(borrowingId);
  const reservationId = detailsObject.reservationId ?? body.reservationId;
  if (reservationId != null && Number.isSafeInteger(Number(reservationId))) metadata.reservation_id = Number(reservationId);

  if (policy?.type === "affected_records") {
    const count = changedCount(body, detailsObject) ?? (path.includes("/backup/snapshots") && !path.includes("restore") ? 1 : null);
    if (count !== null) metadata.affected_record_count = count;
    metadata.detail_status = "affected_record_summary";
    metadata.affected_record_type = affectedRecordType(path);
  } else if (policy?.type === "state_transition") {
    metadata.detail_status = changes.length ? "changes_captured" : capture.failed || (!before && !after && !detailsObject.stateFrom) ? "details_unavailable" : "no_field_changes";
    if (path.includes("/attendance/scan") && !changes.length) {
      metadata.detail_status = "state_transition";
      metadata.changes = [{ field: "Attendance", before: "Not recorded", after: "Recorded" }];
    }
  } else if (policy?.type === "field_changes") {
    if (capture.failed || !capture.comparable && !isCreation || isCreation && changes.length === 0) metadata.detail_status = "details_unavailable";
    else metadata.detail_status = changes.length ? "changes_captured" : "no_field_changes";
  }
  if (detailsObject.copyBarcode) metadata.copy_barcode = valueFor(detailsObject.copyBarcode);
  return metadata;
}

function safeRoute(path) {
  return path.replace(/(\/users\/)[^/]+/g, "$1:user").replace(/(\/clearance\/receipts\/)[^/]+/g, "$1:receipt");
}

// Captures successful mutations without persisting request bodies, credentials,
// tokens, passwords, or other sensitive input. Supported records are read
// before the handler and again after a successful response.
async function auditLogger(req, res, next) {
  const path = req.originalUrl?.split("?")[0] || req.path;
  const policy = getAuditPolicy(req.method, path);
  if (!policy) return next();
  let before = null;
  let beforeRead = true;
  try { before = await readSnapshot(path, req.body); } catch (error) { beforeRead = false; console.error("[audit] Failed to read pre-change snapshot:", error.message); }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 200 || res.statusCode >= 300 || res.locals.auditEnqueued) return originalJson(body);
    return (async () => {
      let after = null;
      let afterRead = true;
      try { after = await readSnapshot(path, req.body, res.locals.auditDetails); } catch (error) { afterRead = false; console.error("[audit] Failed to read post-change snapshot:", error.message); }
      const isCreation = req.method === "POST" && getAction(req.method, path) === "created";
      const details = res.locals.auditDetails;
      const drifted = beforeRead && afterRead && snapshotChangedSinceRequest(path, req.method, req.body, before, after, policy);
      if (drifted) console.warn(`[audit] ${req.method} ${safeRoute(path)} changed concurrently; field details are unavailable for this event.`);
      const comparable = beforeRead && afterRead && !drifted && before !== null && after !== null;
      const metadata = metadataFor(path, req.body, before, after, details, isCreation, policy, { failed: !beforeRead || !afterRead || drifted, comparable });
      const baseDescription = getDescription(req.method, path, req.body, before, drifted ? before : after, details);
      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await enqueueAuditEvent(null, {
            actorId: req.user?.id ?? null,
            category: getCategory(path),
            action: getAction(req.method, path),
            description: baseDescription,
            route: safeRoute(path).slice(0, 255),
            metadata,
          });
          void require("../modules/delivery-outbox/outbox.service").drainOutbox();
          return originalJson(body);
        } catch (error) { lastError = error; }
      }
      console.error("[audit] Mutation committed, but its audit event could not be persisted:", lastError?.message);
      // This middleware runs after legacy handlers have already committed.
      // Returning an error here would invite a retry of an action that already
      // succeeded. Cross-system mutations enqueue audit rows inside their own
      // transaction; this warning keeps the generic fallback visible without
      // misrepresenting a committed mutation as a failed request.
      res.setHeader("X-Audit-Status", "unavailable");
      if (body && typeof body === "object" && !Array.isArray(body)) {
        return originalJson({
          ...body,
          auditWarning: "The change succeeded, but its audit event could not be saved. Contact a super admin before retrying.",
        });
      }
      return originalJson(body);
    })();
  };
  next();
}

module.exports = auditLogger;
module.exports.getAuditPolicy = getAuditPolicy;
module.exports.metadataFor = metadataFor;
module.exports.snapshotChanges = snapshotChanges;
module.exports.snapshotChangedSinceRequest = snapshotChangedSinceRequest;
module.exports.safeRoute = safeRoute;
module.exports.getDescription = getDescription;
module.exports.targetFromPath = targetFromPath;
module.exports.AUDIT_ROUTE_POLICIES = AUDIT_ROUTE_POLICIES;

const { recordAuditEvent } = require("../modules/analytics/audit.service");

const ignoredPaths = new Set([
  "/api/analytics/visit",
  "/api/auth/refresh",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/change-password",
]);

function getCategory(path) {
  if (path.includes("/books") || path.includes("catalog-schema") || path.includes("book-types")) return "catalog";
  if (path.includes("/academic-") || path.includes("/library-") || path.includes("/holidays")) return "academic_settings";
  if (path.includes("/users")) return "users";
  if (path.includes("/borrowing") || path.includes("/circulation")) return "borrowing";
  if (path.includes("/reservations")) return "reservation";
  if (path.includes("/bulletin")) return "bulletin";
  if (path.includes("/events")) return "events";
  if (path.includes("/site-content") || path.includes("/about")) return "content";
  if (path.includes("/notifications")) return "notifications";
  if (path.includes("/subscriptions")) return "subscriptions";
  if (path.includes("/backup")) return "backup";
  if (path.includes("/clearance")) return "clearance";
  if (path.includes("/attendance")) return "attendance";
  return "system";
}

function getAction(method, path) {
  if (path.includes("/current")) return "set_current";
  return { POST: "created", PUT: "updated", PATCH: "updated", DELETE: "deleted" }[method] ?? "changed";
}

function describeTarget(body = {}, path = "") {
  const value = body.title ?? body.name ?? body.label;
  if (typeof value === "string" && value.trim()) return `: “${value.trim().slice(0, 160)}”`;
  if (body.student_employee_id) return `: account ${String(body.student_employee_id).slice(0, 80)}`;
  if (body.userBarcode && body.bookBarcode) return `: copy ${String(body.bookBarcode).slice(0, 80)} for ${String(body.userBarcode).slice(0, 80)}`;
  if (body.bookId || body.book_id) return `: book #${body.bookId ?? body.book_id}`;
  const identifier = path.match(/\/(\d+)(?:\/|$)/)?.[1];
  if (identifier) return ` (#${identifier})`;
  return "";
}

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const valueFor = (value) => {
  if (value === null || value === "") return "Cleared";
  if (value === true || value === 1 || value === "1") return "Yes";
  if (value === false || value === 0 || value === "0") return "No";
  return String(value).slice(0, 180);
};

function getAuditMetadata(path, body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const fieldSets = path.includes("catalog-schema")
    ? [["key", "Field key"], ["label", "Label"], ["type", "Field type"], ["required", "Required"], ["public", "Public"], ["scope", "Applies to"]]
    : path.includes("book-types")
      ? [["name", "Policy name"], ["default_borrow_days", "Borrow days"], ["fine_per_hour", "Recurring fine (PHP)"], ["fine_interval", "Fine interval"], ["initial_fine", "Initial fine (PHP)"]]
      : path.includes("/books")
        ? [["title", "Title"], ["author", "Author"], ["isbn", "ISBN"], ["material_type", "Material"], ["book_type_id", "Book type"], ["copies", "Copies"]]
        : path.includes("academic-terms")
          ? [["name", "Term"], ["starts_on", "Starts"], ["ends_on", "Ends"], ["is_current", "Current term"]]
          : path.includes("academic-programs")
            ? [["name", "Program / course"]]
            : path.includes("library-holidays")
              ? [["name", "Holiday"], ["holiday_date", "Date"], ["description", "Note"]]
              : path.includes("library-settings")
                ? [["overdue_fine_per_hour", "Overdue fine per hour (PHP)"]]
                : path.includes("/users")
                  ? [["name", "Name"], ["student_employee_id", "Student / employee ID"], ["role", "Role"], ["is_active", "Active"], ["program_id", "Program / course"], ["academic_term_id", "Academic term"]]
                  : path.includes("/events")
                    ? [["title", "Event"], ["starts_at", "Starts"], ["ends_at", "Ends"]]
                    : path.includes("/notifications")
                      ? [["title", "Title"], ["type", "Type"], ["audience_type", "Audience"]]
                      : path.includes("/circulation") || path.includes("/borrowing")
                        ? [["userBarcode", "Borrower"], ["bookBarcode", "Copy barcode"], ["reservationId", "Reservation"]]
                        : [];
  const changes = fieldSets
    .filter(([key]) => has(body, key))
    .map(([key, label]) => ({ field: label, value: valueFor(body[key]) }));
  return changes.length ? { changes } : null;
}

function getDescription(method, path, body) {
  if (path.includes("/backup/snapshots") && method === "POST") return "Saved a manual snapshot";
  if (path.includes("/circulation") && method === "POST") return `Processed circulation${describeTarget(body, path)}`;
  const resource = path.includes("catalog-schema") ? "catalog field"
    : path.includes("book-types") ? "book type policy"
      : path.includes("/books") ? "catalog record"
        : path.includes("academic-terms") ? "academic term"
          : path.includes("academic-programs") ? "program / course"
            : path.includes("library-holidays") ? "holiday"
              : path.includes("library-settings") ? "circulation settings"
                : path.includes("/users") ? "user account"
                  : path.includes("site-content") ? "homepage content"
                    : path.includes("/about") ? "about content"
                      : path.includes("/events") ? "event"
                        : path.includes("/notifications") ? "notification"
                          : path.replace(/^\/api\/(admin\/)?/, "").replace(/\/[0-9]+(?=\/|$)/g, "").replace(/[-_/]/g, " ").replace(/\s+/g, " ").trim();
  const verb = { POST: "Created", PUT: "Updated", PATCH: "Updated", DELETE: "Deleted" }[method] ?? "Changed";
  if (path.includes("/current")) return `Set current ${resource}${describeTarget(body, path)}`;
  return `${verb} ${resource || "system data"}${describeTarget(body, path)}`;
}

// Captures every successful HTTP mutation without persisting request bodies,
// credentials, tokens, or other sensitive input. The response is never held up
// by a best-effort audit write.
function auditLogger(req, res, next) {
  const isSnapshotRestore = req.path.includes("/backup/") && req.path.includes("/restore");
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method) || ignoredPaths.has(req.path) || isSnapshotRestore) return next();

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const path = req.baseUrl ? `${req.baseUrl}${req.path === "/" ? "" : req.path}` : req.path;
    void recordAuditEvent({
      actorId: req.user?.id ?? null,
      category: getCategory(path),
      action: getAction(req.method, path),
      description: getDescription(req.method, path, req.body),
      route: path.slice(0, 255),
      metadata: getAuditMetadata(path, req.body),
    }).catch((error) => console.error("[audit] Failed to record event:", error.message));
  });
  next();
}

module.exports = auditLogger;

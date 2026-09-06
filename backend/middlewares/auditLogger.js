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
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method) || ignoredPaths.has(req.path) || req.path.includes("/backup/restore")) return next();

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const path = req.baseUrl ? `${req.baseUrl}${req.path === "/" ? "" : req.path}` : req.path;
    void recordAuditEvent({
      actorId: req.user?.id ?? null,
      category: getCategory(path),
      action: getAction(req.method, path),
      description: getDescription(req.method, path, req.body),
      route: path.slice(0, 255),
    }).catch((error) => console.error("[audit] Failed to record event:", error.message));
  });
  next();
}

module.exports = auditLogger;

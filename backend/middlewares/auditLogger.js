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

function getAction(method) {
  return { POST: "created", PUT: "updated", PATCH: "updated", DELETE: "deleted" }[method] ?? "changed";
}

function getDescription(method, path) {
  const resource = path
    .replace(/^\/api\/(admin\/)?/, "")
    .replace(/\/[0-9]+(?=\/|$)/g, "")
    .replace(/[-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const verb = { POST: "Created", PUT: "Updated", PATCH: "Updated", DELETE: "Deleted" }[method] ?? "Changed";
  return `${verb} ${resource || "system data"}`;
}

// Captures every successful HTTP mutation without persisting request bodies,
// credentials, tokens, or other sensitive input. The response is never held up
// by a best-effort audit write.
function auditLogger(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method) || ignoredPaths.has(req.path)) return next();

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const path = req.baseUrl ? `${req.baseUrl}${req.path === "/" ? "" : req.path}` : req.path;
    void recordAuditEvent({
      actorId: req.user?.id ?? null,
      category: getCategory(path),
      action: getAction(req.method),
      description: getDescription(req.method, path),
      route: path.slice(0, 255),
    }).catch((error) => console.error("[audit] Failed to record event:", error.message));
  });
  next();
}

module.exports = auditLogger;

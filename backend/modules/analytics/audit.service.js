const db = require("../../db");

async function recordAuditEvent({ actorId = null, actorName = null, actorRole = null, category, action, description, route = null, metadata = null }) {

  if (actorId) {
    const [[actor]] = await db.query("SELECT name, role FROM users WHERE id = ? LIMIT 1", [actorId]);
    actorName ||= actor?.name ?? null;
    actorRole ||= actor?.role ?? null;
  }

  await db.query(
    `INSERT INTO audit_events
       (actor_id, actor_name, actor_role, category, action, description, route, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      actorId ?? null,
      actorName,
      actorRole,
      category,
      action,
      description,
      route,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

module.exports = { recordAuditEvent };

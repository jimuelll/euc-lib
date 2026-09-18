const db = require("../../db");

async function listUpcomingEvents(limit = 8) {
  const [rows] = await db.query(
    "SELECT id,title,starts_at,ends_at FROM library_events WHERE COALESCE(ends_at, starts_at) >= NOW() ORDER BY starts_at ASC LIMIT ?",
    [Math.min(Math.max(Number(limit) || 8, 1), 50)]
  );
  return rows;
}

async function createEvent({ title, startsAt, endsAt, createdBy }) {
  const [result] = await db.query(
    "INSERT INTO library_events (title,starts_at,ends_at,created_by) VALUES (?,?,?,?)",
    [title, startsAt, endsAt, createdBy]
  );
  return result.insertId;
}

async function deleteEvent(id) {
  await db.query("DELETE FROM library_events WHERE id=?", [id]);
}

module.exports = { listUpcomingEvents, createEvent, deleteEvent };

const repository = require("./events.repository");

function toSqlDateTime(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function listUpcomingEvents() {
  return repository.listUpcomingEvents();
}

async function createEvent({ title, startsAt, endsAt, createdBy }) {
  const normalizedTitle = title?.trim();
  const normalizedStart = toSqlDateTime(startsAt);
  const normalizedEnd = endsAt === undefined || endsAt === null || endsAt === "" ? null : toSqlDateTime(endsAt);

  if (!normalizedTitle || !normalizedStart) throw Object.assign(new Error("A title and valid start time are required"), { status: 400 });
  if (endsAt && !normalizedEnd) throw Object.assign(new Error("End time must be a valid date and time"), { status: 400 });
  if (normalizedEnd && new Date(normalizedEnd).getTime() <= new Date(normalizedStart).getTime()) throw Object.assign(new Error("End time must be after the start time"), { status: 400 });

  return { id: await repository.createEvent({ title: normalizedTitle, startsAt: normalizedStart, endsAt: normalizedEnd, createdBy }) };
}

async function deleteEvent(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId < 1) throw Object.assign(new Error("Invalid event ID"), { status: 400 });
  await repository.deleteEvent(numericId);
}

module.exports = { listUpcomingEvents, createEvent, deleteEvent };

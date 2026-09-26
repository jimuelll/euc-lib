import type { Pool, ResultSetHeader } from "mysql2/promise";
import type { CreateEventInput, EventWrite, LibraryEvent } from "./events.types";

const db = require("../../db") as Pool;

async function listUpcomingEvents(limit = 8): Promise<LibraryEvent[]> {
  const [rows] = await db.query<LibraryEvent[]>(
    "SELECT id,title,starts_at,ends_at FROM library_events WHERE COALESCE(ends_at, starts_at) >= NOW() ORDER BY starts_at ASC LIMIT ?",
    [Math.min(Math.max(Number(limit) || 8, 1), 50)],
  );
  return rows;
}

async function createEvent({ title, startsAt, endsAt, createdBy }: EventWrite): Promise<number> {
  const [result] = await db.query<ResultSetHeader>(
    "INSERT INTO library_events (title,starts_at,ends_at,created_by) VALUES (?,?,?,?)",
    [title, startsAt, endsAt, createdBy],
  );
  return result.insertId;
}

async function deleteEvent(id: number): Promise<void> {
  await db.query("DELETE FROM library_events WHERE id=?", [id]);
}

export = { listUpcomingEvents, createEvent, deleteEvent };

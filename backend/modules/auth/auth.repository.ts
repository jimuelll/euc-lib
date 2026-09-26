import type { Pool, RowDataPacket } from "mysql2/promise";

const db = require("../../db") as Pool;

interface AcademicTermRecord extends RowDataPacket {
  name: string;
  ends_on: Date | string;
}

const getAcademicTerm = async (termId: number | null): Promise<AcademicTermRecord | null> => {
  const [[term]] = await db.query<AcademicTermRecord[]>(
    "SELECT name, ends_on FROM academic_terms WHERE id = ? LIMIT 1",
    [termId],
  );
  return term ?? null;
};

const recordAuthAuditEvent = async (userId: number, eventType: string, deviceType: string): Promise<void> => {
  await db.query(
    "INSERT INTO auth_audit_events (user_id, event_type, device_type) VALUES (?, ?, ?)",
    [userId, eventType, deviceType],
  );
};

const updatePassword = async (userId: number, passwordHash: string): Promise<void> => {
  await db.query(
    "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?",
    [passwordHash, userId],
  );
};

export = { getAcademicTerm, recordAuthAuditEvent, updatePassword };

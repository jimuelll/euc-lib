const db = require("../../db");

const getAcademicTerm = async (termId) => {
  const [[term]] = await db.query(
    "SELECT name, ends_on FROM academic_terms WHERE id = ? LIMIT 1",
    [termId],
  );
  return term ?? null;
};

const recordAuthAuditEvent = async (userId, eventType, deviceType) => {
  await db.query(
    "INSERT INTO auth_audit_events (user_id, event_type, device_type) VALUES (?, ?, ?)",
    [userId, eventType, deviceType],
  );
};

const updatePassword = async (userId, passwordHash) => {
  await db.query(
    "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?",
    [passwordHash, userId],
  );
};

module.exports = { getAcademicTerm, recordAuthAuditEvent, updatePassword };

const db = require("../../db");

const createRefreshSession = async (userId, jti, expiresAt) => {
  await db.query(
    `INSERT INTO auth_refresh_sessions (user_id, jti, expires_at)
     VALUES (?, ?, ?)`,
    [userId, jti, expiresAt],
  );
};

const getActiveRefreshSession = async (userId, jti) => {
  const [rows] = await db.query(
    `SELECT *
       FROM auth_refresh_sessions
      WHERE user_id = ?
        AND jti = ?
        AND revoked_at IS NULL
        AND expires_at > UTC_TIMESTAMP()
      LIMIT 1`,
    [userId, jti],
  );
  return rows[0] ?? null;
};

const revokeRefreshSession = async (userId, jti) => {
  await db.query(
    `UPDATE auth_refresh_sessions
        SET revoked_at = UTC_TIMESTAMP()
      WHERE user_id = ? AND jti = ? AND revoked_at IS NULL`,
    [userId, jti],
  );
};

const revokeAllRefreshSessionsForUser = async (userId) => {
  await db.query(
    `UPDATE auth_refresh_sessions
        SET revoked_at = UTC_TIMESTAMP()
      WHERE user_id = ? AND revoked_at IS NULL`,
    [userId],
  );
};

const purgeStaleRefreshSessions = async () => {
  const [result] = await db.query(
    `DELETE FROM auth_refresh_sessions
      WHERE expires_at <= UTC_TIMESTAMP()
         OR revoked_at IS NOT NULL`,
  );
  return result.affectedRows;
};

const invalidateAllSessionsAfterRestore = async (conn = db) => {
  await conn.query("UPDATE auth_restore_state SET invalid_before = UTC_TIMESTAMP() WHERE id = 1");
  await conn.query("UPDATE auth_refresh_sessions SET revoked_at = UTC_TIMESTAMP() WHERE revoked_at IS NULL");
};

const getInvalidBefore = async () => {
  const [[state]] = await db.query(
    "SELECT UNIX_TIMESTAMP(invalid_before) AS invalidBeforeSeconds FROM auth_restore_state WHERE id = 1",
  );
  return state?.invalidBeforeSeconds ?? null;
};

const isUserAccessActive = async (userId) => {
  const [[user]] = await db.query(
    "SELECT is_active FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [userId],
  );
  return Boolean(user?.is_active);
};

module.exports = {
  createRefreshSession,
  getActiveRefreshSession,
  revokeRefreshSession,
  revokeAllRefreshSessionsForUser,
  purgeStaleRefreshSessions,
  invalidateAllSessionsAfterRestore,
  getInvalidBefore,
  isUserAccessActive,
};

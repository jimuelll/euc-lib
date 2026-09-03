const { randomUUID } = require("crypto");
const db = require("../../db");
const { signRefreshToken } = require("./jwt.util");

function toMySqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function issueRefreshSession(userId, expiresAt, rememberMe = false) {
  const jti = randomUUID();
  await db.query(
    `INSERT INTO auth_refresh_sessions (user_id, jti, expires_at)
     VALUES (?, ?, ?)`,
    [userId, jti, toMySqlDateTime(expiresAt)]
  );

  return signRefreshToken({ id: userId, jti, remember_me: Boolean(rememberMe) });
}

async function getActiveRefreshSession(userId, jti) {
  const [rows] = await db.query(
    `SELECT *
     FROM auth_refresh_sessions
     WHERE user_id = ?
       AND jti = ?
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [userId, jti]
  );

  return rows[0] || null;
}

async function revokeRefreshSession(userId, jti) {
  await db.query(
    `UPDATE auth_refresh_sessions
     SET revoked_at = NOW()
     WHERE user_id = ? AND jti = ? AND revoked_at IS NULL`,
    [userId, jti]
  );
}

async function rotateRefreshSession(userId, oldJti, nextExpiresAt, rememberMe = false) {
  const session = await getActiveRefreshSession(userId, oldJti);
  if (!session) {
    throw Object.assign(new Error("Invalid refresh token"), { status: 401 });
  }

  await revokeRefreshSession(userId, oldJti);
  return issueRefreshSession(userId, nextExpiresAt, rememberMe);
}

async function revokeAllRefreshSessionsForUser(userId) {
  await db.query(
    `UPDATE auth_refresh_sessions
     SET revoked_at = NOW()
     WHERE user_id = ? AND revoked_at IS NULL`,
    [userId]
  );
}

async function invalidateAllSessionsAfterRestore(conn = db) {
  await conn.query("UPDATE auth_restore_state SET invalid_before = UTC_TIMESTAMP() WHERE id = 1");
  await conn.query("UPDATE auth_refresh_sessions SET revoked_at = UTC_TIMESTAMP() WHERE revoked_at IS NULL");
}

async function isAccessTokenCurrent(payload) {
  const [[state]] = await db.query("SELECT UNIX_TIMESTAMP(invalid_before) AS invalidBeforeSeconds FROM auth_restore_state WHERE id = 1");
  if (!state?.invalidBeforeSeconds) return true;
  const invalidBeforeSeconds = Number(state.invalidBeforeSeconds);
  return Number(payload?.iat || 0) > invalidBeforeSeconds;
}

module.exports = {
  issueRefreshSession,
  getActiveRefreshSession,
  revokeRefreshSession,
  rotateRefreshSession,
  revokeAllRefreshSessionsForUser,
  invalidateAllSessionsAfterRestore,
  isAccessTokenCurrent,
};

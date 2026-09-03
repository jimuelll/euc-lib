const { randomUUID } = require("crypto");
const db = require("../../db");
const { signRefreshToken } = require("./jwt.util");

let ensured = false;
let ensuredRestoreState = false;

async function ensureRestoreStateTable() {
  if (ensuredRestoreState) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS auth_restore_state (
      id TINYINT NOT NULL PRIMARY KEY,
      invalid_before DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00',
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query("INSERT IGNORE INTO auth_restore_state (id) VALUES (1)");
  ensuredRestoreState = true;
}

async function ensureRefreshSessionsTable() {
  if (ensured) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS auth_refresh_sessions (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      jti VARCHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_auth_refresh_sessions_user_id (user_id),
      INDEX idx_auth_refresh_sessions_expires_at (expires_at)
    )
  `);

  ensured = true;
}

function toMySqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function issueRefreshSession(userId, expiresAt, rememberMe = false) {
  await ensureRefreshSessionsTable();

  const jti = randomUUID();
  await db.query(
    `INSERT INTO auth_refresh_sessions (user_id, jti, expires_at)
     VALUES (?, ?, ?)`,
    [userId, jti, toMySqlDateTime(expiresAt)]
  );

  return signRefreshToken({ id: userId, jti, remember_me: Boolean(rememberMe) });
}

async function getActiveRefreshSession(userId, jti) {
  await ensureRefreshSessionsTable();

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
  await ensureRefreshSessionsTable();

  await db.query(
    `UPDATE auth_refresh_sessions
     SET revoked_at = NOW()
     WHERE user_id = ? AND jti = ? AND revoked_at IS NULL`,
    [userId, jti]
  );
}

async function rotateRefreshSession(userId, oldJti, nextExpiresAt, rememberMe = false) {
  await ensureRefreshSessionsTable();

  const session = await getActiveRefreshSession(userId, oldJti);
  if (!session) {
    throw Object.assign(new Error("Invalid refresh token"), { status: 401 });
  }

  await revokeRefreshSession(userId, oldJti);
  return issueRefreshSession(userId, nextExpiresAt, rememberMe);
}

async function revokeAllRefreshSessionsForUser(userId) {
  await ensureRefreshSessionsTable();

  await db.query(
    `UPDATE auth_refresh_sessions
     SET revoked_at = NOW()
     WHERE user_id = ? AND revoked_at IS NULL`,
    [userId]
  );
}

async function invalidateAllSessionsAfterRestore(conn = db) {
  await ensureRestoreStateTable();
  await conn.query("UPDATE auth_restore_state SET invalid_before = UTC_TIMESTAMP() WHERE id = 1");
  await conn.query("UPDATE auth_refresh_sessions SET revoked_at = UTC_TIMESTAMP() WHERE revoked_at IS NULL");
}

async function isAccessTokenCurrent(payload) {
  await ensureRestoreStateTable();
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

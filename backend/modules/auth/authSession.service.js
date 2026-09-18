const { randomUUID } = require("crypto");
const repository = require("./auth-session.repository");
const { signRefreshToken } = require("./jwt.util");

function toMySqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function issueRefreshSession(userId, expiresAt, rememberMe = false) {
  const jti = randomUUID();
  await repository.createRefreshSession(userId, jti, toMySqlDateTime(expiresAt));
  return signRefreshToken({ id: userId, jti, remember_me: Boolean(rememberMe) });
}

const getActiveRefreshSession = (userId, jti) => repository.getActiveRefreshSession(userId, jti);
const revokeRefreshSession = (userId, jti) => repository.revokeRefreshSession(userId, jti);

async function rotateRefreshSession(userId, oldJti, nextExpiresAt, rememberMe = false) {
  const session = await getActiveRefreshSession(userId, oldJti);
  if (!session) throw Object.assign(new Error("Invalid refresh token"), { status: 401 });
  await revokeRefreshSession(userId, oldJti);
  return issueRefreshSession(userId, nextExpiresAt, rememberMe);
}

const revokeAllRefreshSessionsForUser = (userId) => repository.revokeAllRefreshSessionsForUser(userId);
const purgeStaleRefreshSessions = () => repository.purgeStaleRefreshSessions();
const invalidateAllSessionsAfterRestore = (conn) => repository.invalidateAllSessionsAfterRestore(conn);

async function isAccessTokenCurrent(payload) {
  const invalidBeforeSeconds = await repository.getInvalidBefore();
  if (!invalidBeforeSeconds) return true;
  return Number(payload?.iat || 0) > Number(invalidBeforeSeconds);
}

const isUserAccessActive = (userId) => repository.isUserAccessActive(userId);

module.exports = {
  issueRefreshSession,
  getActiveRefreshSession,
  revokeRefreshSession,
  rotateRefreshSession,
  revokeAllRefreshSessionsForUser,
  purgeStaleRefreshSessions,
  invalidateAllSessionsAfterRestore,
  isAccessTokenCurrent,
  isUserAccessActive,
};

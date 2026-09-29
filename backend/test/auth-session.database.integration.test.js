const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const db = require("../db");
const repository = require("../modules/auth/auth-session.repository");
const sessions = require("../modules/auth/authSession.service");
const auth = require("../modules/auth/jwt.util");

const enabled = process.env.RUN_DB_INTEGRATION === "1" && /_test$/i.test(process.env.DB_NAME || "");

test("database: concurrent refresh rotation consumes the old session once and rejects expired or revoked sessions", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const userId = 2_000_000_000 + Math.floor(Math.random() * 100_000_000);
  const prefix = randomUUID();
  const oldJti = `${prefix}-old`;
  const expiredJti = `${prefix}-expired`;
  const revokedJti = `${prefix}-revoked`;
  const mysqlDate = (date) => date.toISOString().slice(0, 19).replace("T", " ");
  try {
    await repository.createRefreshSession(userId, oldJti, mysqlDate(new Date(Date.now() + 60_000)));
    await repository.createRefreshSession(userId, expiredJti, mysqlDate(new Date(Date.now() - 60_000)));
    await repository.createRefreshSession(userId, revokedJti, mysqlDate(new Date(Date.now() + 60_000)));
    await repository.revokeRefreshSession(userId, revokedJti);

    const attempts = await Promise.allSettled([
      sessions.rotateRefreshSession(userId, oldJti, new Date(Date.now() + 60_000)),
      sessions.rotateRefreshSession(userId, oldJti, new Date(Date.now() + 60_000)),
    ]);
    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = attempts.find((result) => result.status === "rejected");
    assert.equal(rejected.reason.status, 401);
    assert.equal(await repository.getActiveRefreshSession(userId, oldJti), null);
    const token = attempts.find((result) => result.status === "fulfilled").value;
    const payload = auth.verifyRefreshToken(token);
    assert.ok(await repository.getActiveRefreshSession(userId, payload.jti));

    await assert.rejects(sessions.rotateRefreshSession(userId, expiredJti, new Date(Date.now() + 60_000)), (error) => error.status === 401);
    await assert.rejects(sessions.rotateRefreshSession(userId, revokedJti, new Date(Date.now() + 60_000)), (error) => error.status === 401);
  } finally {
    await db.query("DELETE FROM auth_refresh_sessions WHERE user_id = ?", [userId]);
  }
});

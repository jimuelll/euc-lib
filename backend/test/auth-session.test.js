const test = require("node:test");
const assert = require("node:assert/strict");

const repository = require("../modules/auth/auth-session.repository");
const sessions = require("../modules/auth/authSession.service");
const auth = require("../modules/auth/jwt.util");

test("concurrent refresh attempts use one atomic rotation and only one can succeed", async () => {
  const originalRotate = repository.rotateRefreshSession;
  let claimed = false;
  const observed = [];
  repository.rotateRefreshSession = async (...args) => {
    observed.push(args);
    if (claimed) return false;
    claimed = true;
    return true;
  };
  try {
    const results = await Promise.allSettled([
      sessions.rotateRefreshSession(7, "old-session", new Date("2026-10-01T12:00:00Z"), true),
      sessions.rotateRefreshSession(7, "old-session", new Date("2026-10-01T12:00:00Z"), true),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.equal(rejected.reason.status, 401);
    assert.equal(observed.length, 2);
    assert.ok(observed.every(([userId, oldJti, nextJti, expiresAt]) =>
      userId === 7 && oldJti === "old-session" && nextJti !== "old-session" && expiresAt === "2026-10-01 12:00:00"));
    const successfulToken = results.find((result) => result.status === "fulfilled").value;
    const payload = auth.verifyRefreshToken(successfulToken);
    assert.equal(payload.remember_me, true);
  } finally {
    repository.rotateRefreshSession = originalRotate;
  }
});

test("access tokens at or before the restore marker are rejected", async () => {
  const original = repository.getInvalidBefore;
  repository.getInvalidBefore = async () => 1_800_000_000;
  try {
    assert.equal(await sessions.isAccessTokenCurrent({ iat: 1_800_000_000 }), false);
    assert.equal(await sessions.isAccessTokenCurrent({ iat: 1_800_000_001 }), true);
    assert.equal(await sessions.isAccessTokenCurrent({}), false);
  } finally {
    repository.getInvalidBefore = original;
  }
});

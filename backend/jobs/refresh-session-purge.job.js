const { purgeStaleRefreshSessions } = require("../modules/auth/authSession.service");

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const configuredInterval = Number(process.env.REFRESH_SESSION_PURGE_INTERVAL_MS);
const INTERVAL_MS = Number.isFinite(configuredInterval) && configuredInterval > 0 ? configuredInterval : DEFAULT_INTERVAL_MS;

async function runRefreshSessionPurge() {
  try {
    const purged = await purgeStaleRefreshSessions();
    if (purged > 0) console.log(`[auth-session-purge] Removed ${purged} stale refresh session${purged === 1 ? "" : "s"}`);
  } catch (error) {
    console.error("[auth-session-purge] Failed to purge stale refresh sessions:", error);
  }
}

function startRefreshSessionPurgeJob() {
  void runRefreshSessionPurge();
  const timer = setInterval(() => void runRefreshSessionPurge(), INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { runRefreshSessionPurge, startRefreshSessionPurgeJob };

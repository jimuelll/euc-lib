const app = require("./app");
require("dotenv").config();
const http = require("http");
const { attachWebSocketServer } = require("./realtime/websocket");
const { startOverdueSyncJob } = require("./jobs/overdue-sync.job");
const { startRefreshSessionPurgeJob } = require("./jobs/refresh-session-purge.job");

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
attachWebSocketServer(server);

const runOverdueSync = async () => {
  try {
    await syncOverdueBorrowings();
  } catch (error) {
    console.error("[overdue-sync] Failed to sync overdue borrowings:", error);
  }
};

const runRefreshSessionPurge = async () => {
  try {
    const purged = await purgeStaleRefreshSessions();
    if (purged > 0) console.log(`[auth-session-purge] Removed ${purged} stale refresh session${purged === 1 ? "" : "s"}`);
  } catch (error) {
    console.error("[auth-session-purge] Failed to purge stale refresh sessions:", error);
  }
};

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startOverdueSyncJob();
  startRefreshSessionPurgeJob();
});

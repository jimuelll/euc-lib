import app = require("./app");
require("dotenv").config();
import http = require("http");

const { attachWebSocketServer } = require("./realtime/websocket");
const { startOverdueSyncJob } = require("./jobs/overdue-sync.job");
const { startRefreshSessionPurgeJob } = require("./jobs/refresh-session-purge.job");
const { startDeliveryOutboxJob } = require("./modules/delivery-outbox/outbox.service");
const { startReservationExpiryJob } = require("./jobs/reservation-expiry.job");
const recovery = require("./modules/backup/restore-recovery.service");

require("./modules/email/email.config").validateConfig();
const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
attachWebSocketServer(server);

async function start() {
  // Verify maintenance before accepting requests or starting any workers.
  await recovery.recoverInterruptedRestore();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startOverdueSyncJob();
    startRefreshSessionPurgeJob();
    startDeliveryOutboxJob();
    require("./modules/email/email.service").startEmailJob();
    startReservationExpiryJob();
    require('./modules/backup/backup.schedule').start();
    recovery.startRestoreRecoveryJob();
  });
}

void start().catch(async (error) => {
  console.error(`[startup] Restore recovery verification failed (${recovery.recoveryFailureCode(error)}); server not started.`);
  await require("./db").end().catch(() => {});
  process.exitCode = 1;
});

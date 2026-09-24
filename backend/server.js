const app = require("./app");
require("dotenv").config();
const http = require("http");
const { attachWebSocketServer } = require("./realtime/websocket");
const { startOverdueSyncJob } = require("./jobs/overdue-sync.job");
const { startRefreshSessionPurgeJob } = require("./jobs/refresh-session-purge.job");
const { startDeliveryOutboxJob } = require("./modules/delivery-outbox/outbox.service");
const { startReservationExpiryJob } = require("./jobs/reservation-expiry.job");

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
attachWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startOverdueSyncJob();
  startRefreshSessionPurgeJob();
  startDeliveryOutboxJob();
  startReservationExpiryJob();
});

const app = require("./app");
require("dotenv").config();
const http = require("http");
const { attachWebSocketServer } = require("./realtime/websocket");
const { syncOverdueBorrowings } = require("./modules/borrowing/overdue.helper");

const PORT = process.env.PORT || 4000;
const OVERDUE_SYNC_INTERVAL_MS = 5 * 60 * 1000;

const server = http.createServer(app);
attachWebSocketServer(server);

const runOverdueSync = async () => {
  try {
    await syncOverdueBorrowings();
  } catch (error) {
    console.error("[overdue-sync] Failed to sync overdue borrowings:", error);
  }
};

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  void runOverdueSync();
  setInterval(() => {
    void runOverdueSync();
  }, OVERDUE_SYNC_INTERVAL_MS);
});

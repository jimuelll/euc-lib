const { syncOverdueBorrowings } = require("../modules/borrowing/overdue.helper");

const OVERDUE_SYNC_INTERVAL_MS = 5 * 60 * 1000;

async function runOverdueSync() {
  try {
    await syncOverdueBorrowings();
  } catch (error) {
    console.error("[overdue-sync] Failed to sync overdue borrowings:", error);
  }
}

function startOverdueSyncJob() {
  void runOverdueSync();
  return setInterval(() => void runOverdueSync(), OVERDUE_SYNC_INTERVAL_MS);
}

module.exports = { runOverdueSync, startOverdueSyncJob };

import overdueHelper = require("../modules/borrowing/overdue.helper");

const { syncOverdueBorrowings } = overdueHelper;
const OVERDUE_SYNC_INTERVAL_MS = 5 * 60 * 1000;

async function runOverdueSync(): Promise<void> {
  try {
    await syncOverdueBorrowings();
  } catch (error) {
    console.error("[overdue-sync] Failed to sync overdue borrowings:", error);
  }
}

function startOverdueSyncJob(): NodeJS.Timeout {
  void runOverdueSync();
  return setInterval(() => void runOverdueSync(), OVERDUE_SYNC_INTERVAL_MS);
}

export = { runOverdueSync, startOverdueSyncJob };

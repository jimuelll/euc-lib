const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const reservationRepository = require("../modules/reservation/reservation.repository");
const clearanceRepository = require("../modules/clearance/clearance.repository");
const myLibraryRepository = require("../modules/my-library/my-library.repository");
const reservationService = require("../modules/reservation/reservation.service");

test("active reservation views omit expired pending and ready rows consistently", async () => {
  const originalQuery = db.query;
  const statements = [];
  db.query = async (sql) => {
    statements.push(sql.replace(/\s+/g, " "));
    return [[], []];
  };
  try {
    await reservationRepository.findActiveReservations(1);
    await clearanceRepository.findUserReservations(1);
    await myLibraryRepository.findActiveReservations(1);
    for (const sql of statements) {
      assert.match(sql, /expires_at IS NULL OR [a-z]+\.expires_at > NOW\(\)/);
    }
  } finally {
    db.query = originalQuery;
  }
});

test("reservation history synchronizes expired rows before reading history", async () => {
  const originalSyncExpired = reservationRepository.syncExpired;
  const originalFindHistory = reservationRepository.findReservationHistory;
  const calls = [];
  reservationRepository.syncExpired = async () => { calls.push("expire"); return []; };
  reservationRepository.findReservationHistory = async () => { calls.push("history"); return []; };
  try {
    await reservationService.getReservationHistory(7);
    assert.deepEqual(calls, ["expire", "history"]);
  } finally {
    reservationRepository.syncExpired = originalSyncExpired;
    reservationRepository.findReservationHistory = originalFindHistory;
  }
});

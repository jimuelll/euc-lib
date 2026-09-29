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

test("reservation history bounds fractional pages, malformed pages, and oversized limits", async () => {
  const originalQuery = db.query;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql: sql.replace(/\s+/g, " "), params });
    if (sql.includes("SELECT COUNT(*) AS total")) return [[{ total: 4 }], []];
    return [[], []];
  };
  try {
    const fractional = await reservationRepository.findReservationHistory(9, { page: "2.8", limit: "250" });
    assert.equal(fractional.pagination.page, 2);
    assert.equal(fractional.pagination.limit, 100);
    assert.deepEqual(calls.at(-1).params, [9, 100, 100]);

    calls.length = 0;
    const malformed = await reservationRepository.searchCatalogue("atlas", { page: "2tail", limit: "-3" });
    assert.equal(malformed.pagination.page, 1);
    assert.equal(malformed.pagination.limit, 1);
    assert.deepEqual(calls.at(-1).params, ["%atlas%", "%atlas%", "%atlas%", 1, 0]);
  } finally {
    db.query = originalQuery;
  }
});

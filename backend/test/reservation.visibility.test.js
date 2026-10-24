const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const reservationRepository = require("../modules/reservation/reservation.repository");
const clearanceRepository = require("../modules/clearance/clearance.repository");
const myLibraryRepository = require("../modules/my-library/my-library.repository");
const reservationService = require("../modules/reservation/reservation.service");
const reservationController = require("../modules/reservation/reservation.controller");

test("catalogue capacity and placement count only live pending and ready reservations", async () => {
  const original = db.query;
  let catalogueSql;
  let placementSql;
  db.query = async sql => { catalogueSql = sql; return [[], []]; };
  try {
    await reservationRepository.searchCatalogue("");
    await reservationRepository.getOpenReservationCountForBook(4, {
      query: async sql => { placementSql = sql; return [[{ total: 1 }], []]; },
    });
    assert.match(catalogueSql, /AS canReserve/);
    assert.match(catalogueSql, /AS reservations_full/);
    assert.match(catalogueSql, /\) < COUNT\(DISTINCT/);
    assert.match(catalogueSql, /\) >= COUNT\(DISTINCT/);
    for (const sql of [catalogueSql, placementSql]) {
      assert.match(sql, /capacity.status IN \('pending','ready'\)/);
      assert.match(sql, /capacity.deleted_at IS NULL/);
      assert.match(sql, /capacity.expires_at IS NULL OR capacity.expires_at > NOW\(\)/);
    }
  } finally { db.query = original; }
});

test("pending and pickup keep their deadlines while unavailable copies and a second active reservation are rejected", async () => {
  const servicePath = require.resolve("../modules/reservation/reservation.service");
  const stubs = {
    "../modules/borrowing/overdue.helper": { syncOverdueBorrowings: async () => {} },
    "../modules/clearance/clearance.service": { assertEligible: async () => {} },
    "../modules/analytics/transactional-audit": { enqueueTransactionalAudit: async () => {} },
    "../modules/notifications/notifications.service": { enqueueNotification: async () => {} },
  };
  const cached = new Map([[servicePath, require.cache[servicePath]]]);
  const originals = { ...reservationRepository };
  const calls = [];
  const tx = { beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {} };
  try {
    for (const [name, exports] of Object.entries(stubs)) {
      const path = require.resolve(name);
      cached.set(path, require.cache[path]);
      require.cache[path] = { id: path, filename: path, loaded: true, exports };
    }
    delete require.cache[servicePath];
    const service = require(servicePath);
    Object.assign(reservationRepository, {
      getConnection: async () => tx,
      syncExpired: async () => {},
      findBookForReservation: async () => ({ id: 4, title: "Naruto", material_type: "book", has_active_policy: 1, registered_copy_count: 1 }),
      findActiveReservationByUser: async () => null,
      findActiveBorrowingByUserBook: async () => null,
      getReservationCapacityForBook: async () => ({ available: 1, pending: 0 }),
      getOpenReservationCountForBook: async () => 0,
      createReservation: async (user, book, hours) => { calls.push(["waiting", hours]); return { insertId: 8 }; },
      findReservationForAudit: async () => ({ id: 8, title: "Naruto", expires_at: "2026-10-25T08:00:00Z" }),
      findReservationBookId: async () => ({ book_id: 4 }),
      findReservationForReady: async () => ({ id: 8, book_id: 4, user_id: 2, title: "Naruto", status: "pending", within_deadline: 1 }),
      findAvailableCopyForReservation: async () => ({ id: 10 }),
      markReady: async (id, copy, hours) => { calls.push(["pickup", hours]); return 1; },
    });
    await service.reserveBook(2, 4);
    await service.markReservationReady(8);
    assert.deepEqual(calls, [["waiting", 24], ["pickup", 24]]);
    reservationRepository.getOpenReservationCountForBook = async () => 1;
    await assert.rejects(service.reserveBook(3, 4), { status: 409 });
    assert.equal(calls.length, 2);
    reservationRepository.getOpenReservationCountForBook = async () => 0;
    for (const capacity of [{ available: 0, pending: 0 }, { available: 1, pending: 1 }]) {
      reservationRepository.getReservationCapacityForBook = async () => capacity;
      await assert.rejects(service.reserveBook(3, 4), { status: 409, message: "No copy is currently available to reserve" });
    }
    reservationRepository.getReservationCapacityForBook = async () => ({ available: 1, pending: 0 });
    for (const status of ["pending", "ready"]) {
      reservationRepository.findActiveReservationByUser = async () => ({ id: 9, book_id: 12, status });
      await assert.rejects(service.reserveBook(3, 4), { status: 409, message: "You already have an active reservation. Only one book can be reserved at a time" });
    }
    assert.equal(calls.length, 2, "rejected reservations must not be created");
    reservationRepository.findReservationForReady = async () => ({ book_id: 4, status: "pending", within_deadline: 0 });
    await assert.rejects(service.markReservationReady(8), { status: 409 });
    assert.equal(calls.length, 2, "expired waiting reservations cannot become ready");
  } finally {
    Object.assign(reservationRepository, originals);
    for (const [path, value] of cached) {
      delete require.cache[path];
      if (value) require.cache[path] = value;
    }
  }
});

test("the patron reservation limit reads all active titles using a current locking read", async () => {
  let captured;
  const result = await reservationRepository.findActiveReservationByUser(7, {
    query: async (sql, params) => { captured = { sql, params }; return [[{ id: 8, book_id: 42 }], []]; },
  });
  assert.deepEqual(captured.params, [7]);
  assert.match(captured.sql, /status IN \('pending', 'ready'\)/);
  assert.match(captured.sql, /deleted_at IS NULL/);
  assert.match(captured.sql, /expires_at IS NULL OR expires_at > NOW\(\)/);
  assert.match(captured.sql, /FOR UPDATE/);
  assert.equal(result.book_id, 42);
});

test("pickup expiry resets from preparation time and rejects expired pending rows", async () => {
  const calls = [];
  await reservationRepository.markReady(8, 10, 24, {
    query: async (sql, params) => { calls.push({ sql, params }); return [{ affectedRows: 1 }]; },
  });
  assert.match(calls[0].sql, /expires_at = TIMESTAMPADD\(HOUR, \?, NOW\(\)\)/);
  assert.match(calls[0].sql, /expires_at IS NULL OR expires_at > NOW\(\)/);
  assert.deepEqual(calls[0].params, [10, 24, 8]);
});

test("reservation browse accepts an empty query and keeps paged availability ordering", async () => {
  const originalSearch = reservationService.searchCatalogue;
  const originalQuery = db.query;
  const calls = [];
  try {
    reservationService.searchCatalogue = async (query, options) => { calls.push({ query, options }); return { rows: [] }; };
    let payload;
    const response = { json: value => { payload = value; } };
    await reservationController.searchCatalogue({ query: { page: "1", limit: "20" } }, response);
    assert.equal(calls[0].query, "");
    assert.deepEqual(payload, { rows: [] });
    let status;
    await reservationController.searchCatalogue({ query: { query: ["bad"] } }, { status: value => { status = value; return response; } });
    assert.equal(status, 400);
    db.query = async (sql, params) => { calls.push({ sql, params }); return sql.includes("COUNT(*) AS total") ? [[{ total: 3 }], []] : [[], []]; };
    const result = await reservationRepository.searchCatalogue("", { page: 1, limit: 20 });
    assert.equal(result.pagination.total, 3);
    assert.match(calls.at(-1).sql, /ORDER BY available DESC, bk.title ASC LIMIT \? OFFSET \?/);
    assert.deepEqual(calls.at(-1).params, ["%%", "%%", "%%", 20, 0]);
  } finally { reservationService.searchCatalogue = originalSearch; db.query = originalQuery; }
});

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


test("selected reservation catalogue validates IDs and applies an exact parameterized filter", async () => {
  const originalSearch = reservationService.searchCatalogue;
  const originalQuery = db.query;
  const calls = [];
  try {
    reservationService.searchCatalogue = async (query, options) => { calls.push({ query, options }); return { rows: [] }; };
    const response = { status(value) { this.code = value; return this; }, json(value) { this.payload = value; return this; } };
    for (const bookId of ["0", "-1", "1.2", "bad", "9007199254740992", ["42"], {}]) {
      await reservationController.searchCatalogue({ query: { bookId } }, response);
      assert.equal(response.code, 400);
    }
    assert.equal(calls.length, 0);
    await reservationController.searchCatalogue({ query: { bookId: "42", page: "1", limit: "6" } }, response);
    assert.equal(calls[0].options.bookId, 42);
    db.query = async (sql, params) => { calls.push({ sql, params }); return sql.includes("COUNT(*) AS total") ? [[{ total: 1 }], []] : [[{ id: 42 }], []]; };
    const result = await reservationRepository.searchCatalogue("", { bookId: 42, page: 1, limit: 6, showUnheldInOpac: false });
    assert.equal(result.rows[0].id, 42);
    for (const call of calls.slice(1)) {
      assert.match(call.sql, /AND bk.id = \?/);
      assert.match(call.sql, /bk.deleted_at IS NULL/);
      assert.match(call.sql, /held_bc/);
      assert.equal(call.params[3], 42);
    }
    assert.deepEqual(calls.at(-1).params, ["%%", "%%", "%%", 42, 6, 0]);
    let activeSql;
    db.query = async sql => { activeSql = sql; return [[], []]; };
    await reservationRepository.findActiveReservations(1);
    assert.match(activeSql, /SELECT r.id, r.book_id/);
  } finally { reservationService.searchCatalogue = originalSearch; db.query = originalQuery; }
});

const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const repository = require("../modules/catalog/catalog.repository");
const middleware = require("../modules/catalog/catalog.middleware");
const { availableToBorrow, hasActiveBookPolicy, hasPreparedReservation } = require("../modules/catalog/copyEligibility");

test("deleting an assigned policy clears active and archived assignments atomically", async () => {
  const originalGetConnection = db.getConnection;
  const statements = [];
  const connection = {
    async beginTransaction() { statements.push("BEGIN"); },
    async commit() { statements.push("COMMIT"); },
    async rollback() { statements.push("ROLLBACK"); },
    release() { statements.push("RELEASE"); },
    async query(sql, params) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      statements.push(normalized);
      if (normalized.startsWith("SELECT id, name FROM book_types")) return [[{ id: 7, name: "General" }]];
      if (normalized.startsWith("SELECT id, deleted_at FROM books")) return [[
        { id: 1, deleted_at: null }, { id: 2, deleted_at: null }, { id: 3, deleted_at: "2026-01-01" },
      ]];
      if (normalized.startsWith("UPDATE books SET book_type_id = NULL")) return [{ affectedRows: 3 }];
      if (normalized.startsWith("DELETE FROM book_types")) return [{ affectedRows: 1 }];
      if (normalized.startsWith("INSERT INTO delivery_outbox")) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${normalized} (${params})`);
    },
  };
  db.getConnection = async () => connection;
  try {
    const result = await repository.deleteBookType(7);
    assert.deepEqual(result, { id: 7, name: "General", active_books: 2, archived_books: 1, affected_books: 3 });
    assert.match(statements[1], /^SELECT id, name FROM book_types WHERE id = \? FOR UPDATE$/);
    assert.match(statements[2], /^SELECT id, deleted_at FROM books WHERE book_type_id = \? FOR UPDATE$/);
    assert.ok(statements.indexOf("COMMIT") > statements.findIndex((sql) => typeof sql === "string" && sql.startsWith("DELETE FROM book_types")));
    assert.equal(statements.filter((sql) => typeof sql === "string" && sql.startsWith("UPDATE books SET book_type_id = NULL")).length, 1);
    assert.equal(statements.at(-1), "RELEASE");
  } finally { db.getConnection = originalGetConnection; }
});

test("deleting a missing policy rolls the transaction back", async () => {
  const originalGetConnection = db.getConnection;
  const statements = [];
  db.getConnection = async () => ({
    async beginTransaction() { statements.push("BEGIN"); },
    async commit() { statements.push("COMMIT"); },
    async rollback() { statements.push("ROLLBACK"); },
    release() { statements.push("RELEASE"); },
    async query() { return [[]]; },
  });
  try {
    await assert.rejects(repository.deleteBookType(99), { status: 404 });
    assert.deepEqual(statements, ["BEGIN", "ROLLBACK", "RELEASE"]);
  } finally { db.getConnection = originalGetConnection; }
});

test("an unused policy deletes without changing books", async () => {
  const originalGetConnection = db.getConnection;
  const statements = [];
  db.getConnection = async () => ({
    async beginTransaction() { statements.push("BEGIN"); },
    async commit() { statements.push("COMMIT"); },
    async rollback() { statements.push("ROLLBACK"); },
    release() { statements.push("RELEASE"); },
    async query(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      statements.push(normalized);
      if (normalized.startsWith("SELECT id, name FROM book_types")) return [[{ id: 8, name: "Reference" }]];
      if (normalized.startsWith("SELECT id, deleted_at FROM books")) return [[]];
      if (normalized.startsWith("UPDATE books SET book_type_id = NULL")) return [{ affectedRows: 0 }];
      if (normalized.startsWith("DELETE FROM book_types")) return [{ affectedRows: 1 }];
      if (normalized.startsWith("INSERT INTO delivery_outbox")) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${normalized}`);
    },
  });
  try {
    const result = await repository.deleteBookType(8);
    assert.deepEqual(result, { id: 8, name: "Reference", active_books: 0, archived_books: 0, affected_books: 0 });
    assert.equal(statements.filter((sql) => sql.startsWith("UPDATE books SET book_type_id = NULL")).length, 1);
    assert.equal(statements.at(-2), "COMMIT");
  } finally { db.getConnection = originalGetConnection; }
});

test("policy management loads inactive policies with active and archived assignment counts", async () => {
  const originalQuery = db.query;
  let capturedSql = "";
  db.query = async (sql) => {
    capturedSql = sql.replace(/\s+/g, " ").trim();
    return [[{ id: 3, name: "Legacy", is_active: 0, assigned_active_books: 1, assigned_archived_books: 2 }]];
  };
  try {
    const rows = await repository.getBookTypes();
    assert.equal(rows[0].is_active, 0);
    assert.equal(rows[0].assigned_active_books, 1);
    assert.equal(rows[0].assigned_archived_books, 2);
    assert.match(capturedSql, /COUNT\(CASE WHEN bk\.id IS NOT NULL AND bk\.deleted_at IS NULL/);
    assert.match(capturedSql, /COUNT\(CASE WHEN bk\.id IS NOT NULL AND bk\.deleted_at IS NOT NULL/);
    assert.doesNotMatch(capturedSql, /WHERE bt\.is_active = 1/);
  } finally { db.query = originalQuery; }
});

test("a permanently deleted policy name can be reused", async () => {
  const originalGetConnection = db.getConnection;
  const originalQuery = db.query;
  const policies = new Map([[7, { id: 7, name: "General" }]]);
  db.getConnection = async () => ({
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      if (normalized.startsWith("SELECT id, name FROM book_types")) return [[policies.get(7)]];
      if (normalized.startsWith("SELECT id, deleted_at FROM books")) return [[]];
      if (normalized.startsWith("UPDATE books SET book_type_id = NULL")) return [{ affectedRows: 0 }];
      if (normalized.startsWith("DELETE FROM book_types")) { policies.delete(7); return [{ affectedRows: 1 }]; }
      if (normalized.startsWith("INSERT INTO delivery_outbox")) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${normalized}`);
    },
  });
  db.query = async (sql, params) => {
    if (sql.startsWith("INSERT INTO book_types")) {
      assert.equal([...policies.values()].some((policy) => policy.name === params[0]), false);
      policies.set(8, { id: 8, name: params[0] });
      return [{ insertId: 8 }];
    }
    if (sql.startsWith("SELECT id, name, default_borrow_days")) return [[policies.get(params[0])]];
    throw new Error(`Unexpected query: ${sql}`);
  };
  try {
    await repository.deleteBookType(7);
    const replacement = await repository.createBookType({ name: "General", days: 7, minutes: 10080, durationUnit: "day", fine: 1, fineInterval: "hour", initial: 0 });
    assert.deepEqual(replacement, { id: 8, name: "General" });
    assert.equal([...policies.values()].filter((policy) => policy.name === "General").length, 1);
  } finally { db.getConnection = originalGetConnection; db.query = originalQuery; }
});

test("copy availability requires an active book policy", () => {
  assert.match(hasActiveBookPolicy("eligible_book"), /eligible_book\.book_type_id IS NOT NULL/);
  assert.match(hasActiveBookPolicy("eligible_book"), /active_policy\.is_active = 1/);
  assert.match(availableToBorrow("copy_row"), /eligible_book\.book_type_id IS NOT NULL/);
  assert.match(availableToBorrow("copy_row"), /active_policy\.is_active = 1/);
  assert.match(hasPreparedReservation("copy_row"), /expires_at > NOW\(\)/);
});

test("new and reassigned books only accept active policies under a row lock", async () => {
  const statements = [];
  const result = await repository.lockActiveBookType(7, {
    async query(sql, params) { statements.push({ sql: sql.replace(/\s+/g, " ").trim(), params }); return [[{ id: 7 }]]; },
  });
  assert.deepEqual(result, { id: 7 });
  assert.deepEqual(statements, [{ sql: "SELECT id FROM book_types WHERE id = ? AND is_active = 1 FOR UPDATE", params: [7] }]);
});

test("policy removal is super-admin only", () => {
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } };
  let continued = false;
  middleware.requireSuperAdminRole({ user: { role: "admin" } }, response, () => { continued = true; });
  assert.equal(response.statusCode, 403);
  assert.equal(continued, false);
  middleware.requireSuperAdminRole({ user: { role: "super_admin" } }, response, () => { continued = true; });
  assert.equal(continued, true);
});

test("needs-policy catalog filter is applied to both rows and pagination counts", async () => {
  const originalQuery = db.query;
  const queries = [];
  db.query = async (sql, params) => {
    queries.push({ sql: sql.replace(/\s+/g, " "), params });
    if (sql.includes("COUNT(*) AS total")) return [[{ total: 1 }]];
    return [[{ id: 4, title: "Unassigned", material_type: "book", needs_policy: 1 }]];
  };
  try {
    const result = await repository.searchBooksPage({ query: "", policyStatus: "needs_policy", page: 1 });
    assert.equal(result.total, 1);
    assert.equal(result.rows[0].needs_policy, 1);
    assert.equal(queries.length, 2);
    for (const query of queries) {
      assert.match(query.sql, /bk\.material_type = 'book' AND NOT \(bk\.book_type_id IS NOT NULL/);
      assert.match(query.sql, /active_policy\.is_active = 1/);
    }
  } finally { db.query = originalQuery; }
});

test("reservation creation and preparation stop when the book has no active policy", async () => {
  const reservationRepository = require("../modules/reservation/reservation.repository");
  const servicePath = require.resolve("../modules/reservation/reservation.service");
  const overduePath = require.resolve("../modules/borrowing/overdue.helper");
  const clearancePath = require.resolve("../modules/clearance/clearance.service");
  const serviceCache = require.cache[servicePath];
  const overdueCache = require.cache[overduePath];
  const clearanceCache = require.cache[clearancePath];
  const originals = {};
  for (const key of ["getConnection", "syncExpired", "findReservationBookId", "findBookForReservation", "findReservationForReady", "findAvailableCopyForReservation", "markReady"]) originals[key] = reservationRepository[key];
  const tx = { async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} };
  require.cache[overduePath] = { id: overduePath, filename: overduePath, loaded: true, exports: { syncOverdueBorrowings: async () => {} } };
  require.cache[clearancePath] = { id: clearancePath, filename: clearancePath, loaded: true, exports: { assertEligible: async () => {} } };
  delete require.cache[servicePath];
  const service = require("../modules/reservation/reservation.service");
  reservationRepository.getConnection = async () => tx;
  reservationRepository.syncExpired = async () => [];
  reservationRepository.findReservationBookId = async () => ({ book_id: 4 });
  reservationRepository.findBookForReservation = async () => ({ id: 4, title: "Atlas", material_type: "book", has_active_policy: 0, registered_copy_count: 1 });
  reservationRepository.findReservationForReady = async () => ({ id: 8, book_id: 4, status: "pending", within_deadline: 1 });
  reservationRepository.findAvailableCopyForReservation = async () => null;
  let readyWrites = 0;
  reservationRepository.markReady = async () => { readyWrites += 1; };
  try {
    await assert.rejects(service.reserveBook(2, 4), { status: 409, message: "This book needs an active loan policy before it can be reserved" });
    await assert.rejects(service.markReservationReady(8), { status: 409, message: "This book needs an active loan policy before a reservation can be prepared" });
    assert.equal(readyWrites, 0);
  } finally {
    for (const [key, value] of Object.entries(originals)) reservationRepository[key] = value;
    delete require.cache[servicePath];
    if (serviceCache) require.cache[servicePath] = serviceCache;
    if (overdueCache) require.cache[overduePath] = overdueCache; else delete require.cache[overduePath];
    if (clearanceCache) require.cache[clearancePath] = clearanceCache; else delete require.cache[clearancePath];
  }
});

test("renewal is blocked for an active loan whose book no longer has a policy", async () => {
  const circulationRepository = require("../modules/circulation/circulation.repository");
  const servicePath = require.resolve("../modules/circulation/circulation.service");
  const serviceCache = require.cache[servicePath];
  const original = {
    getConnection: circulationRepository.getConnection,
    getBorrowingForRenewal: circulationRepository.getBorrowingForRenewal,
  };
  circulationRepository.getConnection = async () => ({
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
  });
  circulationRepository.getBorrowingForRenewal = async () => ({ id: 12, status: "overdue", has_active_policy: 0 });
  delete require.cache[servicePath];
  const service = require("../modules/circulation/circulation.service");
  try {
    await assert.rejects(service.processRenew({ borrowingId: 12 }), { status: 409, message: "This book needs an active loan policy before it can be renewed" });
  } finally {
    circulationRepository.getConnection = original.getConnection;
    circulationRepository.getBorrowingForRenewal = original.getBorrowingForRenewal;
    delete require.cache[servicePath];
    if (serviceCache) require.cache[servicePath] = serviceCache;
  }
});

test("an active loan remains returnable after its book loses the current policy", async () => {
  const repositoryPath = require.resolve("../modules/borrowing/borrowing.repository");
  const servicePath = require.resolve("../modules/borrowing/borrowing.transaction.service");
  const overduePath = require.resolve("../modules/borrowing/overdue.helper");
  const fineLedgerPath = require.resolve("../modules/borrowing/fine-ledger.service");
  const serviceCache = require.cache[servicePath];
  const overdueCache = require.cache[overduePath];
  const fineLedgerCache = require.cache[fineLedgerPath];
  const borrowingRepository = require(repositoryPath);
  const fineLedger = require(fineLedgerPath);
  const original = {
    getConnection: borrowingRepository.getConnection,
    getBorrowingForReturn: borrowingRepository.getBorrowingForReturn,
    markReturned: borrowingRepository.markReturned,
    getBorrowingNotificationTarget: borrowingRepository.getBorrowingNotificationTarget,
    assessBorrowing: fineLedger.assessBorrowing,
  };
  const writes = [];
  const loan = { id: 12, status: "overdue", user_id: 7, book_id: 5, copy_id: 13, has_active_policy: 0, duration_minutes: 60, fine_per_hour: 1 };
  borrowingRepository.getConnection = async () => ({
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query(sql) {
      if (sql.includes("SELECT returned_at FROM borrowings")) return [[{ returned_at: "2026-09-23 12:00:00" }]];
      if (sql.includes("SELECT b.id, b.status, b.due_date, b.returned_at")) return [[{ id: 12, status: "returned", due_date: "2026-09-23 11:00:00", returned_at: "2026-09-23 12:00:00", title: "Atlas", copy_id: 13, barcode: "LIB-000005-001" }]];
      if (sql.includes("INSERT INTO delivery_outbox")) return [{ affectedRows: 1 }];
      return [{ affectedRows: 1 }];
    },
  });
  borrowingRepository.getBorrowingForReturn = async () => loan;
  borrowingRepository.markReturned = async (id) => writes.push(id);
  borrowingRepository.getBorrowingNotificationTarget = async () => null;
  fineLedger.assessBorrowing = async (record) => writes.push(record);
  const originalAuditEnqueue = require("../modules/analytics/analytics.audit.service").enqueueAuditEvent;
  require("../modules/analytics/analytics.audit.service").enqueueAuditEvent = async () => {};
  require.cache[overduePath] = { id: overduePath, filename: overduePath, loaded: true, exports: { syncOverdueBorrowings: async () => {} } };
  delete require.cache[servicePath];
  const service = require(servicePath);
  try {
    await service.returnBook(12, 7);
    assert.equal(writes[0], 12);
    assert.deepEqual(writes[1], { ...loan, returned_at: "2026-09-23 12:00:00" });
  } finally {
    borrowingRepository.getConnection = original.getConnection;
    borrowingRepository.getBorrowingForReturn = original.getBorrowingForReturn;
    borrowingRepository.markReturned = original.markReturned;
    borrowingRepository.getBorrowingNotificationTarget = original.getBorrowingNotificationTarget;
    fineLedger.assessBorrowing = original.assessBorrowing;
    require("../modules/analytics/analytics.audit.service").enqueueAuditEvent = originalAuditEnqueue;
    delete require.cache[servicePath];
    if (serviceCache) require.cache[servicePath] = serviceCache;
    if (overdueCache) require.cache[overduePath] = overdueCache; else delete require.cache[overduePath];
    if (fineLedgerCache) require.cache[fineLedgerPath] = fineLedgerCache; else delete require.cache[fineLedgerPath];
  }
});

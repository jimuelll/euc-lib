const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const repository = require("../modules/catalog/catalog.repository");
const audit = require("../modules/analytics/transactional-audit");
const transactionalAuditCalls = [];
const copyStateService = require("../modules/catalog/catalog.copy-state.service");
const availabilityService = require("../modules/catalog/catalog.availability.service");

const copyRepositoryMethods = [
  "getConnection", "lockBookForCopySync", "getExistingCopies", "getActiveCopyCount", "getLastCopySequence",
  "createCopy", "getCommittedCopyCounts", "getActiveCopies", "deactivateCopies", "updateBookCopyCount",
  "findCopyStateForUpdate", "getPendingReservationCount", "getAvailableEligibleCopyCount", "setCopyActive",
];

function saveMethods(object, names) {
  return Object.fromEntries(names.map((name) => [name, object[name]]));
}

function restoreMethods(object, saved) {
  for (const [name, method] of Object.entries(saved)) object[name] = method;
}

function fakeConnection(query) {
  const state = { commits: 0, rollbacks: 0, released: 0 };
  return {
    state,
    async beginTransaction() {},
    async commit() { state.commits += 1; },
    async rollback() { state.rollbacks += 1; },
    release() { state.released += 1; },
    async query(sql, params) { return query(sql, params); },
  };
}

test("copy count increases create new copy identities and never reactivate retired rows", async () => {
  const saved = saveMethods(repository, copyRepositoryMethods);
  let activeCount = 1;
  const created = [];
  const connection = fakeConnection(() => [[], []]);
  repository.getConnection = async () => connection;
  repository.lockBookForCopySync = async () => {};
  repository.getExistingCopies = async () => [{ id: 8, barcode: "LIB-000009-004" }];
  repository.getActiveCopyCount = async () => activeCount;
  repository.getLastCopySequence = async () => 4;
  repository.createCopy = async (bookId, barcode) => { created.push({ bookId, barcode }); activeCount += 1; };
  repository.updateBookCopyCount = async (_bookId, count) => { assert.equal(count, 2); };
  try {
    const result = await availabilityService.syncBookCopies(9, 2);
    assert.deepEqual(created, [{ bookId: 9, barcode: "LIB-000009-005" }]);
    assert.equal(result.previousActiveCount, 1);
    assert.equal(result.activeCount, 2);
    assert.equal(connection.state.commits, 1);
  } finally { restoreMethods(repository, saved); }
});

test("catalog edit lock reads persisted title and core fields for an accurate audit snapshot", async () => {
  let statement = "";
  const record = { id: 9, title: "Atlas", author: "Writer", isbn: "9780000000000", material_type: "book", book_type_id: 3, copies: 2, metadata: "{}", deleted_at: null };
  const row = await repository.findBookForUpdate(9, {
    async query(sql) { statement = sql.replace(/\s+/g, " ").trim(); return [[record]]; },
  });
  assert.equal(row.title, "Atlas");
  assert.match(statement, /SELECT id, title, author, isbn, material_type, book_type_id, copies, metadata, deleted_at FROM books/);
  assert.match(statement, /FOR UPDATE$/);
});

test("copy count reduction names borrowed, prepared, and pending commitments", async (t) => {
  const saved = saveMethods(repository, copyRepositoryMethods);
  for (const commitment of ["borrowed", "prepared", "pending"]) {
    await t.test(`${commitment} copies cannot be removed`, async () => {
      const connection = fakeConnection(() => [[], []]);
      repository.getConnection = async () => connection;
      repository.lockBookForCopySync = async () => {};
      repository.getExistingCopies = async () => [];
      repository.getActiveCopyCount = async () => 2;
      repository.getCommittedCopyCounts = async () => ({ borrowed: commitment === "borrowed" ? 1 : 0, prepared: commitment === "prepared" ? 1 : 0, pending: commitment === "pending" ? 1 : 0 });
      repository.getActiveCopies = async () => [];
      repository.deactivateCopies = async () => { throw new Error("must not retire a committed copy"); };
      await assert.rejects(availabilityService.syncBookCopies(9, 0), (error) => error.status === 409 && error.message.toLowerCase().includes(commitment === "pending" ? "pending reservation" : commitment));
      assert.equal(connection.state.rollbacks, 1);
    });
  }
  restoreMethods(repository, saved);
});

test("copy count reduction retires unaccessioned copies and preserves one eligible copy per pending reservation", async () => {
  const saved = saveMethods(repository, copyRepositoryMethods);
  let activeCount = 2;
  let deactivated = [];
  const connection = fakeConnection(() => [[], []]);
  repository.getConnection = async () => connection;
  repository.lockBookForCopySync = async () => {};
  repository.getExistingCopies = async () => [];
  repository.getActiveCopyCount = async () => activeCount;
  repository.getCommittedCopyCounts = async () => ({ borrowed: 0, prepared: 0, pending: 1 });
  repository.getActiveCopies = async () => [
    { id: 2, barcode: "LIB-000009-002", borrow_eligible: 0 },
    { id: 1, barcode: "LIB-000009-001", borrow_eligible: 1 },
  ];
  repository.deactivateCopies = async (ids) => { deactivated = ids; activeCount -= ids.length; return ids.length; };
  repository.updateBookCopyCount = async (_bookId, count) => assert.equal(count, 1);
  try {
    const result = await availabilityService.syncBookCopies(9, 1);
    assert.deepEqual(deactivated, [2]);
    assert.deepEqual(result.retiredCopies.map((copy) => copy.label), ["Copy 2"]);
    assert.equal(result.activeCount, 1);
    assert.equal(connection.state.commits, 1);
  } finally { restoreMethods(repository, saved); }
});

test("explicit copy retirement protects pending reservations and restoration is an explicit action", async () => {
  const saved = saveMethods(repository, copyRepositoryMethods);
  const originalDbGetConnection = db.getConnection;
  const connection = fakeConnection((sql) => {
    if (sql.includes("SELECT book_id FROM book_copies")) return [[{ book_id: 9 }], []];
    if (sql.includes("SELECT id, title, deleted_at FROM books")) return [[{ id: 9, title: "Atlas", deleted_at: null }], []];
    return [[], []];
  });
  db.getConnection = async () => connection;
  let copy = { id: 1, book_id: 9, barcode: "LIB-000009-001", condition: "good", is_active: 1, accession_number: "ACC-9", material_type: "book", has_active_policy: 1, has_active_loan: 0, has_prepared_reservation: 0 };
  let pending = 1;
  let availableAfter = 0;
  const activeUpdates = [];
  let currentActiveCount = 2;
  const originalTransactionalAudit = audit.enqueueTransactionalAudit;
  transactionalAuditCalls.length = 0;
  audit.enqueueTransactionalAudit = async (conn, event) => { transactionalAuditCalls.push(event); };
  repository.findCopyStateForUpdate = async () => ({ ...copy });
  repository.getPendingReservationCount = async () => pending;
  repository.getAvailableEligibleCopyCount = async () => availableAfter;
  repository.setCopyActive = async (_copyId, value) => { activeUpdates.push(value); copy.is_active = Number(value); currentActiveCount += value ? 1 : -1; return 1; };
  repository.getActiveCopyCount = async () => currentActiveCount;
  repository.updateBookCopyCount = async (_bookId, count) => { currentActiveCount = count; };
  try {
    await assert.rejects(copyStateService.retireCopy(1, 7), (error) => error.status === 409 && /pending reservation/.test(error.message));
    assert.deepEqual(activeUpdates, []);

    availableAfter = 1;
    const retired = await copyStateService.retireCopy(1, 7);
    assert.deepEqual(activeUpdates, [false]);
    assert.equal(retired.copies, 1);
    assert.equal(transactionalAuditCalls.at(-1).description, "Retired Copy 1 of “Atlas”");

    copy = { ...copy, is_active: 0 };
    pending = 0;
    const restored = await copyStateService.restoreCopy(1, 7);
    assert.deepEqual(activeUpdates, [false, true]);
    assert.equal(restored.lendingEligible, true);
    assert.equal(restored.copies, 2);
  } finally {
    audit.enqueueTransactionalAudit = originalTransactionalAudit;
    db.getConnection = originalDbGetConnection;
    restoreMethods(repository, saved);
  }
});

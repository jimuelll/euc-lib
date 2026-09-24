const test = require("node:test");
const assert = require("node:assert/strict");
const repository = require("../modules/borrowing/borrowing.repository");
const fineLedger = require("../modules/borrowing/fine-ledger.service");
const auditService = require("../modules/analytics/analytics.audit.service");

async function withFixture(state, work) {
  const initialArchived = state.archived;
  const methods = [
    "getConnection", "getAdminBorrowing", "lockBorrowingOwner", "getAdminBorrowingForUpdate",
    "getAdminBorrowingAuditSnapshot", "archiveBorrowing", "getArchivedBorrowing", "restoreBorrowing",
  ];
  const savedMethods = Object.fromEntries(methods.map((key) => [key, repository[key]]));
  const savedFineCheck = fineLedger.assertNoOutstandingFines;
  const savedEnqueue = auditService.enqueueAuditEvent;
  const servicePath = require.resolve("../modules/borrowing/borrowing.admin.service");
  const auditHelperPath = require.resolve("../modules/analytics/transactional-audit");
  const savedService = require.cache[servicePath];
  const savedAuditHelper = require.cache[auditHelperPath];

  const connection = {
    state: { commits: 0, rollbacks: 0, releases: 0 },
    async beginTransaction() {},
    async commit() { this.state.commits += 1; },
    async rollback() { this.state.rollbacks += 1; state.archived = initialArchived; },
    release() { this.state.releases += 1; },
  };
  state.connection = connection;
  repository.getConnection = async () => connection;
  repository.getAdminBorrowing = async () => state.archived ? null : { id: state.row.id, user_id: state.row.user_id, status: state.row.status };
  repository.lockBorrowingOwner = async (userId) => userId === state.row.user_id ? { id: userId } : null;
  repository.getAdminBorrowingForUpdate = async () => state.archived ? null : { ...state.row, deleted_at: null };
  repository.getArchivedBorrowing = async () => state.archived ? { ...state.row, deleted_at: "2026-09-24 10:00:00" } : null;
  repository.getAdminBorrowingAuditSnapshot = async () => ({ ...state.row, deleted_at: state.archived ? "2026-09-24 10:00:00" : null });
  repository.archiveBorrowing = async () => { if (state.changedCount === 0) return 0; state.archived = true; return 1; };
  repository.restoreBorrowing = async () => { if (state.changedCount === 0) return 0; state.archived = false; return 1; };
  fineLedger.assertNoOutstandingFines = async () => { if (state.outstandingFine) throw Object.assign(new Error("Outstanding balance"), { status: 409 }); };
  auditService.enqueueAuditEvent = async (_conn, event) => {
    if (state.auditError) throw state.auditError;
    state.auditEvents.push(event);
  };

  delete require.cache[servicePath];
  delete require.cache[auditHelperPath];
  const service = require(servicePath);
  try { await work(service); }
  finally {
    for (const [key, method] of Object.entries(savedMethods)) repository[key] = method;
    fineLedger.assertNoOutstandingFines = savedFineCheck;
    auditService.enqueueAuditEvent = savedEnqueue;
    if (savedService) require.cache[servicePath] = savedService; else delete require.cache[servicePath];
    if (savedAuditHelper) require.cache[auditHelperPath] = savedAuditHelper; else delete require.cache[auditHelperPath];
  }
}

function setup() {
  return {
    row: { id: 9, user_id: 4, book_id: 5, copy_id: 12, status: "returned", title: "Atlas", barcode: "LIB-000005-002", due_date: "2026-09-20 12:00:00", returned_at: "2026-09-22 12:00:00" },
    archived: false,
    outstandingFine: false,
    auditError: null,
    changedCount: undefined,
    auditEvents: [],
  };
}

test("borrowing archive checks ledger fines and commits its before/after audit with the state change", async () => {
  const state = setup();
  await withFixture(state, async (service) => {
    state.outstandingFine = true;
    await assert.rejects(service.adminDeleteBorrowing(9, 2), { status: 409 });
    assert.equal(state.archived, false);
    assert.equal(state.connection.state.rollbacks, 1);

    state.outstandingFine = false;
    await service.adminDeleteBorrowing(9, 2);
    assert.equal(state.archived, true);
    assert.equal(state.connection.state.commits, 1);
    assert.equal(state.auditEvents[0].description, "Archived borrowing for “Atlas” · Copy 2");
    assert.equal(state.auditEvents[0].metadata.detail_status, "changes_captured");
  });
});

test("borrowing archive rolls back if its durable audit event cannot be enqueued", async () => {
  const state = setup();
  state.auditError = new Error("outbox unavailable");
  await withFixture(state, async (service) => {
    await assert.rejects(service.adminDeleteBorrowing(9, 2), /outbox unavailable/);
    assert.equal(state.archived, false, "the failed transaction did not retain the archive");
    assert.equal(state.connection.state.rollbacks, 1);
    assert.equal(state.connection.state.commits, 0);
  });
});

test("borrowing restore is transactional, records its actor, and checks affected rows", async () => {
  const state = setup();
  state.archived = true;
  await withFixture(state, async (service) => {
    await service.adminRestoreBorrowing(9, 2);
    assert.equal(state.archived, false);
    assert.equal(state.connection.state.commits, 1);
    assert.equal(state.auditEvents[0].actorId, 2);
    assert.equal(state.auditEvents[0].description, "Restored borrowing for “Atlas” · Copy 2");

    const changed = setup();
    changed.archived = true;
    changed.changedCount = 0;
    await withFixture(changed, async (otherService) => {
      await assert.rejects(otherService.adminRestoreBorrowing(9, 2), { status: 409 });
      assert.equal(changed.connection.state.rollbacks, 1);
      assert.equal(changed.auditEvents.length, 0);
    });
  });
});

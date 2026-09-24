const test = require("node:test");
const assert = require("node:assert/strict");
const repository = require("../modules/admin/admin.repository");
const fineLedger = require("../modules/borrowing/fine-ledger.service");
const auditService = require("../modules/analytics/analytics.audit.service");
const authSession = require("../modules/auth/authSession.service");

async function withAdminServiceFixture(state, work) {
  const repositoryNames = [
    "getConnection", "findStudentLikeUsersForUpdate", "findAllBorrowingIdsForUser",
    "findActiveBorrowings", "findActiveReservations", "bulkDeactivateUserIds",
  ];
  const savedRepository = Object.fromEntries(repositoryNames.map((key) => [key, repository[key]]));
  const savedFineSummary = fineLedger.getOutstandingFineSummary;
  const savedAuditEnqueue = auditService.enqueueAuditEvent;
  const savedRevoke = authSession.revokeAllRefreshSessionsForUser;
  const servicePath = require.resolve("../modules/admin/admin.service");
  const auditHelperPath = require.resolve("../modules/analytics/transactional-audit");
  const savedServiceCache = require.cache[servicePath];
  const savedAuditHelperCache = require.cache[auditHelperPath];

  repository.getConnection = async () => state.connection;
  repository.findStudentLikeUsersForUpdate = async () => state.users;
  repository.findAllBorrowingIdsForUser = async (userId) => state.borrowings.get(userId) || [];
  repository.findActiveBorrowings = async (userId) => state.activeLoans.get(userId) || [];
  repository.findActiveReservations = async (userId) => state.activeReservations.get(userId) || [];
  repository.bulkDeactivateUserIds = async (ids) => { state.updatedIds = ids; return state.changedCount ?? ids.length; };
  fineLedger.getOutstandingFineSummary = async (ids) => state.fines.get(ids[0]) || { outstandingAmount: 0, affectedLoans: 0 };
  auditService.enqueueAuditEvent = async (_connection, event) => {
    if (state.auditError) throw state.auditError;
    state.auditEvents.push(event);
  };
  authSession.revokeAllRefreshSessionsForUser = async (userId) => state.revoked.push(userId);

  // The service captures enqueue functions when it is loaded. Give this test
  // its own instance so the fakes never leak into other test modules.
  delete require.cache[servicePath];
  delete require.cache[auditHelperPath];
  const adminService = require(servicePath);
  try {
    await work(adminService);
  } finally {
    Object.assign(repository, savedRepository);
    fineLedger.getOutstandingFineSummary = savedFineSummary;
    auditService.enqueueAuditEvent = savedAuditEnqueue;
    authSession.revokeAllRefreshSessionsForUser = savedRevoke;
    if (savedServiceCache) require.cache[servicePath] = savedServiceCache;
    else delete require.cache[servicePath];
    if (savedAuditHelperCache) require.cache[auditHelperPath] = savedAuditHelperCache;
    else delete require.cache[auditHelperPath];
  }
}

function setup(users) {
  return {
    users,
    borrowings: new Map(users.map((user) => [user.id, [user.id * 10]])),
    activeLoans: new Map(),
    activeReservations: new Map(),
    fines: new Map(),
    updatedIds: null,
    changedCount: undefined,
    auditEvents: [],
    auditError: null,
    revoked: [],
    connection: {
      state: { commits: 0, rollbacks: 0, released: 0 },
      async beginTransaction() {},
      async commit() { this.state.commits += 1; },
      async rollback() { this.state.rollbacks += 1; },
      release() { this.state.released += 1; },
      async query() { return [[], []]; },
    },
  };
}

test("bulk deactivation skips accounts with loans, reservations, and unpaid ledger balances", async () => {
  const users = [
    { id: 1, student_employee_id: "S-1", role: "student" },
    { id: 2, student_employee_id: "S-2", role: "employee" },
    { id: 3, student_employee_id: "S-3", role: "alumni" },
    { id: 4, student_employee_id: "S-4", role: "student" },
  ];
  const state = setup(users);
  state.activeLoans.set(1, [{ id: 11 }, { id: 12 }]);
  state.activeReservations.set(2, [{ id: 21 }]);
  state.fines.set(30, { outstandingAmount: 12.5, affectedLoans: 1 });
  await withAdminServiceFixture(state, async (adminService) => {
    const result = await adminService.bulkDeactivateStudentLikeUsers("admin", 99);
    assert.deepEqual(state.updatedIds, [4]);
    assert.equal(result.deactivated_count, 1);
    assert.equal(result.skipped_count, 3);
    assert.deepEqual(result.skipped_reason_counts, { active_loans: 1, active_reservations: 1, unpaid_fines: 1 });
    assert.deepEqual(result.skipped_users.map((user) => user.reasons), [["active_loans"], ["active_reservations"], ["unpaid_fines"]]);
    assert.equal(result.skipped_users[0].active_loan_count, 2);
    assert.equal(result.skipped_users[1].active_reservation_count, 1);
    assert.equal(result.skipped_users[2].unpaid_fine_amount, 12.5);
    assert.equal(state.auditEvents[0].metadata.affected_record_count, 1);
    assert.equal(state.auditEvents[0].metadata.skipped_count, 3);
    assert.equal(state.connection.state.commits, 1);
    assert.deepEqual(state.revoked, [4]);
  });
});

test("bulk deactivation rolls the whole transaction back if its update count changes", async () => {
  const state = setup([
    { id: 5, student_employee_id: "S-5", role: "student" },
    { id: 6, student_employee_id: "S-6", role: "employee" },
  ]);
  state.changedCount = 1;
  await withAdminServiceFixture(state, async (adminService) => {
    await assert.rejects(adminService.bulkDeactivateStudentLikeUsers("admin", 99), (error) => error.status === 409);
    assert.deepEqual(state.updatedIds, [5, 6]);
    assert.equal(state.connection.state.rollbacks, 1);
    assert.equal(state.connection.state.commits, 0);
    assert.equal(state.auditEvents.length, 0);
  });
});

test("bulk deactivation rolls back if the transactional audit event cannot be enqueued", async () => {
  const state = setup([{ id: 7, student_employee_id: "S-7", role: "student" }]);
  state.auditError = new Error("outbox unavailable");
  await withAdminServiceFixture(state, async (adminService) => {
    await assert.rejects(adminService.bulkDeactivateStudentLikeUsers("admin", 99), /outbox unavailable/);
    assert.deepEqual(state.updatedIds, [7]);
    assert.equal(state.connection.state.rollbacks, 1);
    assert.equal(state.connection.state.commits, 0);
    assert.deepEqual(state.revoked, []);
  });
});

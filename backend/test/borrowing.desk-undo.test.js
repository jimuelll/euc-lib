const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const db = require("../db");
const repository = require("../modules/borrowing/borrowing.repository");
const notifications = require("../modules/notifications/notifications.service");
const audit = require("../modules/analytics/analytics.audit.service");
const tokens = require("../modules/borrowing/borrowing.undo-token");

test("desk undo tokens reject another actor, forged and expired intents", () => {
  const original = process.env.JWT_SECRET; process.env.JWT_SECRET = "test-desk-secret";
  try {
    const { undoToken } = tokens.issueDeskUndo(2, 9, "borrow");
    assert.equal(tokens.verifyDeskUndo(undoToken, 2).borrowingId, 9);
    assert.throws(() => tokens.verifyDeskUndo(undoToken, 3), { status: 409 });
    assert.throws(() => tokens.verifyDeskUndo(undoToken + "changed", 2), { status: 409 });
    const expired = jwt.sign({ actorId: 2, borrowingId: 9, kind: "borrow" }, "test-desk-secret", { audience: "circulation-desk-undo", issuer: "circulation-desk-undo", expiresIn: -1 });
    assert.throws(() => tokens.verifyDeskUndo(expired, 2), { status: 409 });
  } finally { if (original === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = original; }
});

async function fixture(kind, options, work) {
  const originalSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = "test-desk-secret";
  const methods = ["getAdminBorrowing", "getConnection", "lockBorrowingOwner", "lockDeskUndoCopy", "getAdminBorrowingForUpdate", "isDeskUndoFineFree", "findActiveBorrowingByCopy", "findActiveBorrowingByUserBook", "findReadyHoldByCopy", "countPendingReservationsForBook", "reverseDeskTransaction", "getAdminBorrowingAuditSnapshot"];
  const saved = Object.fromEntries(methods.map(key => [key, repository[key]]));
  const savedNotification = notifications.enqueueNotification; const savedAudit = audit.enqueueAuditEvent;
  const servicePath = require.resolve("../modules/borrowing/borrowing.undo.service");
  const helperPath = require.resolve("../modules/analytics/transactional-audit");
  const cachedService = require.cache[servicePath]; const cachedHelper = require.cache[helperPath];
  const row = { id: 9, user_id: 4, book_id: 5, copy_id: 12, issued_by: 2, status: kind === "borrow" ? "borrowed" : "returned", borrowed_at: new Date(), due_date: new Date(Date.now() + 86400000), returned_at: kind === "return" ? new Date() : null, title: "Atlas", deleted_at: null };
  const state = { changed: false, commits: 0, rollbacks: 0, audit: [] };
  const conn = { beginTransaction: async () => {}, commit: async () => { state.commits++; }, rollback: async () => { state.rollbacks++; state.changed = false; }, release() {} };
  repository.getAdminBorrowing = async () => row;
  repository.getConnection = async () => conn;
  repository.lockBorrowingOwner = async () => ({ id: 4 });
  repository.lockDeskUndoCopy = async () => {};
  repository.getAdminBorrowingForUpdate = async () => options.changed ? { ...row, status: "overdue" } : row;
  repository.isDeskUndoFineFree = async () => !options.fines;
  repository.findActiveBorrowingByCopy = async () => options.reborrowed ? { id: 10 } : null;
  repository.findActiveBorrowingByUserBook = async () => null;
  repository.findReadyHoldByCopy = async () => options.hold ? { id: 11 } : null;
  repository.countPendingReservationsForBook = async () => options.pending ? 1 : 0;
  repository.reverseDeskTransaction = async () => { state.changed = true; return 1; };
  repository.getAdminBorrowingAuditSnapshot = async () => ({ ...row, status: kind === "borrow" ? "returned" : "borrowed" });
  audit.enqueueAuditEvent = async (_conn, event) => { state.audit.push(event); if (options.auditFailure) throw new Error("Audit unavailable"); };
  notifications.enqueueNotification = async () => {};
  delete require.cache[servicePath]; delete require.cache[helperPath];
  try {
    const token = tokens.issueDeskUndo(2, 9, kind, row.returned_at).undoToken;
    if (options.replayed) row.notes = `Desk undo ${tokens.verifyDeskUndo(token, 2).jti}`;
    await work(require(servicePath), token, state);
  }
  finally { Object.assign(repository, saved); notifications.enqueueNotification = savedNotification; audit.enqueueAuditEvent = savedAudit; if (cachedService) require.cache[servicePath] = cachedService; else delete require.cache[servicePath]; if (cachedHelper) require.cache[helperPath] = cachedHelper; else delete require.cache[helperPath]; if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret; }
}
test("desk undo commits a correction and its audit together", async () => {
  for (const kind of ["borrow", "return"]) await fixture(kind, {}, async (service, token, state) => { await service.undoDeskTransaction(token, 2); assert.equal(state.changed, true); assert.equal(state.commits, 1); assert.equal(state.audit.length, 1); });
});
test("desk undo rejects changed records and every fine-related record", async () => {
  for (const options of [{ changed: true }, { fines: true }, { replayed: true }]) await fixture("borrow", options, async (service, token, state) => { await assert.rejects(service.undoDeskTransaction(token, 2), { status: 409 }); assert.equal(state.changed, false); assert.equal(state.rollbacks, 1); });
});
test("return undo rejects re-borrowed copies, ready holds and pending queues", async () => {
  for (const options of [{ reborrowed: true }, { hold: true }, { pending: true }]) await fixture("return", options, async (service, token, state) => { await assert.rejects(service.undoDeskTransaction(token, 2), { status: 409 }); assert.equal(state.changed, false); });
});
test("failed durable audit rolls back the reversal", async () => {
  await fixture("return", { auditFailure: true }, async (service, token, state) => { await assert.rejects(service.undoDeskTransaction(token, 2), /Audit unavailable/); assert.equal(state.changed, false); assert.equal(state.commits, 0); });
});
test("history counts ignore status and repository sorts urgent work before pagination", async () => {
  const original = db.query; const calls = [];
  db.query = async (sql, params) => { calls.push({ sql: sql.replace(/\s+/g, " "), params }); if (sql.includes("AS total_records")) return [[{ total_records: 10 }]]; if (sql.includes("COUNT(*) AS total")) return [[{ total: 6 }]]; return [[]]; };
  try { await repository.getAdminBorrowings({ status: "needs_action", search: "Alex", dateFrom: "2026-10-01" }); assert.match(calls[0].sql, /b.status IN \('borrowed','overdue'\)/); assert.match(calls[1].sql, /ORDER BY CASE WHEN b.status = 'overdue' THEN 0/); assert.doesNotMatch(calls[2].sql, /AND b.status IN/); assert.match(calls[2].sql, /AS accrued_fines/); assert.deepEqual(calls[2].params, ["%Alex%", "%Alex%", "%Alex%", "%Alex%", "2026-10-01"]); } finally { db.query = original; }
});
if (require.main === module) test.after(() => db.end());

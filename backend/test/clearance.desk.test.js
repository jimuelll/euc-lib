const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const repository = require("../modules/clearance/clearance.repository");
const overdue = require("../modules/borrowing/overdue.helper");
const notifications = require("../modules/notifications/notifications.service");
async function fixture(work) {
 const saved = { sync: overdue.syncOverdueBorrowings, list: overdue.listUnsettledBorrowings, get: repository.getConnection, user: repository.findUserForPayment, overdue: repository.findOverdueBorrowings, queue: repository.findQueueOverdueBorrowings, create: repository.createTransaction, notify: notifications.enqueueNotification };
 const servicePath = require.resolve("../modules/clearance/clearance.service");
 const auditPath = require.resolve("../modules/analytics/transactional-audit");
 const cachedService = require.cache[servicePath], cachedAudit = require.cache[auditPath];
 const state = { saved: [], audit: [], notifications: [], commits: 0, rollbacks: 0 };
 const fines = [{ id: 10, user_id: 1, user_name: "Patron One", student_employee_id: "TEST-1", unsettled_amount: 250, due_date: "2026-09-01" }, { id: 11, user_id: 1, user_name: "Patron One", student_employee_id: "TEST-1", unsettled_amount: 150, due_date: "2026-09-10" }, { id: 12, user_id: 2, user_name: "Patron Two", student_employee_id: "TEST-2", unsettled_amount: 1250, due_date: "2026-09-20" }];
 overdue.syncOverdueBorrowings = async () => {};
 overdue.listUnsettledBorrowings = async (options) => { const rows = options?.userId ? fines.filter(row => row.user_id === options.userId) : fines; return { rows, summary: { total_unsettled_amount: rows.reduce((sum, row) => sum + row.unsettled_amount, 0) } }; };
 repository.findOverdueBorrowings = async () => [];
 repository.findQueueOverdueBorrowings = async () => [{ user_id: 1, name: "Patron One", student_employee_id: "TEST-1", overdue_count: 2, oldest_due_date: "2026-09-01", overdue_titles: "Book One | Book Two" }];
 repository.findUserForPayment = async () => ({ id: 1, name: "Patron One", student_employee_id: "TEST-1" });
 const conn = { beginTransaction: async () => {}, commit: async () => { state.commits++; }, rollback: async () => { state.rollbacks++; }, release() {}, query: async () => [[{ id: 50, transaction_type: "payment", amount: state.saved[0]?.amount || 0, receipt_number: "CLR-TEST-50" }]] };
 repository.getConnection = async () => conn;
 repository.createTransaction = async (input) => { state.saved.push(input); return { id: 50, receiptNumber: "CLR-TEST-50" }; };
 notifications.enqueueNotification = async (_conn, input) => { state.notifications.push(input); };
 require.cache[auditPath] = { id: auditPath, filename: auditPath, loaded: true, exports: { enqueueTransactionalAudit: async (_conn, entry) => state.audit.push(entry) } };
 delete require.cache[servicePath];
 try { await work(require(servicePath), state); } finally { overdue.syncOverdueBorrowings = saved.sync; overdue.listUnsettledBorrowings = saved.list; repository.getConnection = saved.get; repository.findUserForPayment = saved.user; repository.findOverdueBorrowings = saved.overdue; repository.findQueueOverdueBorrowings = saved.queue; repository.createTransaction = saved.create; notifications.enqueueNotification = saved.notify; delete require.cache[servicePath]; if (cachedService) require.cache[servicePath] = cachedService; if (cachedAudit) require.cache[auditPath] = cachedAudit; else delete require.cache[auditPath]; }
}
test("clearance queue groups blocked first and retains counts across filters", async () => fixture(async (service) => { const result = await service.getClearanceQueue({ page: 1, limit: 25 }); assert.deepEqual(result.rows.map(row => row.userId), [1, 2]); assert.deepEqual(result.summary, { total: 2, blocked: 1, finesOnly: 1, unpaidFines: 1650 }); assert.equal(result.rows[0].oldestFineDate, "2026-09-01"); const filtered = await service.getClearanceQueue({ page: 1, filter: "fines_only" }); assert.deepEqual(filtered.rows.map(row => row.userId), [2]); assert.equal(filtered.summary.blocked, 1); const searched = await service.getClearanceQueue({ page: 1, search: "TEST-2" }); assert.equal(searched.summary.total, 1); }));
test("confirmed partial payments allocate only the amount received and generate a receipt", async () => fixture(async (service, state) => { const result = await service.recordFullPayment({ studentEmployeeId: "TEST-1", createdBy: 3, amount: 300, expectedOutstanding: 400 }); assert.equal(result.amount, 300); assert.equal(result.receiptNumber, "CLR-TEST-50"); assert.deepEqual(state.saved[0].allocations, [{ borrowingId: 10, amount: 250 }, { borrowingId: 11, amount: 50 }]); assert.equal(state.audit.length, 1); assert.equal(state.notifications.length, 1); assert.equal(state.commits, 1); }));
test("a changed balance rejects the payment before ledger writes", async () => fixture(async (service, state) => { await assert.rejects(service.recordFullPayment({ studentEmployeeId: "TEST-1", createdBy: 3, amount: 300, expectedOutstanding: 350 }), { status: 409 }); assert.equal(state.saved.length, 0); assert.equal(state.commits, 0); assert.equal(state.rollbacks, 1); }));
test("overpayments and invalid amounts never create ledger entries", async () => fixture(async (service, state) => { for (const amount of [0, -1, 500, "invalid", Infinity]) await assert.rejects(service.recordFullPayment({ studentEmployeeId: "TEST-1", createdBy: 3, amount, expectedOutstanding: 400 }), { status: 409 }); assert.equal(state.saved.length, 0); }));
test("full payment remains compatible and records all allocations atomically", async () => fixture(async (service, state) => { const result = await service.recordFullPayment({ studentEmployeeId: "TEST-1", createdBy: 3, amount: 400, expectedOutstanding: 400 }); assert.equal(result.message, "Full payment recorded"); assert.equal(state.saved[0].allocations.reduce((sum, row) => sum + row.amount, 0), 400); assert.equal(state.commits, 1); assert.match(state.notifications[0].body, /400.00/); }));
if (require.main === module) test.after(() => db.end());

const test = require("node:test");
const assert = require("node:assert/strict");
const repository = require("../modules/borrowing/borrowing.repository");
const duration = require("../modules/borrowing/loan-duration");
const service = require("../modules/borrowing/borrowing.read.service");
if (require.main === module) test.after(async () => require("../db").end());

test("circulation history searches ISBN and keeps date filters in all count queries", async () => {
  const db = require("../db");
  const originalQuery = db.query;
  const queries = [];
  db.query = async (sql, params) => {
    queries.push({ sql, params });
    return sql.includes("AS total_records") ? [[{ total_records: 0 }]] : sql.includes("AS total") ? [[{ total: 0 }]] : [[]];
  };
  try {
    await repository.getAdminBorrowings({ search: "9780123456789", dateFrom: "2026-09-14", dateTo: "2026-09-20" });
    assert.equal(queries.length, 3);
    for (const query of queries) {
      assert.match(query.sql, /bk\.isbn LIKE \?/);
      assert.deepEqual(query.params.slice(0, 6), ["%9780123456789%", "%9780123456789%", "%9780123456789%", "%9780123456789%", "2026-09-14", "2026-09-20"]);
    }
  } finally { db.query = originalQuery; }
});

test("copy lookup previews the configured loan policy instead of assuming seven days", async () => {
  const originalFind = repository.findCopyByBarcode;
  const originalDue = duration.calculateLoanDueDate;
  const expectedDue = new Date("2026-10-08T15:30:00Z");
  repository.findCopyByBarcode = async () => ({ id: 9, title: "Short loan", loan_duration_minutes: 180, loan_duration_unit: "hour" });
  duration.calculateLoanDueDate = async (now, policy) => {
    assert.ok(now instanceof Date);
    assert.deepEqual(policy, { minutes: 180, unit: "hour" });
    return expectedDue;
  };
  try {
    const copy = await service.resolveCopyByBarcode("COPY-9");
    assert.equal(copy.due_date_preview, expectedDue);
    assert.equal(copy.title, "Short loan");
    repository.findCopyByBarcode = async () => ({ id: 10, loan_duration_minutes: null, loan_duration_unit: null });
    assert.equal((await service.resolveCopyByBarcode("COPY-10")).due_date_preview, null);
    repository.findCopyByBarcode = async () => null;
    assert.equal(await service.resolveCopyByBarcode("UNKNOWN"), null);
  } finally {
    repository.findCopyByBarcode = originalFind;
    duration.calculateLoanDueDate = originalDue;
  }
});

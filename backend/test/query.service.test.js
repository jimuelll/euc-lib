const test = require("node:test");
const assert = require("node:assert/strict");

const { buildWhere, filterClearanceRows, DATASETS } = require("../modules/query/query.service");
const { formatQueryValue } = require("../modules/query/query.format");

test("query service exposes only approved operational datasets", () => {
  assert.deepEqual(Object.keys(DATASETS), ["catalog", "users", "borrowings", "reservations", "attendance", "notifications", "subscriptions", "clearance"]);
  assert.throws(() => buildWhere("audit"), { status: 400 });
});

test("clearance query narrows live exceptions without changing the source rows", () => {
  const rows = [
    { name: "Ana", studentEmployeeId: "S-1", overdueCount: 2, overdueTitles: ["History"], outstandingAmount: 50, fineRecords: 1 },
    { name: "Ben", studentEmployeeId: "S-2", overdueCount: 0, overdueTitles: [], outstandingAmount: 25, fineRecords: 1 },
  ];
  assert.deepEqual(filterClearanceRows(rows, { clearanceReason: "both", search: "history" }).map((row) => row.studentEmployeeId), ["S-1"]);
  assert.equal(rows[0].overdueTitles[0], "History");
  assert.throws(() => filterClearanceRows(rows, { dateFrom: "2026-09-01" }), { status: 400 });
});

test("query export date-times stop at minutes and dates remain date-only", () => {
  const timestamp = "2026-09-19T04:23:45.000Z";
  assert.match(formatQueryValue(timestamp, "dateTime"), /12:23 PM/);
  assert.doesNotMatch(formatQueryValue(timestamp, "dateTime"), /:45/);
  assert.doesNotMatch(formatQueryValue(timestamp, "date"), /12:23/);
});

test("query service validates date ranges and keeps catalog soft deletes out", () => {
  assert.throws(() => buildWhere("catalog", { dateFrom: "2026-09-20", dateTo: "2026-09-19" }), { status: 400 });
  assert.throws(() => buildWhere("catalog", { dateFrom: "2026-02-30" }), { status: 400 });
  const query = buildWhere("catalog", { search: "History", materialType: "book", dateFrom: "2026-09-01", dateTo: "2026-09-19" });
  assert.match(query.clause, /b\.deleted_at IS NULL/);
  assert.match(query.clause, /b\.material_type = \?/);
  assert.deepEqual(query.params, ["%History%", "%History%", "%History%", "2026-09-01", "2026-09-19", "book"]);
});

test("query service rejects unsupported filter values", () => {
  assert.throws(() => buildWhere("borrowings", { status: "deleted" }), { status: 400 });
  assert.throws(() => buildWhere("attendance", { scanType: "scan" }), { status: 400 });
});

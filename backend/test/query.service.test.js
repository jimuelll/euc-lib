const test = require("node:test");
const assert = require("node:assert/strict");

const { buildWhere, DATASETS } = require("../modules/query/query.service");

test("query service exposes only approved operational datasets", () => {
  assert.deepEqual(Object.keys(DATASETS), ["catalog", "users", "borrowings", "reservations", "attendance", "notifications", "subscriptions"]);
  assert.throws(() => buildWhere("audit"), { status: 400 });
});

test("query service validates date ranges and keeps catalog soft deletes out", () => {
  assert.throws(() => buildWhere("catalog", { dateFrom: "2026-09-20", dateTo: "2026-09-19" }), { status: 400 });
  const query = buildWhere("catalog", { search: "History", materialType: "book", dateFrom: "2026-09-01", dateTo: "2026-09-19" });
  assert.match(query.clause, /b\.deleted_at IS NULL/);
  assert.match(query.clause, /b\.material_type = \?/);
  assert.deepEqual(query.params, ["%History%", "%History%", "%History%", "2026-09-01", "2026-09-19", "book"]);
});

test("query service rejects unsupported filter values", () => {
  assert.throws(() => buildWhere("borrowings", { status: "deleted" }), { status: 400 });
  assert.throws(() => buildWhere("attendance", { scanType: "scan" }), { status: 400 });
});

const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeSeries, resolveDashboardRange } = require("../modules/analytics/analytics.helpers");

test("dashboard range defaults to seven days and supports configured ranges", () => {
  assert.equal(resolveDashboardRange(), 7);
  assert.equal(resolveDashboardRange("30d"), 30);
  assert.equal(resolveDashboardRange("month") >= 1, true);
});

test("analytics series fills missing labels with numeric zeroes", () => {
  assert.deepEqual(
    normalizeSeries([{ label: "2026-01-02", visits: "4" }], ["2026-01-01", "2026-01-02"], ["visits", "borrows"]),
    [
      { label: "2026-01-01", visits: 0, borrows: 0 },
      { label: "2026-01-02", visits: 4, borrows: 0 },
    ],
  );
});

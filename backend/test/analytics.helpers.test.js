const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeSeries, resolveDashboardRange } = require("../modules/analytics/analytics.helpers");
const {buildDateLabels}=require('../modules/analytics/analytics.helpers');
const {calendarDate}=require('../modules/analytics/analytics.calendar');
test('calendar dates and dashboard labels retain UTC+08 midnight boundaries',()=>{
 const now=new Date('2026-10-08T17:05:00Z');
 assert.equal(calendarDate(now),'2026-10-09');assert.equal(calendarDate('2026-10-03'),'2026-10-03');
 assert.deepEqual(buildDateLabels(7,now),['2026-10-03','2026-10-04','2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09']);
});

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

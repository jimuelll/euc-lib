const test = require("node:test");
const assert = require("node:assert/strict");
const time = require("../modules/time/library-time");
const duration = require("../modules/borrowing/loan-duration");
const settings = require("../modules/library-settings/library-settings.service");

test("Philippine deadline formatting remains correct in a UTC server process", () => {
  const due = new Date("2026-11-03T02:40:00.000Z");
  assert.equal(time.libraryDateKey(due), "2026-11-03");
  assert.match(time.formatLibraryDeadline(due), /Nov 3, 2026, 10:40 AM Philippine time \(UTC\+8\)/);
});

test("day loans retain their Philippine clock time and skip Philippine holidays", async () => {
  const original = settings.getHolidayDateSet;
  settings.getHolidayDateSet = async () => new Set(["2026-10-28"]);
  try {
    const due = await duration.calculateLoanDueDate(new Date("2026-10-26T17:40:00.000Z"), { minutes: 1440, unit: "day" });
    assert.equal(due.toISOString(), "2026-10-28T17:40:00.000Z");
    assert.equal(time.formatLibraryTime(due), "1:40 AM");
  } finally { settings.getHolidayDateSet = original; }
});

test("hour loans remain elapsed-time durations", async () => {
  const due = await duration.calculateLoanDueDate(new Date("2026-10-27T02:40:00.000Z"), { minutes: 240, unit: "hour" });
  assert.equal(due.toISOString(), "2026-10-27T06:40:00.000Z");
});

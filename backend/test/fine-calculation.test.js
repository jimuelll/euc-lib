const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateFine } = require("../modules/borrowing/fine-calculation");

const dueDate = "2026-09-29T12:00:00.000Z";

test("fine calculation has no charge at the due instant and charges the next interval after it", () => {
  assert.deepEqual(calculateFine({ dueDate, finePerHour: 2, now: dueDate }), {
    fineAmount: 0, hoursOverdue: 0, isOverdue: false,
  });
  assert.deepEqual(calculateFine({ dueDate, finePerHour: 2, now: "2026-09-29T12:00:00.001Z" }), {
    fineAmount: 2, hoursOverdue: 1, isOverdue: true,
  });
});

test("daily fines round up at a day boundary and use the return time when present", () => {
  assert.equal(calculateFine({
    dueDate,
    finePerHour: 3,
    fineInterval: "day",
    now: "2026-10-01T12:00:00.001Z",
  }).fineAmount, 9);
  assert.equal(calculateFine({
    dueDate,
    finePerHour: 3,
    returnedAt: "2026-09-29T12:00:00.001Z",
    now: "2026-10-10T12:00:00.000Z",
  }).fineAmount, 3);
});

test("invalid dates and missing due dates never produce NaN fines", () => {
  assert.deepEqual(calculateFine({ dueDate: null, finePerHour: 4 }), {
    fineAmount: 0, hoursOverdue: 0, isOverdue: false,
  });
  assert.deepEqual(calculateFine({ dueDate: "not-a-date", finePerHour: 4 }), {
    fineAmount: 0, hoursOverdue: 0, isOverdue: false,
  });
});

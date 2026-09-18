const test = require("node:test");
const assert = require("node:assert/strict");

const { getPagination, roundCurrency } = require("../modules/borrowing/borrowing.helpers");

test("borrowing pagination clamps invalid and oversized values", () => {
  assert.deepEqual(getPagination({ page: 0, limit: 500 }), { paged: true, safePage: 1, safeLimit: 100, offset: 0 });
  assert.deepEqual(getPagination({ page: 3, limit: 10 }), { paged: true, safePage: 3, safeLimit: 10, offset: 20 });
});

test("borrowing money values are rounded to cents", () => {
  assert.equal(roundCurrency("12.345"), 12.35);
  assert.equal(roundCurrency(undefined), 0);
});

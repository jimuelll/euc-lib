const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizePagination, parsePositiveSafeInteger } = require("../middlewares/numericInput");
const { normalizePublicCatalogFilters } = require("../modules/catalog/catalog.public-search");
const catalogMiddleware = require("../modules/catalog/catalog.middleware");
const reservationController = require("../modules/reservation/reservation.controller");

function responseRecorder() {
  return {
    statusCode: null,
    payload: null,
    locals: {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test("route IDs must be complete positive safe integers", () => {
  assert.equal(parsePositiveSafeInteger("42"), 42);
  for (const value of ["0", "-2", "2.5", "42tail", "9007199254740992", ""]) {
    assert.equal(parsePositiveSafeInteger(value), null, `reject ${JSON.stringify(value)}`);
  }
});

test("catalog and reservation routes reject partial ID strings with 400", async () => {
  const catalogReq = { params: { id: "42tail" } };
  const catalogRes = responseRecorder();
  let nextCalled = false;
  catalogMiddleware.validateBookId(catalogReq, catalogRes, () => { nextCalled = true; });
  assert.equal(catalogRes.statusCode, 400);
  assert.deepEqual(catalogRes.payload, { message: "Invalid book ID" });
  assert.equal(nextCalled, false);

  for (const [handler, params, expected] of [
    [reservationController.reserveBook, { bookId: "12tail" }, "Invalid book ID"],
    [reservationController.cancelReservation, { reservationId: "12tail" }, "Invalid reservation ID"],
  ]) {
    const res = responseRecorder();
    await handler({ params, user: { id: 5 } }, res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.payload, { message: expected });
  }
});

test("pagination clamps fractions, invalid values, huge offsets, and page sizes", () => {
  assert.deepEqual(normalizePagination("2.8", "150", 20, 100), {
    paged: true, safePage: 2, safeLimit: 100, offset: 100,
  });
  assert.deepEqual(normalizePagination("3tail", "-4", 20, 50), {
    paged: true, safePage: 1, safeLimit: 1, offset: 0,
  });
  const huge = normalizePagination("1e100", "100", 20, 100);
  assert.equal(Number.isSafeInteger(huge.offset), true);
  assert.equal(huge.offset + huge.safeLimit <= Number.MAX_SAFE_INTEGER, true);
});

test("catalogue pagination accepts only numeric input and caps public page size", () => {
  const filters = normalizePublicCatalogFilters({ page: "3tail", limit: "500" });
  assert.equal(filters.page, 1);
  assert.equal(filters.limit, 50);
  const decimal = normalizePublicCatalogFilters({ page: "2.8", limit: "10.9" });
  assert.equal(decimal.page, 2);
  assert.equal(decimal.limit, 10);
});

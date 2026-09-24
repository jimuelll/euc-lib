const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const fineLedger = require("../modules/borrowing/fine-ledger.service");
const borrowingRepository = require("../modules/borrowing/borrowing.repository");
const { mapBorrowingsWithFineDetails } = require("../modules/borrowing/overdue.helper");

const { getPagination, roundCurrency } = require("../modules/borrowing/borrowing.helpers");

test("borrowing pagination clamps invalid and oversized values", () => {
  assert.deepEqual(getPagination({ page: 0, limit: 500 }), { paged: true, safePage: 1, safeLimit: 100, offset: 0 });
  assert.deepEqual(getPagination({ page: 3, limit: 10 }), { paged: true, safePage: 3, safeLimit: 10, offset: 20 });
});

test("borrowing money values are rounded to cents", () => {
  assert.equal(roundCurrency("12.345"), 12.35);
  assert.equal(roundCurrency(undefined), 0);
});

test("fine displays use saved loan terms and fall back only for legacy rows", async () => {
  const originalQuery = db.query;
  const originalBalances = fineLedger.balancesForBorrowings;
  db.query = async (sql) => {
    if (sql.includes("SELECT overdue_fine_per_hour")) return [[{ overdue_fine_per_hour: 99, updated_at: null }], []];
    return [[], []];
  };
  fineLedger.balancesForBorrowings = async (ids) => new Map(ids.map((id) => [Number(id), {
    fineAmount: 10, paidAmount: 0, adjustedAmount: 0, balance: 10,
  }]));
  try {
    const [savedLoan, legacyLoan, archivedLoan] = await mapBorrowingsWithFineDetails([
      { id: 1, due_date: new Date(Date.now() - 60_000), fine_per_hour: 2, fine_interval: "day", initial_fine: 5 },
      { id: 2, due_date: new Date(Date.now() - 60_000), fine_per_hour: null, fine_interval: null, initial_fine: null },
      { id: 3, due_date: new Date(Date.now() - 60_000), returned_at: new Date(), fine_per_hour: 2, fine_interval: "day", initial_fine: 0, borrowing_archived_at: "2026-09-01 10:00:00", copy_barcode: "B-61" },
    ]);
    assert.equal(savedLoan.fine_per_hour, 2);
    assert.equal(savedLoan.fine_interval, "day");
    assert.equal(savedLoan.initial_fine, 5);
    assert.equal(legacyLoan.fine_per_hour, 99);
    assert.equal(legacyLoan.fine_interval, "hour");
    assert.equal(legacyLoan.initial_fine, 0);
    assert.equal(archivedLoan.is_archived, true);
    assert.equal(archivedLoan.copy_barcode, "B-61");
  } finally {
    db.query = originalQuery;
    fineLedger.balancesForBorrowings = originalBalances;
  }
});

test("fine detail lookup retains archived borrowing, patron, book, and copy labels", async () => {
  let capturedSql = "";
  const archivedFine = {
    id: 61,
    user_id: 8,
    borrowing_archived_at: "2026-09-01 10:00:00",
    patron_archived_at: "2026-09-02 10:00:00",
    book_archived_at: "2026-09-03 10:00:00",
    copy_archived_at: "2026-09-04 10:00:00",
    user_name: "Archived patron",
    book_title: "Archived or missing book",
    copy_barcode: "B-61",
  };
  const rows = await borrowingRepository.findBorrowingsForFineDetails(8, {
    query: async (sql, params) => {
      capturedSql = sql;
      assert.deepEqual(params, [8]);
      return [[archivedFine], []];
    },
  });

  assert.deepEqual(rows, [archivedFine]);
  assert.match(capturedSql, /LEFT JOIN users u ON u\.id = b\.user_id/);
  assert.match(capturedSql, /LEFT JOIN books bk ON bk\.id = b\.book_id/);
  assert.match(capturedSql, /LEFT JOIN book_copies bc ON bc\.id = b\.copy_id/);
  assert.doesNotMatch(capturedSql, /WHERE b\.deleted_at IS NULL/);
});

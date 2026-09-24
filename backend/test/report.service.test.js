const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const reportService = require("../modules/query/report.service");

test("holdings inventory validates and composes its current snapshot filters", () => {
  const query = reportService.holdingsWhere({ search: "ACC-42", program: "3", completion: "complete", status: "available" });
  assert.match(query.where, /bc\.deleted_at IS NULL/);
  assert.match(query.where, /h\.program_id = \?/);
  assert.match(query.where, /EXISTS \([\s\S]*FROM copy_holdings/);
  assert.match(query.where, /accession_claim_voids/);
  assert.match(query.where, /reservations/);
  const reserved = reportService.holdingsWhere({ status: "reserved" });
  assert.match(reserved.where, /s\.expires_at IS NULL OR s\.expires_at > NOW\(\)/);
  assert.equal(query.params.length, 11);
  assert.equal(query.params.at(-1), 3);
  assert.throws(() => reportService.holdingsWhere({ status: "anything" }), { status: 400 });
  assert.throws(() => reportService.holdingsWhere({ program: "x" }), { status: 400 });
});

test("holdings inventory paginates and exports copy level rows without date filters", async () => {
  const originalQuery = db.query;
  const calls = [];
  db.query = async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.startsWith("SELECT COUNT(*)")) return [[{ total: 26 }], []];
    return [[{ copyId: 51, title: "Atlas", accessionNumber: "A-51", lendingEligibility: "Eligible" }], []];
  };
  try {
    const result = await reportService.listReport({ report: "holdings_inventory", page: 2, limit: 25, search: "Atlas" });
    assert.equal(result.pagination.total, 26);
    assert.equal(result.pagination.page, 2);
    assert.equal(result.rows[0].copyId, 51);
    assert.match(calls[1].sql, /ready\.expires_at IS NULL OR ready\.expires_at > NOW\(\)/);
    assert.ok(result.columns.some((column) => column.key === "lendingEligibility"));
    assert.deepEqual(calls[1].params.slice(-2), [25, 25]);
    await assert.rejects(reportService.listReport({ report: "holdings_inventory", dateFrom: "2026-01-01" }), { status: 400 });
    const exported = await reportService.exportReport({ report: "holdings_inventory", completion: "missing" });
    assert.equal(exported.rows[0].accessionNumber, "A-51");
    assert.ok(calls.at(-1).sql.includes("LIMIT ? OFFSET ?"));
    assert.equal(calls.at(-1).params.at(-2), 10001);
  } finally {
    db.query = originalQuery;
  }
});

test("historical fine and usage reports retain archived loans and use saved policy names", async () => {
  const originalQuery = db.query;
  const statements = [];
  db.query = async (sql) => { statements.push(sql.replace(/\s+/g, " ")); return [[{ borrower: "Archived patron", title: "Old book", bookType: "Policy A" }], []]; };
  try {
    await reportService.listReport({ report: "fined" });
    const fineSql = statements.at(-1);
    assert.match(fineSql, /LEFT JOIN users/);
    assert.match(fineSql, /LEFT JOIN books/);
    assert.doesNotMatch(fineSql, /b\.deleted_at IS NULL|u\.deleted_at IS NULL|bk\.deleted_at IS NULL/);

    await reportService.listReport({ report: "resource_usage" });
    const usageSql = statements.at(-1);
    assert.match(usageSql, /loan_policy_name_snapshot/);
    assert.doesNotMatch(usageSql, /JOIN book_types|b\.deleted_at IS NULL|u\.deleted_at IS NULL|bk\.deleted_at IS NULL/);
  } finally { db.query = originalQuery; }
});

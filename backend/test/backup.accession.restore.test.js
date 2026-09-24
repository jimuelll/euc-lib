const test = require("node:test");
const assert = require("node:assert/strict");
const { payloadChecksum, upgradeBackup } = require("../modules/backup/snapshot.transforms");
const { prepareAccessionRestore } = require("../modules/backup/accession.restore");

test("v13 upgrade derives permanent claims from the snapshot's existing holdings", () => {
  const backup = {
    format: "euc-library-backup", version: 13, createdAt: "2026-09-24T00:00:00.000Z",
    tables: {
      books: [{ id: 5, title: "Atlas" }],
      book_copies: [{ id: 12, book_id: 5, barcode: "LIB-000005-002" }],
      copy_holdings: [{ copy_id: 12, accession_number: "ACC-12", created_by: 7, created_at: "2026-09-23 12:00:00" }],
    },
  };
  backup.integrity = { algorithm: "sha256", checksum: payloadChecksum(backup) };
  const upgraded = upgradeBackup(backup);
  assert.equal(upgraded.version, 15);
  assert.deepEqual(upgraded.tables.accession_claims[0], {
    accession_number: "ACC-12", copy_barcode: "LIB-000005-002", copy_id: 12,
    book_id: 5, book_title: "Atlas", claimed_by: 7, claimed_at: "2026-09-23 12:00:00",
  });
  assert.deepEqual(upgraded.tables.accession_claim_corrections, []);
  assert.deepEqual(upgraded.tables.accession_claim_voids, []);
});

test("restore retains a claim made after the snapshot and reapplies the holding to the same barcode", () => {
  const tables = {
    books: [{ id: 5, title: "Atlas" }],
    book_copies: [{ id: 12, book_id: 5, barcode: "LIB-000005-002" }],
    copy_holdings: [], accession_claims: [], accession_claim_corrections: [],
  };
  const live = {
    claims: [{ accession_number: "ACC-12", copy_barcode: "LIB-000005-002", copy_id: 12, book_id: 5, book_title: "Atlas", claimed_by: 7, claimed_at: "2026-09-24 00:00:00" }],
    corrections: [],
    holdings: [{ copy_id: 12, copy_barcode: "LIB-000005-002", book_id: 5, title: "Atlas", accession_number: "ACC-12", price: "15.00", location: "Shelf A" }],
  };
  const restored = prepareAccessionRestore(tables, live);
  assert.equal(restored.orphanedClaimCount, 0);
  assert.equal(restored.tables.copy_holdings.length, 1);
  assert.equal(restored.tables.copy_holdings[0].accession_number, "ACC-12");
  assert.equal(restored.tables.copy_holdings[0].location, "Shelf A");
  assert.equal(restored.tables.accession_claims.length, 1);
});

test("restore reconciles a permanent claim by barcode when its prior copy ID was reused", () => {
  const tables = {
    books: [{ id: 5, title: "Atlas" }],
    book_copies: [{ id: 91, book_id: 5, barcode: "LIB-000005-002" }],
    copy_holdings: [], accession_claims: [], accession_claim_corrections: [], accession_claim_voids: [],
  };
  const live = {
    claims: [{ accession_number: "ACC-12", copy_barcode: "LIB-000005-002", copy_id: 12, book_id: 5, book_title: "Atlas" }],
    corrections: [], voids: [],
    holdings: [{ copy_id: 12, copy_barcode: "LIB-000005-002", book_id: 5, title: "Atlas", accession_number: "ACC-12", location: "Shelf A" }],
  };
  const restored = prepareAccessionRestore(tables, live);
  assert.equal(restored.tables.copy_holdings[0].copy_id, 91);
  assert.equal(restored.tables.copy_holdings[0].accession_number, "ACC-12");
  assert.equal(restored.tables.accession_claims[0].copy_id, 12, "the immutable claim keeps its historical row ID while remaining bound to the barcode");
});

test("restore rejects an accession assigned to another physical copy", () => {
  const tables = {
    books: [{ id: 5, title: "Atlas" }, { id: 8, title: "Orbit" }],
    book_copies: [{ id: 22, book_id: 8, barcode: "LIB-000008-001" }],
    copy_holdings: [{ copy_id: 22, accession_number: "ACC-12" }],
    accession_claims: [{ accession_number: "ACC-12", copy_barcode: "LIB-000008-001", copy_id: 22, book_id: 8, book_title: "Orbit" }],
    accession_claim_corrections: [],
  };
  const live = { claims: [{ accession_number: "ACC-12", copy_barcode: "LIB-000005-002", copy_id: 12, book_id: 5, book_title: "Atlas" }], corrections: [], holdings: [] };
  assert.throws(() => prepareAccessionRestore(tables, live), { status: 409, message: /permanently claimed/ });
});

test("restore keeps claims orphaned when their physical copy is absent", () => {
  const tables = { books: [], book_copies: [], copy_holdings: [], accession_claims: [], accession_claim_corrections: [] };
  const live = { claims: [{ accession_number: "ACC-12", copy_barcode: "LIB-000005-002", copy_id: 12, book_id: 5, book_title: "Atlas" }], corrections: [], holdings: [] };
  const restored = prepareAccessionRestore(tables, live);
  assert.equal(restored.orphanedClaimCount, 1);
  assert.equal(restored.tables.accession_claims[0].accession_number, "ACC-12");
  assert.deepEqual(restored.tables.copy_holdings, []);
});

test("restoring a snapshot from before a correction keeps the replacement accession current", () => {
  const tables = {
    books: [{ id: 5, title: "Atlas" }],
    book_copies: [{ id: 12, book_id: 5, barcode: "LIB-000005-002" }],
    copy_holdings: [{ copy_id: 12, accession_number: "ACC-OLD", price: "8.00" }],
    accession_claims: [{ accession_number: "ACC-OLD", copy_barcode: "LIB-000005-002", copy_id: 12, book_id: 5, book_title: "Atlas" }],
    accession_claim_corrections: [],
  };
  const live = {
    claims: [
      { accession_number: "ACC-OLD", copy_barcode: "LIB-000005-002", copy_id: 12, book_id: 5, book_title: "Atlas" },
      { accession_number: "ACC-NEW", copy_barcode: "LIB-000005-002", copy_id: 12, book_id: 5, book_title: "Atlas" },
    ],
    corrections: [{ correction_id: "event-1", copy_barcode: "LIB-000005-002", copy_id: 12, book_id: 5, old_accession_number: "ACC-OLD", new_accession_number: "ACC-NEW" }],
    holdings: [{ copy_id: 12, copy_barcode: "LIB-000005-002", book_id: 5, title: "Atlas", accession_number: "ACC-NEW", price: "8.00" }],
  };
  const restored = prepareAccessionRestore(tables, live);
  assert.equal(restored.tables.copy_holdings[0].accession_number, "ACC-NEW");
  assert.equal(restored.tables.accession_claims.length, 2);
  assert.equal(restored.tables.accession_claim_corrections.length, 1);
});

test("restore retains void state and permanent claims made after an older snapshot", () => {
  const tables = {
    books: [{ id: 5, title: "Atlas" }],
    book_copies: [{ id: 12, book_id: 5, barcode: "LIB-000005-002" }],
    copy_holdings: [], accession_claims: [], accession_claim_corrections: [], accession_claim_voids: [],
  };
  const live = {
    claims: [{ accession_number: "ACC-VOID", copy_barcode: "LIB-000005-002", copy_id: 12, book_id: 5, book_title: "Atlas" }],
    corrections: [],
    voids: [{ accession_number: "ACC-VOID", copy_barcode: "LIB-000005-002", copy_id: 12, book_id: 5, book_title: "Atlas", reason: "Mistyped", voided_by: 7 }],
    holdings: [{ copy_id: 12, copy_barcode: "LIB-000005-002", book_id: 5, accession_number: "ACC-VOID", price: "5.00" }],
  };
  const restored = prepareAccessionRestore(tables, live);
  assert.equal(restored.tables.copy_holdings[0].accession_number, "ACC-VOID");
  assert.equal(restored.tables.accession_claims[0].accession_number, "ACC-VOID");
  assert.equal(restored.tables.accession_claim_voids[0].accession_number, "ACC-VOID");
});

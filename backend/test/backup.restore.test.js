const test = require("node:test");
const assert = require("node:assert/strict");

const { payloadChecksum, upgradeBackup } = require("../modules/backup/snapshot.transforms");

test("restore upgrades the previous snapshot version and adds newly registered tables", () => {
  const backup = {
    format: "euc-library-backup",
    version: 8,
    tables: { books: [], users: [] },
    schema: { tables: {} },
  };
  backup.integrity = { algorithm: "sha256", checksum: payloadChecksum(backup) };
  const upgraded = upgradeBackup(backup);
  assert.equal(upgraded.version, 15);
  assert.deepEqual(upgraded.tables.user_guide_modules, []);
  assert.deepEqual(upgraded.tables.departments, []);
  assert.deepEqual(upgraded.tables.fine_accounts, []);
  assert.deepEqual(upgraded.tables.fine_ledger_entries, []);
  assert.deepEqual(upgraded.tables.copy_holdings, []);
  assert.deepEqual(upgraded.tables.catalog_settings, [{ id: 1, show_unheld_in_opac: 1, updated_by: null }]);
  assert.deepEqual(upgraded.tables.delivery_outbox, []);
  assert.deepEqual(upgraded.tables.accession_claims, []);
  assert.deepEqual(upgraded.tables.accession_claim_corrections, []);
  assert.deepEqual(upgraded.tables.accession_claim_voids, []);
  assert.equal(upgraded.integrity.algorithm, "sha256");
});

test("restore upgrades v11 with holdings defaults and preserves tables that already exist", () => {
  const backup = {
    format: "euc-library-backup",
    version: 11,
    tables: { books: [], book_copies: [{ id: 7, barcode: "LIB-000001-001" }] },
    schema: { tables: {} },
  };
  backup.integrity = { algorithm: "sha256", checksum: payloadChecksum(backup) };
  const upgraded = upgradeBackup(backup);
  assert.equal(upgraded.version, 15);
  assert.deepEqual(upgraded.tables.copy_holdings, []);
  assert.deepEqual(upgraded.tables.catalog_settings, [{ id: 1, show_unheld_in_opac: 1, updated_by: null }]);
  assert.deepEqual(upgraded.tables.delivery_outbox, []);
  assert.equal(upgraded.tables.book_copies[0].barcode, "LIB-000001-001", "existing copies receive no invented accession number");

  const withExisting = {
    format: "euc-library-backup",
    version: 11,
    tables: {
      books: [],
      copy_holdings: [{ copy_id: 7, accession_number: "ACC-7" }],
      catalog_settings: [{ id: 1, show_unheld_in_opac: 0, updated_by: 3 }],
    },
    schema: { tables: {} },
  };
  withExisting.integrity = { algorithm: "sha256", checksum: payloadChecksum(withExisting) };
  const preserved = upgradeBackup(withExisting);
  assert.deepEqual(preserved.tables.copy_holdings, withExisting.tables.copy_holdings);
  assert.deepEqual(preserved.tables.catalog_settings, withExisting.tables.catalog_settings);

  const holdingsOnly = {
    format: "euc-library-backup", version: 11,
    tables: { books: [], copy_holdings: [{ copy_id: 8, accession_number: "ACC-8" }] },
    schema: { tables: {} },
  };
  holdingsOnly.integrity = { algorithm: "sha256", checksum: payloadChecksum(holdingsOnly) };
  assert.deepEqual(upgradeBackup(holdingsOnly).tables.copy_holdings, holdingsOnly.tables.copy_holdings);

  const settingsOnly = {
    format: "euc-library-backup", version: 11,
    tables: { books: [], catalog_settings: [{ id: 1, show_unheld_in_opac: 0 }] },
    schema: { tables: {} },
  };
  settingsOnly.integrity = { algorithm: "sha256", checksum: payloadChecksum(settingsOnly) };
  assert.deepEqual(upgradeBackup(settingsOnly).tables.catalog_settings, settingsOnly.tables.catalog_settings);
});

test("restore upgrades v12 loan provenance and preserves outbox, holdings, settings and delivery keys", () => {
  const backup = {
    format: "euc-library-backup",
    version: 12,
    tables: {
      books: [],
      borrowings: [{ id: 4, book_id: 9 }],
      delivery_outbox: [{ id: "event-1", event_type: "notification", payload: {}, status: "pending", locked_at: "2026-09-23 10:00:00" }],
      notifications: [{ id: 8, delivery_key: "notification-8" }],
      copy_holdings: [{ copy_id: 9, accession_number: "ACC-9" }],
      catalog_settings: [{ id: 1, show_unheld_in_opac: 0 }],
    },
  };
  backup.integrity = { algorithm: "sha256", checksum: payloadChecksum(backup) };
  const upgraded = upgradeBackup(backup);
  assert.equal(upgraded.version, 15);
  assert.equal(upgraded.tables.borrowings[0].loan_policy_id_snapshot, null);
  assert.equal(upgraded.tables.borrowings[0].loan_policy_name_snapshot, "Unknown historical policy");
  assert.deepEqual(upgraded.tables.delivery_outbox, backup.tables.delivery_outbox);
  assert.deepEqual(upgraded.tables.notifications, backup.tables.notifications);
  assert.deepEqual(upgraded.tables.copy_holdings, backup.tables.copy_holdings);
  assert.deepEqual(upgraded.tables.catalog_settings, backup.tables.catalog_settings);
});

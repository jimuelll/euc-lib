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
  assert.equal(upgraded.version, 11);
  assert.deepEqual(upgraded.tables.user_guide_modules, []);
  assert.deepEqual(upgraded.tables.departments, []);
  assert.deepEqual(upgraded.tables.fine_accounts, []);
  assert.deepEqual(upgraded.tables.fine_ledger_entries, []);
  assert.equal(upgraded.integrity.algorithm, "sha256");
});

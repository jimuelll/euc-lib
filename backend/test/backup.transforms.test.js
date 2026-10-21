const test = require("node:test");
const assert = require("node:assert/strict");

const {
  decodeValue,
  encodeValue,
  payloadChecksum,
  validateBackup,
  upgradeBackup,
} = require("../modules/backup/snapshot.transforms");

test("backup values preserve buffers and normalize JSON for restore", () => {
  const encoded = encodeValue(Buffer.from("snapshot"));
  assert.equal(decodeValue(encoded).toString(), "snapshot");
  assert.equal(decodeValue({ enabled: true }, "json"), '{"enabled":true}');
  assert.throws(() => decodeValue("{broken", "json"), /invalid JSON/i);
});

test("version 15 snapshots upgrade with empty private drafts and a verified checksum", () => {
  const backup = {format:"euc-library-backup",version:15,tables:{books:[]}};
  backup.integrity={algorithm:"sha256",checksum:payloadChecksum(backup)};
  const upgraded=upgradeBackup(backup);
  assert.equal(upgraded.version,18);
  assert.deepEqual(upgraded.tables.website_content_drafts,[]);
  assert.ok(upgraded.tableManifest.includes("website_content_drafts"));
  assert.equal(upgraded.integrity.checksum,payloadChecksum(upgraded));
});

test("backup validation and checksums reject malformed payloads", () => {
  const backup = { format: "euc-library-backup", version: 9, tables: { books: [] } };
  assert.equal(validateBackup(backup), true);
  assert.equal(payloadChecksum(backup), payloadChecksum({ ...backup, integrity: { checksum: "ignored" } }));
  assert.equal(validateBackup({ version: 9, tables: {} }), false);
});

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

test('version 18 notifications upgrade to in-app-only defaults without creating email intent',()=>{
 const backup={format:'euc-library-backup',version:18,tables:{notifications:[{id:7,title:'Existing announcement'}]}};
 backup.integrity={algorithm:'sha256',checksum:payloadChecksum(backup)};
 const upgraded=upgradeBackup(backup);assert.equal(upgraded.version,25);
 assert.deepEqual(upgraded.tables.notifications[0],{id:7,title:'Existing announcement',email_requested:0,email_batch_id:null,email_expires_at:null,image_url:null,image_public_id:null,image_alt:null});
});

test("version 15 snapshots upgrade with empty private drafts and a verified checksum", () => {
  const backup = {format:"euc-library-backup",version:15,tables:{books:[]}};
  backup.integrity={algorithm:"sha256",checksum:payloadChecksum(backup)};
  const upgraded=upgradeBackup(backup);
  assert.equal(upgraded.version,25);
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

test('version 20 backups acquire an empty selected-recipient table with a valid checksum',()=>{
 const backup={format:'euc-library-backup',version:20,tables:{notifications:[]}};
 backup.integrity={algorithm:'sha256',checksum:payloadChecksum(backup)};
 const upgraded=upgradeBackup(backup);assert.equal(upgraded.version,25);assert.deepEqual(upgraded.tables.notification_recipients,[]);assert.ok(upgraded.tableManifest.includes('notification_recipients'));assert.equal(upgraded.integrity.checksum,payloadChecksum(upgraded));
});

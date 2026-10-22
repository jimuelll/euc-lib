// Spawned only by the guarded database integration test. Never uses live media.
const {randomUUID} = require('node:crypto');
const mode = process.env.READINESS_RESTORE_CRASH;
if (process.env.RUN_DB_INTEGRATION !== '1' || !/_test$/i.test(process.env.DB_NAME || '') || !['before', 'after'].includes(mode)) {
  throw new Error('Restore crash fixture requires an explicit test database and crash phase');
}
const db = require('../db');
const repository = require('../modules/backup/restore.repository');
const snapshot = require('../modules/backup/snapshot.service');
const backup = require('../modules/backup/backup.repository');
const storage = require('../modules/backup/snapshot.storage.service');
const verification = require('../modules/backup/backup.verification');
const pause = async phase => {process.send({phase}); await new Promise(() => {});};

(async () => {
  const payload = await snapshot.createBackupPayload();
  await db.query('UPDATE site_content_settings SET hero_title=? WHERE id=1', [`READINESS-CRASH-${mode}`]);
  storage.uploadSnapshot = async (_payload, actor, kind) => {
    const saved = await backup.createSnapshotRecord({publicId: `readiness-${randomUUID()}`, filename: 'readiness-crash.json', sizeBytes: 1, kind, createdBy: actor});
    return {id: saved.insertId};
  };
  verification.verifyStoredSnapshot = async () => ({verifiedAt: new Date().toISOString()});
  const getConnection = db.getConnection.bind(db), replace = repository.replaceApplicationData;
  let replacing = false;
  db.getConnection = async () => {
    const conn = await getConnection();
    if (replacing && mode === 'before') {
      conn.commit = async () => pause('before-commit');
    }
    return conn;
  };
  repository.replaceApplicationData = async (...args) => {
    replacing = true;
    const result = await replace(...args);
    if (mode === 'after') await pause('after-commit');
    return result;
  };
  await require('../modules/backup/snapshot.restore.service').performRestore(payload, {restoredBy: 1});
  throw new Error('Crash fixture unexpectedly completed');
})().catch(error => {
  if (process.connected) process.send({error: error.code || error.name || 'UNKNOWN'});
  process.exitCode = 1;
  db.end().catch(() => {});
});

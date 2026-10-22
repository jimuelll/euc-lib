const test = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const db = require('../db');
const posts = require('../modules/bulletin/bulletin.repository');
const bulletin = require('../modules/bulletin/bulletin.service');
const publishing = require('../modules/publishing/publishing.service');
const recovery = require('../modules/backup/restore-recovery.service');
const audit = require('../modules/analytics/analytics.audit.service');
const enabled = process.env.RUN_DB_INTEGRATION === '1' && /_test$/i.test(process.env.DB_NAME || '');
const options = {skip: enabled ? false : 'requires RUN_DB_INTEGRATION=1 and a dedicated *_test database'};
if (require.main === module) require('node:test').after(() => db.end());

async function fixture(work) {
  const identifier = `READINESS-${randomUUID().slice(0, 12)}`;
  const [user] = await db.query("INSERT INTO users(student_employee_id,username,name,password_hash,role,is_active,must_change_password) VALUES (?,?,'Readiness fixture','unusable','staff',1,0)", [identifier, identifier]);
  let post;
  try {
    post = await bulletin.createPost({id: user.insertId, role: 'staff'}, {title: identifier, content: 'Fixture', is_pinned: false});
    await work({userId: user.insertId, postId: post.id, identifier});
  } finally {
    if (post) await db.query('DELETE FROM bulletin_posts WHERE id=?', [post.id]);
    await db.query('DELETE FROM users WHERE id=?', [user.insertId]);
  }
}

test('database: direct and item/section/bulk publication preserve moderated and legacy deleted comments', options, async () => {
  await fixture(async ({userId, postId}) => {
    const visible = await posts.addComment(postId, userId, 'Visible');
    const moderated = await posts.addComment(postId, userId, 'Moderated');
    const legacy = await posts.addComment(postId, userId, 'Legacy deleted');
    await bulletin.deleteComment(moderated.id, {id: userId, role: 'staff'});
    await db.query('UPDATE bulletin_comments SET deleted_at=UTC_TIMESTAMP(),deleted_by=? WHERE id=?', [userId, legacy.id]);
    const [[before]] = await db.query('SELECT deleted_at,deleted_by FROM bulletin_comments WHERE id=?', [moderated.id]);
    const check = async () => {
      assert.deepEqual((await posts.findComments(postId)).map(row => row.id), [visible.id]);
      const [[after]] = await db.query('SELECT deleted_at,deleted_by FROM bulletin_comments WHERE id=?', [moderated.id]);
      assert.deepEqual(after, before);
    };
    await bulletin.deletePost(postId, {id: userId, role: 'staff'});
    assert.deepEqual(await posts.findComments(postId), []);
    await bulletin.restorePost(postId, {id: userId, role: 'staff'});
    await check();
    for (const mode of ['item', 'section', 'bulk']) for (const archived of [true, false]) {
      const document = await publishing.read('bulletin');
      const input = {section: 'bulletin', revision: document.revision, baseVersion: document.baseVersion,
        payload: {...document.payload, items: document.payload.items.map(item => item.id === postId ? {...item, archived} : item)},
        ...(mode === 'item' ? {itemKey: String(postId)} : {})};
      if (mode === 'bulk') await publishing.publishAll({documents: [input]}, userId);
      else await publishing.mutate('bulletin', 'publish', input, userId);
      if (archived) assert.deepEqual(await posts.findComments(postId), []);
      else await check();
    }
  });
});

test('database: missing/archived comments are rejected and archive wins a waiting comment insert', options, async () => {
  await fixture(async ({userId, postId}) => {
    await assert.rejects(posts.addComment(-1, userId, 'Missing'), {status: 404});
    const conn = await db.getConnection();
    let waiting;
    try {
      await conn.beginTransaction();
      await conn.query('SELECT id FROM bulletin_posts WHERE id=? FOR UPDATE', [postId]);
      waiting = posts.addComment(postId, userId, 'Too late');
      // Attach rejection handling immediately while the other connection waits.
      const rejected = assert.rejects(waiting, {status: 404});
      await conn.query('UPDATE bulletin_posts SET deleted_at=UTC_TIMESTAMP() WHERE id=?', [postId]);
      await conn.commit();
      await rejected;
      const [[count]] = await db.query('SELECT COUNT(*) AS total FROM bulletin_comments WHERE post_id=?', [postId]);
      assert.equal(Number(count.total), 0);
    } finally { await conn.rollback(); conn.release(); }
    await assert.rejects(posts.addComment(postId, userId, 'Archived'), {status: 404});
  });
});

test('database: role changes atomically invalidate access and revoke persisted refresh sessions', options, async () => {
  await fixture(async ({userId, identifier}) => {
    const sessions = require('../modules/auth/authSession.service');
    const admin = require('../modules/admin/admin.service');
    const claims = {id: userId, session_version: 0, iat: Math.floor(Date.now() / 1000) + 60};
    await sessions.issueRefreshSession(userId, new Date(Date.now() + 60_000), false, 0);
    assert.equal(await sessions.isAccessTokenCurrent(claims), true);
    await admin.updateUser(identifier, {role: 'scanner'}, 'admin', 1);
    assert.equal(await sessions.isAccessTokenCurrent(claims), false);
    const [[user]] = await db.query('SELECT role,session_version FROM users WHERE id=?', [userId]);
    assert.equal(user.role, 'scanner'); assert.equal(user.session_version, 1);
    const [[sessionsRow]] = await db.query('SELECT COUNT(*) AS total FROM auth_refresh_sessions WHERE user_id=? AND revoked_at IS NULL', [userId]);
    assert.equal(Number(sessionsRow.total), 0);
  });
});

test('database: active restore lock blocks recovery; failures roll back; concurrent recovery records one audit', options, async () => {
  const conn = await db.getConnection(), enqueue = audit.enqueueAuditEvent;
  try {
    await conn.query("SELECT GET_LOCK('euc-library-restore',0)");
    await db.query("UPDATE system_maintenance_state SET mode='restoring',started_at=UTC_TIMESTAMP() WHERE id=1");
    assert.equal(await recovery.recoverInterruptedRestore(), false);
    await conn.query("SELECT RELEASE_LOCK('euc-library-restore')");
    await db.query("UPDATE auth_restore_state SET invalid_before='2000-01-01 00:00:00' WHERE id=1");
    audit.enqueueAuditEvent = async () => {throw new Error('Injected audit failure');};
    await assert.rejects(recovery.recoverInterruptedRestore(), /Injected/);
    const [[failed]] = await db.query('SELECT mode FROM system_maintenance_state WHERE id=1');
    const [[marker]] = await db.query("SELECT DATE_FORMAT(invalid_before,'%Y-%m-%d %H:%i:%s') AS value FROM auth_restore_state WHERE id=1");
    assert.equal(failed.mode, 'restoring'); assert.equal(marker.value, '2000-01-01 00:00:00');
    audit.enqueueAuditEvent = enqueue;
    const [[before]] = await db.query("SELECT COUNT(*) AS total FROM delivery_outbox WHERE event_type='audit' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.route'))='/system/restore-recovery'");
    const results = await Promise.all([recovery.recoverInterruptedRestore(), recovery.recoverInterruptedRestore()]);
    assert.equal(results.filter(Boolean).length, 1);
    const [[after]] = await db.query("SELECT COUNT(*) AS total FROM delivery_outbox WHERE event_type='audit' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.route'))='/system/restore-recovery'");
    assert.equal(Number(after.total) - Number(before.total), 1);
    const [[state]] = await db.query('SELECT mode FROM system_maintenance_state WHERE id=1');
    assert.equal(state.mode, 'normal');
  } finally {
    audit.enqueueAuditEvent = enqueue;
    await conn.query("SELECT RELEASE_LOCK('euc-library-restore')"); conn.release();
    await db.query("UPDATE system_maintenance_state SET mode='normal',started_at=NULL,started_by=NULL WHERE id=1");
  }
});

test('database: killed restore processes recover safely before and after database commit', {...options, timeout: 120_000}, async () => {
  const {fork} = require('node:child_process');
  const path = require('node:path');
  for (const mode of ['before', 'after']) {
    const [[original]] = await db.query('SELECT hero_title FROM site_content_settings WHERE id=1');
    const child = fork(path.join(__dirname, 'restore-crash.fixture.js'), [], {
      execArgv: ['-r', 'ts-node/register/transpile-only'],
      env: {...process.env, READINESS_RESTORE_CRASH: mode},
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    const exited = new Promise(resolve => child.once('exit', resolve));
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Crash fixture did not reach ${mode} commit`)), 45_000);
        child.once('error', error => {clearTimeout(timer); reject(error);});
        child.once('exit', code => {clearTimeout(timer); reject(new Error(`Crash fixture exited early (${code})`));});
        child.on('message', message => {
          clearTimeout(timer);
          if (message.error) reject(new Error(`Crash fixture failed (${message.error})`));
          else {assert.equal(message.phase, `${mode}-commit`); resolve();}
        });
      });
      const [[active]] = await db.query('SELECT mode FROM system_maintenance_state WHERE id=1');
      assert.equal(active.mode, 'restoring');
      assert.equal(await recovery.recoverInterruptedRestore(), false);
      child.kill('SIGKILL');
      await exited;
      assert.equal(await recovery.recoverInterruptedRestore(), true);
      const [[state]] = await db.query('SELECT mode FROM system_maintenance_state WHERE id=1');
      const [[content]] = await db.query('SELECT hero_title FROM site_content_settings WHERE id=1');
      assert.equal(state.mode, 'normal');
      assert.equal(content.hero_title, mode === 'before' ? 'READINESS-CRASH-before' : original.hero_title);
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await exited;
      await db.query('UPDATE site_content_settings SET hero_title=? WHERE id=1', [original.hero_title]);
      await db.query("UPDATE system_maintenance_state SET mode='normal',started_at=NULL,started_by=NULL WHERE id=1");
    }
  }
});

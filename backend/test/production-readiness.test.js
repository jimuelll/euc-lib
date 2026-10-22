const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');
const bulletin = require('../modules/bulletin/bulletin.service');
const posts = require('../modules/bulletin/bulletin.repository');
const publisher = require('../modules/publishing/publishing.repository');
const recovery = require('../modules/backup/restore-recovery.service');
const audit = require('../modules/analytics/analytics.audit.service');
const hub = require('../realtime/notificationHub');

test('staff creation and direct pin service cannot change pins; admins can', async () => {
  const create = posts.createPost, get = posts.getPostForPin, pin = posts.pinPost;
  const calls = [];
  posts.createPost = async input => { calls.push(input); return {id: 1}; };
  posts.getPostForPin = async () => ({id: 1});
  posts.pinPost = async () => calls.push('pinned');
  try {
    const input = {title: 'Notice', content: 'Example', is_pinned: true};
    await assert.rejects(bulletin.createPost({id: 7, role: 'staff'}, input), {status: 403});
    await assert.rejects(bulletin.pinPost(1, true, {id: 7, role: 'staff'}), {status: 403});
    assert.deepEqual(calls, []);
    await bulletin.createPost({id: 7, role: 'staff'}, {...input, is_pinned: false});
    await bulletin.createPost({id: 8, role: 'admin'}, input);
    await bulletin.createPost({id: 9, role: 'super_admin'}, input);
    assert.deepEqual(calls.map(row => row.pinned), [false, true, true]);
  } finally { posts.createPost = create; posts.getPostForPin = get; posts.pinPost = pin; }
});

test('direct and publisher archive/restore preserve moderation fields and media', async () => {
  const query = db.query, find = posts.findPostForDelete;
  const cloudinary = require('cloudinary').v2, destroy = cloudinary.uploader.destroy;
  const subscriptions = require('../modules/subscriptions/subscriptions.service');
  const resources = require('../modules/subscriptions/subscriptions.repository');
  const remove = resources.deleteSubscription;
  const calls = [];
  let destroys = 0;
  const capture = async (sql, params) => { calls.push({sql, params}); return [{affectedRows: 1}]; };
  db.query = capture;
  posts.findPostForDelete = async () => ({author_id: 7, image_public_id: 'retained-image'});
  resources.deleteSubscription = async () => {};
  cloudinary.uploader.destroy = async () => { destroys++; };
  try {
    await bulletin.deletePost(1, {id: 7, role: 'staff'});
    await bulletin.restorePost(1, {id: 7, role: 'staff'});
    await subscriptions.deleteSubscription(1);
    const item = {id: 1, title: 'Post', content: 'Content', post_type: 'announcement', image_url: 'https://example.com/a.jpg', archived: false};
    await publisher.writeLive({query: capture}, 'bulletin', {items: [{...item, archived: true}]}, {items: [item]}, 7);
    await publisher.writeLive({query: capture}, 'bulletin', {items: [item]}, {items: [{...item, archived: true}]}, 7, '1');
    await publisher.writeLive({query: capture}, 'bulletin', {items: [{...item, deleted: true}]}, {items: [item]}, 7);
    assert.equal(destroys, 0);
    assert.equal(calls.some(({sql}) => /UPDATE bulletin_comments/.test(sql)), false);
    assert(calls.some(({sql}) => /UPDATE bulletin_posts/.test(sql)));
  } finally {
    db.query = query; posts.findPostForDelete = find;
    cloudinary.uploader.destroy = destroy; resources.deleteSubscription = remove;
  }
});

test('resource image removal/replacement keeps assets even if the database update fails', async () => {
  const service = require('../modules/subscriptions/subscriptions.service');
  const controller = require('../modules/subscriptions/subscriptions.controller');
  const get = service.getSubscriptionById, update = service.updateSubscription;
  const cloudinary = require('cloudinary').v2, destroy = cloudinary.uploader.destroy;
  let destroys = 0;
  service.getSubscriptionById = async () => ({id: 1, image_url: 'old', image_public_id: 'old-image'});
  cloudinary.uploader.destroy = async () => { destroys++; };
  try {
    for (const fails of [false, true]) for (const body of [{remove_image: true}, {image_url: 'new', image_public_id: 'new-image'}]) {
      let saved;
      service.updateSubscription = async (_id, input) => { saved = input; if (fails) throw new Error('simulated database failure'); return input; };
      const res = {code: 200, status(code) {this.code = code; return this;}, json(body) {this.body = body; return this;}};
      await controller.updateSubscription({params: {id: '1'}, body, user: {id: 8}}, res);
      assert.equal(res.code, fails ? 500 : 200);
      assert.equal(saved.image_public_id, body.remove_image ? null : 'new-image');
    }
    assert.equal(destroys, 0);
  } finally { service.getSubscriptionById = get; service.updateSubscription = update; cloudinary.uploader.destroy = destroy; }
});

test('comments lock the active parent before insertion and roll back rejected or failed writes', async () => {
  const getConnection = db.getConnection;
  try {
    for (const active of [false, true]) for (const failInsert of [false, true]) {
      const calls = [];
      db.getConnection = async () => ({
        beginTransaction: async () => calls.push('begin'),
        query: async sql => {
          calls.push(sql);
          if (sql.startsWith('SELECT id FROM bulletin_posts')) return [active ? [{id: 1}] : []];
          if (sql.startsWith('INSERT')) { if (failInsert) throw new Error('insert failed'); return [{insertId: 2}]; }
          return [[{id: 2, text: 'Example'}]];
        },
        commit: async () => calls.push('commit'), rollback: async () => calls.push('rollback'), release: () => calls.push('release'),
      });
      const run = posts.addComment(1, 7, 'Example');
      if (!active) await assert.rejects(run, {status: 404});
      else if (failInsert) await assert.rejects(run, /insert failed/);
      else assert.equal((await run).id, 2);
      assert.match(calls[1], /deleted_at IS NULL FOR UPDATE/);
      assert.equal(calls.some(call => typeof call === 'string' && call.startsWith('INSERT')), active);
      assert(calls.includes(active && !failInsert ? 'commit' : 'rollback'));
      assert.equal(calls.at(-1), 'release');
    }
  } finally { db.getConnection = getConnection; }
});

async function recoveryFixture(work, {active = false, failAudit = false, failClear = false} = {}) {
  const getConnection = db.getConnection, enqueue = audit.enqueueAuditEvent, close = hub.closeAllConnections;
  const state = {mode: 'restoring', invalidated: false, audits: 0};
  let held = active, closes = 0;
  db.getConnection = async () => {
    let working;
    let owns = false;
    return {
      beginTransaction: async () => { working = {...state}; },
      query: async sql => {
        if (sql.includes('GET_LOCK')) { if (held) return [[{acquired: 0}]]; held = owns = true; return [[{acquired: 1}]]; }
        if (sql.includes('RELEASE_LOCK')) { if (owns) held = false; return [[{released: 1}]]; }
        if (sql.startsWith('SELECT mode')) return [[{mode: working.mode, started_at: '2026-10-22'}]];
        if (sql.startsWith('UPDATE auth_')) working.invalidated = true;
        if (sql.startsWith('UPDATE system_')) { if (failClear) throw new Error('clear failed'); working.mode = 'normal'; }
        return [{affectedRows: 1}];
      },
      addAudit() {working.audits++;},
      commit: async () => Object.assign(state, working), rollback: async () => {}, release() {}, destroy() {if (owns) held = false;},
    };
  };
  audit.enqueueAuditEvent = async (conn, event) => {
    assert.equal(event.category, 'system'); assert.equal(event.metadata.restore_outcome, 'unknown');
    if (failAudit) throw new Error('audit failed'); conn.addAudit();
  };
  hub.closeAllConnections = () => {closes++;};
  try { await work(state, () => closes); }
  finally { db.getConnection = getConnection; audit.enqueueAuditEvent = enqueue; hub.closeAllConnections = close; }
}

test('restore recovery leaves active restores alone and recovers stale maintenance exactly once', async () => {
  await recoveryFixture(async state => {
    assert.equal(await recovery.recoverInterruptedRestore(), false);
    assert.deepEqual(state, {mode: 'restoring', invalidated: false, audits: 0});
  }, {active: true});
  await recoveryFixture(async (state, closes) => {
    const outcomes = await Promise.all([recovery.recoverInterruptedRestore(), recovery.recoverInterruptedRestore()]);
    assert.equal(outcomes.filter(Boolean).length, 1);
    assert.deepEqual(state, {mode: 'normal', invalidated: true, audits: 1});
    assert.equal(closes(), 1);
    assert.equal(await recovery.recoverInterruptedRestore(), false);
    assert.equal(state.audits, 1);
  });
});

test('recovery rolls back both session invalidation and maintenance changes on failure', async () => {
  for (const options of [{failAudit: true}, {failClear: true}]) await recoveryFixture(async (state, closes) => {
    await assert.rejects(recovery.recoverInterruptedRestore(), /failed/);
    assert.deepEqual(state, {mode: 'restoring', invalidated: false, audits: 0});
    assert.equal(closes(), 0);
  }, options);
});

test('server awaits recovery before listening; periodic recovery checks never overlap', async () => {
  const server = fs.readFileSync(path.join(__dirname, '../server.ts'), 'utf8');
  assert(server.indexOf('await recovery.recoverInterruptedRestore()') < server.indexOf('server.listen('));
  const interval = global.setInterval, getConnection = db.getConnection;
  let callback, connections = 0, finish;
  global.setInterval = (fn, delay) => {assert.equal(delay, 60_000); callback = fn; return {unref() {}};};
  db.getConnection = () => {connections++; return new Promise(resolve => {finish = resolve;});};
  try {
    recovery.startRestoreRecoveryJob();
    const pending = callback();
    await callback();
    assert.equal(connections, 1);
    finish({query: async () => [[{acquired: 0}]], release() {}});
    await pending;
  } finally { global.setInterval = interval; db.getConnection = getConnection; }
});

test('legacy patron returns report 410 without touching circulation or audits', async () => {
  const controller = require('../modules/borrowing/borrowing.controller');
  const service = require('../modules/borrowing/borrowing.service'), original = service.returnBook;
  service.returnBook = async () => {throw new Error('must not mutate circulation');};
  try {
    for (const role of ['student', 'staff', 'admin', 'super_admin']) {
      const res = {locals: {}, status(code) {this.code = code; return this;}, json(body) {this.body = body;}};
      await controller.returnBook({params: {borrowingId: '1'}, user: {id: 7, role}}, res);
      assert.equal(res.code, 410); assert.match(res.body.message, /circulation desk/);
      assert.deepEqual(res.locals, {});
    }
  } finally { service.returnBook = original; }
});

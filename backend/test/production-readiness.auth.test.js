const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../db');
const repo = require('../modules/admin/admin.repository');
const admin = require('../modules/admin/admin.service');
const outbox = require('../modules/delivery-outbox/outbox.repository');
const sessions = require('../modules/auth/authSession.service');
const hub = require('../realtime/notificationHub');
const {createLimiter} = require('../middlewares/rateLimiter');

test('role changes revoke sessions atomically; unchanged roles and failed updates preserve access', async () => {
  const original = {get: repo.getConnection, find: repo.findUserForUpdate, update: repo.updateUser,
    after: repo.findUserByIdForAudit, enqueue: outbox.enqueue, query: db.query, close: hub.closeUserConnections};
  try {
    for (const scenario of ['change', 'unchanged', 'profile', 'audit-failure', 'update-failure']) {
      const state = {id: 7, role: 'scanner', username: 'operator', student_employee_id: 'operator', name: 'Operator', session_version: 3, revoked: false};
      const calls = [];
      let working, closed = 0;
      const conn = {
        beginTransaction: async () => {working = {...state};},
        query: async sql => {
          if (sql.includes('session_version = session_version + 1')) {working.session_version++; calls.push('version');}
          if (sql.startsWith('UPDATE auth_refresh_sessions')) {working.revoked = true; calls.push('revoke');}
          return [[]];
        },
        commit: async () => {calls.push('commit'); Object.assign(state, working);},
        rollback: async () => {calls.push('rollback');}, release() {},
      };
      repo.getConnection = async () => conn;
      repo.findUserForUpdate = async () => ({...state});
      repo.updateUser = async (_identifier, input, connection) => {
        assert.equal(connection, conn); if (scenario === 'update-failure') throw new Error('update failed');
        Object.assign(working, input);
      };
      repo.findUserByIdForAudit = async () => ({...working});
      outbox.enqueue = async (kind, _payload, connection) => {
        assert.equal(connection, conn); assert.equal(kind, 'audit'); calls.push('audit');
        if (scenario === 'audit-failure') throw new Error('audit failed');
      };
      db.query = async sql => sql.includes('UNIX_TIMESTAMP') ? [[{invalidBeforeSeconds: null}]] : [[{session_version: state.session_version}]];
      hub.closeUserConnections = id => {assert.equal(id, 7); assert(calls.includes('commit')); closed++;};
      const input = scenario === 'profile' ? {name: 'New name'} : {role: scenario === 'unchanged' ? 'scanner' : 'opac'};
      const update = admin.updateUser('operator', input, 'admin', 1);
      if (scenario.endsWith('failure')) await assert.rejects(update, /failed/);
      else await update;
      const changed = scenario === 'change';
      assert.equal(state.session_version, changed ? 4 : 3);
      assert.equal(state.revoked, changed);
      assert.equal(closed, changed ? 1 : 0);
      assert.equal(await sessions.isAccessTokenCurrent({id: 7, session_version: 3}), !changed);
      if (changed) {
        assert(calls.indexOf('version') < calls.indexOf('audit'));
        assert(calls.indexOf('revoke') < calls.indexOf('commit'));
        const auth = require('../modules/auth/jwt.util');
        const controller = require('../modules/auth/auth.controller');
        const stale = auth.signRefreshToken({id: 7, jti: 'old', session_version: 3});
        const res = {status(code) {this.code = code; return this;}, json(body) {this.body = body;}, clearCookie() {}};
        await controller.handleRefresh({cookies: {refreshToken: stale}}, res);
        assert.equal(res.code, 401);
      }
    }
  } finally {
    repo.getConnection = original.get; repo.findUserForUpdate = original.find; repo.updateUser = original.update;
    repo.findUserByIdForAudit = original.after; outbox.enqueue = original.enqueue; db.query = original.query; hub.closeUserConnections = original.close;
  }
});

async function withLoginServer(work, {windowMs = 900_000, aggregate = 300} = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.post('/login', createLimiter('login', {windowMs, limit: aggregate}), createLimiter('loginIdentity', {windowMs}), (req, res) => {
    res.status(req.body.password === 'correct' ? 200 : 401).json({message: req.body.password === 'correct' ? 'Signed in' : 'Invalid credentials'});
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {server.once('listening', resolve); server.once('error', reject);});
  const send = async (identifier, password = 'incorrect', ip = '198.51.100.7') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/login`, {
      method: 'POST', headers: {'content-type': 'application/json', 'x-forwarded-for': ip},
      body: JSON.stringify({student_employee_id: identifier, password}),
    });
    const body = await response.json();
    await new Promise(resolve => setImmediate(resolve));
    return {status: response.status, headers: response.headers, body};
  };
  try {await work(send);} finally {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
}

test('110 school users share one IP; failed budgets normalize identity and isolate other users/IPs', async () => {
  await withLoginServer(async send => {
    for (let i = 0; i < 110; i++) assert.equal((await send(`student-${i}`, 'correct')).status, 200);
    for (let i = 0; i < 12; i++) assert.equal((await send('regular-user', 'correct')).status, 200);
    for (let i = 0; i < 5; i++) assert.equal((await send(' Operator ')).status, 401);
    const blocked = await send('OPERATOR');
    assert.equal(blocked.status, 429); assert.equal(blocked.body.code, 'RATE_LIMITED');
    assert(blocked.body.retryAfterSeconds > 0); assert(blocked.headers.has('retry-after'));
    assert.equal((await send('other-user', 'correct')).status, 200);
    assert.equal((await send('operator', 'correct', '198.51.100.8')).status, 200);
  });
});

test('aggregate login budget counts successes and failure windows reset', async () => {
  await withLoginServer(async send => {
    assert.equal((await send('one', 'correct')).status, 200);
    assert.equal((await send('two', 'correct')).status, 200);
    assert.equal((await send('three', 'correct')).status, 429);
  }, {aggregate: 2});
  await withLoginServer(async send => {
    for (let i = 0; i < 5; i++) assert.equal((await send('one')).status, 401);
    assert.equal((await send('one')).status, 429);
    await new Promise(resolve => setTimeout(resolve, 1_100));
    assert.equal((await send('one')).status, 401);
  }, {windowMs: 1_000});
});

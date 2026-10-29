const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db');
const jwt = require('../modules/auth/jwt.util');
const sessions = require('../modules/auth/authSession.service');

test('role gates retain staff desk access and reserve backup for super admins', async () => {
  const original = { verify: jwt.verifyAccessToken, current: sessions.isAccessTokenCurrent, active: sessions.isUserAccessActive };
  const paths = ['../modules/auth/auth.middleware', '../modules/clearance/clearance.routes', '../modules/backup/backup.routes', '../modules/reservation/adminReservation.routes', '../modules/admin/admin.routes'];
  const cached = paths.map(path => [require.resolve(path), require.cache[require.resolve(path)]]);
  jwt.verifyAccessToken = token => ({ id: 3, role: token });
  sessions.isAccessTokenCurrent = async () => true;
  sessions.isUserAccessActive = async () => true;
  for (const [path] of cached) delete require.cache[path];
  try {
    const clearance = require(paths[1]);
    const backup = require(paths[2]);
    const reservations = require(paths[3]);
    const users = require(paths[4]);
    const gate = (router, path) => router.stack.find(layer => layer.route?.path === path).route.stack[0].handle;
    async function allowed(handler, role) {
      let next = false, status;
      await handler({ headers: { authorization: `Bearer ${role}` } }, { status(code) { status = code; return this; }, json() {} }, () => { next = true; });
      if (!next) assert.equal(status, 403);
      return next;
    }
    for (const role of ['staff', 'admin', 'super_admin']) {
      assert.equal(await allowed(gate(users, '/users/:student_employee_id/borrowing'), role), true);
      assert.equal(await allowed(gate(clearance, '/clearance/payment'), role), true);
      assert.equal(await allowed(gate(clearance, '/clearance/queue'), role), true);
      assert.equal(await allowed(gate(reservations, '/reservations'), role), true);
      assert.equal(await allowed(gate(clearance, '/clearance/borrowings/:borrowingId/adjust'), role), role !== 'staff');
      assert.equal(await allowed(gate(clearance, '/clearance/transactions/:transactionId/reverse'), role), role !== 'staff');
      for (const layer of backup.stack.filter(layer => layer.route)) {
        assert.equal(await allowed(layer.route.stack[0].handle, role), role === 'super_admin', layer.route.path);
      }
    }
    for (const role of ['student','employee','alumni','scanner','opac']) assert.equal(await allowed(gate(users, '/users/:student_employee_id/borrowing'), role), false);
    const { requireCatalogRole } = require('../modules/catalog/catalog.middleware');
    let catalogAllowed = false;
    requireCatalogRole({ user: { role: 'staff' } }, {}, () => { catalogAllowed = true; });
    assert.equal(catalogAllowed, true);
  } finally {
    jwt.verifyAccessToken = original.verify;
    sessions.isAccessTokenCurrent = original.current;
    sessions.isUserAccessActive = original.active;
    for (const [path, value] of cached) { delete require.cache[path]; if (value) require.cache[path] = value; }
  }
});

test('payment permission comes from the authenticated user, never the request body', async () => {
  const service = require('../modules/clearance/clearance.service');
  const original = service.recordFullPayment;
  let input;
  service.recordFullPayment = async value => { input = value; return {}; };
  try {
    await require('../modules/clearance/clearance.controller').recordPayment({ method: 'POST', user: { id: 3, role: 'staff' }, body: { student_employee_id: 'TEST-1', amount: 50, actorRole: 'super_admin', role: 'admin' } }, { locals: {}, json() {} });
    assert.equal(input.actorRole, 'staff');
    assert.equal(input.createdBy, 3);
  } finally { service.recordFullPayment = original; }
});
if (require.main === module) test.after(() => db.end());

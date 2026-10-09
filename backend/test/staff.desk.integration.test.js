const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../db');

test('staff desk features work through the application mounts while financial and settings restrictions remain enforced', async () => {
  const cached = new Map();
  const replace = (path, value) => {
    const id = require.resolve(path);
    if (!cached.has(id)) cached.set(id, require.cache[id]);
    if (value === undefined) delete require.cache[id];
    else require.cache[id] = { id, filename: id, loaded: true, exports: value };
  };
  const next = (_req, _res, callback) => callback();
  const respond = (req, res) => res.json({ reached: req.originalUrl });
  const controller = () => new Proxy({}, { get: () => respond });
  const jwt = require('../modules/auth/jwt.util');
  const verify = jwt.verifyAccessToken;
  jwt.verifyAccessToken = role => ({ id: 3, role, must_change_password: false });
  replace('../modules/auth/authSession.service', { isAccessTokenCurrent: async () => true, isUserAccessActive: async () => true });
  replace('../modules/auth/auth.middleware');
  replace('../middlewares/rateLimiter', { limiters: new Proxy({}, { get: () => next }), rateLimitExposedHeaders: [] });
  replace('../middlewares/maintenanceMode', next);
  replace('../middlewares/auditLogger', next);
  replace('../modules/analytics/transactional-audit', { enqueueTransactionalAudit: async () => {} });
  replace('../modules/borrowing/overdue.helper', {
    syncOverdueBorrowings: async () => {},
    listUnsettledBorrowings: async () => ({ rows: [{ id: 1, unsettled_amount: 400 }], summary: { total_unsettled_amount: 400 } }),
  });
  const ledger = [];
  replace('../modules/clearance/clearance.repository', {
    getConnection: async () => ({ beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {}, query: async () => [[{ id: 1, receipt_number: 'TEST-RECEIPT', amount: 400 }]] }),
    findUserForPayment: async () => ({ id: 1 }),
    findOverdueBorrowings: async () => [],
    createTransaction: async input => { ledger.push(input); return { id: 1, receiptNumber: 'TEST-RECEIPT' }; },
  });
  replace('../modules/notifications/notifications.service', { enqueueNotification: async () => {} });
  replace('../modules/clearance/clearance.service');
  replace('../modules/clearance/clearance.controller');
  const clearance = require('../modules/clearance/clearance.controller');
  // Financial payment uses the real controller/service; other handlers just
  // identify successful dispatch so this fixture never writes to a database.
  replace('../modules/clearance/clearance.controller', { ...clearance, getProfile: respond, getQueue: respond, getReceipt: respond });
  replace('../modules/catalog/catalog.service', {
    getSchema: async () => [{ key: 'title', label: 'Title', type: 'text', required: true, scope: 'shared' }, { key: 'author', label: 'Author', type: 'text', required: true, scope: 'shared' }],
    getCatalogRecordForValidation: async () => ({ id: 1, title: 'Title', author: 'Author', material_type: 'book' }),
  });
  replace('../modules/catalog/catalog.middleware');
  for (const module of ['admin/admin', 'analytics/analytics', 'query/query', 'catalog/catalog', 'circulation/circulation', 'reservation/adminReservation', 'library-settings/library-settings', 'backup/backup', 'recommendations/recommendations', 'notifications/notifications']) {
    replace(`../modules/${module}.controller`, controller());
  }
  let server;
  try {
    const routers = {};
    for (const [name, path] of Object.entries({
      adminRoutes: 'admin/admin.routes', analyticsAdminRoutes: 'analytics/analytics.admin.routes', queryRoutes: 'query/query.routes',
      catalogRoutes: 'catalog/catalog.routes', circulationRoutes: 'circulation/circulation.routes', adminReservationRoutes: 'reservation/adminReservation.routes',
      librarySettingsRoutes: 'library-settings/library-settings.routes', backupRoutes: 'backup/backup.routes', clearanceRoutes: 'clearance/clearance.routes',
      recommendationRoutes: 'recommendations/recommendations.routes', notificationsRoutes: 'notifications/notifications.routes',
    })) {
      replace(`../modules/${path}`);
      routers[name] = require(`../modules/${path}`);
    }
    for (const name of ['authRoutes', 'publicCatalogRoutes', 'recommendationPublicRoutes', 'borrowingRoutes', 'reservationRoutes', 'bulletinRoutes', 'eventRoutes', 'aboutRoutes', 'attendanceRoutes', 'subscriptionsRoutes', 'analyticsRoutes', 'myLibraryRoutes', 'siteContentRoutes', 'userGuideRoutes', 'publishingRoutes']) routers[name] = express.Router();
    replace('../modules/admin/barcode.routes');
    replace('../modules', routers);
    replace('../app');
    const app = require('../app');
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = (path, method = 'GET', body, role = 'staff') => fetch(origin + '/api/admin' + path, { method, headers: { authorization: `Bearer ${role}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const allowed = [
      ['/dashboard'], ['/users'], ['/circulation/log'], ['/catalog-schema'], ['/catalog-settings'], ['/book-types'], ['/academic-programs'],
      ['/books'], ['/holdings'], ['/books/1/copies'], ['/books/1/holdings'],
      ['/books', 'POST', { title: 'New title', author: 'Author', material_type: 'book', book_type_id: 1 }],
      ['/books/1', 'PUT', { title: 'Updated title' }], ['/books/1', 'DELETE'], ['/books/1/restore', 'POST'],
      ['/books/1/copies', 'POST', { count: 1 }], ['/copies/1/holding', 'PUT', { accession_number: 'TEST-001' }],
      ['/copies/1/retire', 'POST'], ['/copies/1/restore', 'POST'], ['/copies/1', 'PATCH', { condition: 'good' }],
      ['/reservations'], ['/reservations/1/ready', 'POST'], ['/reservations/1/fulfill', 'POST'], ['/reservations/1/cancel', 'POST'],
      ['/reservations/1', 'DELETE'], ['/reservations/1/restore', 'PATCH'],
      ['/clearance/profile?student_employee_id=TEST-1'], ['/clearance/queue'], ['/clearance/receipts/TEST-RECEIPT'],
    ];
    for (const [path, method, body] of allowed) {
      const response = await request(path, method, body);
      assert.equal(response.status, 200, `${method || 'GET'} ${path}: ${await response.text()}`);
    }
    const denied = [
      ['/query'], ['/query/meta'], ['/query/export'], ['/query/reports'], ['/query/reports/export'],
      ['/backup/status'], ['/backup/restore', 'POST'], ['/catalog-schema/impact'], ['/catalog-schema', 'PUT'],
      ['/catalog-settings', 'PUT'], ['/book-types', 'POST'], ['/copies/1/holding/void-accession', 'POST'],
      ['/recommendations/books'], ['/clearance/borrowings/1/adjust', 'POST', { amount: 100, reason: 'Test' }],
      ['/clearance/transactions/1/reverse', 'POST', { reason: 'Test' }],
    ];
    for (const [path, method, body] of denied) assert.equal((await request(path, method, body)).status, 403, path);
    const partial = await request('/clearance/payment', 'POST', { student_employee_id: 'TEST-1', amount: 100, expectedOutstanding: 400, actorRole: 'admin' });
    assert.equal(partial.status, 403);
    assert.equal(ledger.length, 0);
    const full = await request('/clearance/payment', 'POST', { student_employee_id: 'TEST-1', amount: 400, expectedOutstanding: 400 });
    assert.equal(full.status, 200);
    assert.equal((await full.json()).message, 'Full payment recorded');
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].amount, 400);
    assert.equal((await request('/query', 'GET', undefined, 'admin')).status, 200);
    assert.equal((await request('/backup/status', 'GET', undefined, 'admin')).status, 403);
    assert.equal((await request('/backup/status', 'GET', undefined, 'super_admin')).status, 200);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    jwt.verifyAccessToken = verify;
    for (const [id, value] of cached) { delete require.cache[id]; if (value) require.cache[id] = value; }
  }
});
if (require.main === module) test.after(() => db.end());

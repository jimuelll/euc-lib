const test = require("node:test");
const assert = require("node:assert/strict");

const outboxRepository = require("../modules/delivery-outbox/outbox.repository");
const notifications = require("../modules/notifications/notifications.service");
const audit = require("../modules/analytics/analytics.audit.service");
const { drainOutbox } = require("../modules/delivery-outbox/outbox.service");

test("outbox retries notifications with the same idempotency key", async () => {
  const originals = {
    claimBatch: outboxRepository.claimBatch,
    markDelivered: outboxRepository.markDelivered,
    releaseForRetry: outboxRepository.releaseForRetry,
    createNotification: notifications.createNotification,
    error: console.error,
  };
  const attemptedKeys = [];
  const releases = [];
  const delivered = [];
  let claims = 0;
  outboxRepository.claimBatch = async () => {
    claims += 1;
    return claims === 1
      ? [{ id: "event-123", event_type: "notification", payload: { title: "Ready" }, attempts: 1 }]
      : [{ id: "event-123", event_type: "notification", payload: { title: "Ready" }, attempts: 2 }];
  };
  outboxRepository.markDelivered = async (id) => { delivered.push(id); };
  outboxRepository.releaseForRetry = async (...args) => { releases.push(args); };
  notifications.createNotification = async ({ deliveryKey }) => {
    attemptedKeys.push(deliveryKey);
    if (attemptedKeys.length === 1) throw new Error("temporary delivery error");
  };
  console.error = () => {};
  try {
    assert.equal(await drainOutbox(), 0);
    assert.equal(await drainOutbox(), 1);
    assert.deepEqual(attemptedKeys, ["event-123", "event-123"]);
    assert.equal(releases.length, 1);
    assert.equal(releases[0][0], "event-123");
    assert.equal(releases[0][1], 1);
    assert.deepEqual(delivered, ["event-123"]);
  } finally {
    outboxRepository.claimBatch = originals.claimBatch;
    outboxRepository.markDelivered = originals.markDelivered;
    outboxRepository.releaseForRetry = originals.releaseForRetry;
    notifications.createNotification = originals.createNotification;
    console.error = originals.error;
  }
});

test("outbox forwards stable event keys for audit records", async () => {
  const originals = {
    claimBatch: outboxRepository.claimBatch,
    markDelivered: outboxRepository.markDelivered,
    releaseForRetry: outboxRepository.releaseForRetry,
    recordAuditEvent: audit.recordAuditEvent,
  };
  const keys = [];
  const delivered = [];
  outboxRepository.claimBatch = async () => [
    { id: "audit-456", event_type: "audit", payload: { action: "updated" }, attempts: 0 },
  ];
  outboxRepository.markDelivered = async (id) => { delivered.push(id); };
  outboxRepository.releaseForRetry = async () => assert.fail("Successful audit delivery should not retry");
  audit.recordAuditEvent = async ({ eventKey }) => { keys.push(eventKey); };
  try {
    assert.equal(await drainOutbox(), 1);
    assert.deepEqual(keys, ["audit-456"]);
    assert.deepEqual(delivered, ["audit-456"]);
  } finally {
    outboxRepository.claimBatch = originals.claimBatch;
    outboxRepository.markDelivered = originals.markDelivered;
    outboxRepository.releaseForRetry = originals.releaseForRetry;
    audit.recordAuditEvent = originals.recordAuditEvent;
  }
});

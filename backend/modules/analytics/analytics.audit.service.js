const repository = require("./analytics.repository");
const outboxRepository = require("../delivery-outbox/outbox.repository");

const recordAuditEvent = async (event) => repository.recordAuditEvent(event);
const enqueueAuditEvent = (conn, event) => outboxRepository.enqueue("audit", event, conn || undefined);
const getAuditLog = async (options) => repository.getAuditLog(options);
const getAuditLogMeta = async () => repository.getAuditLogMeta();

module.exports = { recordAuditEvent, enqueueAuditEvent, getAuditLog, getAuditLogMeta };

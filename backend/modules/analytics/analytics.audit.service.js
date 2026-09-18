const repository = require("./analytics.repository");

const recordAuditEvent = async (event) => repository.recordAuditEvent(event);
const getAuditLog = async (options) => repository.getAuditLog(options);
const getAuditLogMeta = async () => repository.getAuditLogMeta();

module.exports = { recordAuditEvent, getAuditLog, getAuditLogMeta };

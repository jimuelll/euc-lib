import type { PoolConnection } from "mysql2/promise";

const repository = require("./analytics.repository");
const outboxRepository = require("../delivery-outbox/outbox.repository");

const recordAuditEvent = async (event: Record<string, any>): Promise<any> => repository.recordAuditEvent(event);
const enqueueAuditEvent = (conn: PoolConnection | null | undefined, event: Record<string, any>): Promise<any> => outboxRepository.enqueue("audit", {...event,description:require("./audit.feed.helpers").redact(event.description),metadata:require("./audit.feed.helpers").redact({...event.metadata,...require("./audit.context").auditContext.getStore()})}, conn || undefined);
const getAuditLog = async (options: Record<string, any>): Promise<any> => require("./audit.feed").getFeed(options);
const getAuditLogMeta = async (): Promise<any> => require("./audit.feed").getMeta();

export = { recordAuditEvent, enqueueAuditEvent, getAuditLog, getAuditLogMeta };

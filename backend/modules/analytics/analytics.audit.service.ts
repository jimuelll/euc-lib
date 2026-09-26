import type { PoolConnection } from "mysql2/promise";

const repository = require("./analytics.repository");
const outboxRepository = require("../delivery-outbox/outbox.repository");

const recordAuditEvent = async (event: Record<string, any>): Promise<any> => repository.recordAuditEvent(event);
const enqueueAuditEvent = (conn: PoolConnection | null | undefined, event: Record<string, any>): Promise<any> => outboxRepository.enqueue("audit", event, conn || undefined);
const getAuditLog = async (options: Record<string, any>): Promise<any> => repository.getAuditLog(options);
const getAuditLogMeta = async (): Promise<any> => repository.getAuditLogMeta();

export = { recordAuditEvent, enqueueAuditEvent, getAuditLog, getAuditLogMeta };

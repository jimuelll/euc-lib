import repository = require("./outbox.repository");
import type { DeliveryOutboxRow } from "./outbox.types";

let draining = false;

async function dispatch(row: DeliveryOutboxRow): Promise<void> {
  if (row.event_type === "notification") {
    if (row.payload.manualNotification === true || (row.payload.createdBy != null && !row.payload.sourceType)) {
      await require('../notifications/notifications.email.service').publish({...row.payload,sendEmail:row.payload.sendEmail===true && !row.payload.suppressEmail,deliveryKey:row.id});
      return;
    }
    const notifications = require("../notifications/notifications.service");
    const notice=await notifications.createNotification({ ...row.payload, deliveryKey: row.id });
    await require("../email/email.service").queueNotification(row.payload, row.id, row.created_at,notice?.id);
    return;
  }
  if (row.event_type === "email") return; // Durable handoff; the email worker sends independently.
  if (row.event_type === "audit") {
    const audit = require("../analytics/analytics.audit.service");
    await audit.recordAuditEvent({ ...row.payload, eventKey: row.id });
    return;
  }
  throw new Error(`Unsupported delivery event type: ${row.event_type}`);
}

async function drainOutbox(): Promise<number> {
  if (draining) return 0;
  draining = true;
  let delivered = 0;
  try {
    const rows: DeliveryOutboxRow[] = await repository.claimBatch();
    for (const row of rows) {
      try {
        await dispatch(row);
        await repository.markDelivered(row.id);
        delivered += 1;
      } catch (error) {
        console.error(`[delivery-outbox] Event ${row.id} (${row.event_type}) failed; it will be retried:`, error);
        try {
          await repository.releaseForRetry(row.id, row.attempts, error);
        } catch (retryError) {
          console.error(`[delivery-outbox] Could not schedule retry for ${row.id}:`, retryError);
        }
      }
    }
  } catch (error) {
    console.error("[delivery-outbox] Could not claim pending events:", error);
  } finally {
    draining = false;
  }
  return delivered;
}

function startDeliveryOutboxJob(): NodeJS.Timeout {
  void drainOutbox();
  const timer = setInterval(() => void drainOutbox(), 2000);
  timer.unref?.();
  return timer;
}

export = { drainOutbox, startDeliveryOutboxJob };

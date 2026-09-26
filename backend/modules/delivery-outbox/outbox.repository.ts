import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection } from "mysql2/promise";
import type { DeliveryEventType, DeliveryOutboxRow, DeliveryOutboxStoredRow } from "./outbox.types";

const db = require("../../db") as Pool;

const enqueue = async (
  eventType: DeliveryEventType,
  payload: Record<string, unknown>,
  conn: Pool | PoolConnection = db,
  eventId = randomUUID(),
): Promise<string> => {
  if (!["notification", "audit"].includes(eventType)) throw new TypeError("Unsupported outbox event type");
  await conn.query(
    "INSERT INTO delivery_outbox (id, event_type, payload) VALUES (?, ?, ?)",
    [eventId, eventType, JSON.stringify(payload)],
  );
  return eventId;
};

const claimBatch = async (limit = 25): Promise<DeliveryOutboxRow[]> => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<DeliveryOutboxStoredRow[]>(
      `SELECT id, event_type, payload, attempts
         FROM delivery_outbox
        WHERE status = 'pending' AND available_at <= NOW()
          AND (locked_at IS NULL OR locked_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE))
        ORDER BY created_at ASC, id ASC
        LIMIT ? FOR UPDATE`,
      [limit],
    );
    if (rows.length) {
      await conn.query(
        `UPDATE delivery_outbox SET locked_at = NOW(), attempts = attempts + 1
          WHERE id IN (${rows.map(() => "?").join(",")})`,
        rows.map((row) => row.id),
      );
    }
    await conn.commit();
    return rows.map((row) => ({
      ...row,
      attempts: Number(row.attempts) + 1,
      payload: (typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload) as Record<string, unknown>,
    }));
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const markDelivered = (eventId: string) => db.query(
  "UPDATE delivery_outbox SET status = 'delivered', delivered_at = NOW(), locked_at = NULL, last_error = NULL WHERE id = ? AND status = 'pending'",
  [eventId],
);

const releaseForRetry = (eventId: string, attempts: number, error: unknown) => {
  const delaySeconds = Math.min(3600, 5 * (2 ** Math.min(Math.max(attempts - 1, 0), 9)));
  const message = (error as { message?: unknown } | null | undefined)?.message ?? error ?? "Delivery failed";
  return db.query(
    `UPDATE delivery_outbox
        SET available_at = DATE_ADD(NOW(), INTERVAL ? SECOND), locked_at = NULL, last_error = ?
      WHERE id = ? AND status = 'pending'`,
    [delaySeconds, String(message).slice(0, 1000), eventId],
  );
};

export = { enqueue, claimBatch, markDelivered, releaseForRetry };

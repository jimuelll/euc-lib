const { randomUUID } = require("node:crypto");
const db = require("../../db");

async function enqueue(eventType, payload, conn = db, eventId = randomUUID()) {
  if (!["notification", "audit"].includes(eventType)) throw new TypeError("Unsupported outbox event type");
  await conn.query(
    "INSERT INTO delivery_outbox (id, event_type, payload) VALUES (?, ?, ?)",
    [eventId, eventType, JSON.stringify(payload)],
  );
  return eventId;
}

async function claimBatch(limit = 25) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
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
      payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
    }));
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

const markDelivered = (eventId) => db.query(
  "UPDATE delivery_outbox SET status = 'delivered', delivered_at = NOW(), locked_at = NULL, last_error = NULL WHERE id = ? AND status = 'pending'",
  [eventId],
);

const releaseForRetry = (eventId, attempts, error) => {
  const delaySeconds = Math.min(3600, 5 * (2 ** Math.min(Math.max(attempts - 1, 0), 9)));
  return db.query(
    `UPDATE delivery_outbox
        SET available_at = DATE_ADD(NOW(), INTERVAL ? SECOND), locked_at = NULL, last_error = ?
      WHERE id = ? AND status = 'pending'`,
    [delaySeconds, String(error?.message ?? error ?? "Delivery failed").slice(0, 1000), eventId],
  );
};

module.exports = { enqueue, claimBatch, markDelivered, releaseForRetry };

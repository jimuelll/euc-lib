const { syncExpired } = require("../modules/reservation/reservation.service");

const RESERVATION_EXPIRY_INTERVAL_MS = 60 * 1000;

async function runReservationExpiry() {
  try {
    const expired = await syncExpired();
    if (expired.length) console.log(`[reservation-expiry] Expired ${expired.length} reservation${expired.length === 1 ? "" : "s"}`);
  } catch (error) {
    console.error("[reservation-expiry] Failed to expire reservations:", error);
  }
}

function startReservationExpiryJob() {
  void runReservationExpiry();
  const timer = setInterval(() => void runReservationExpiry(), RESERVATION_EXPIRY_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

module.exports = { runReservationExpiry, startReservationExpiryJob };

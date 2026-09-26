import reservationService = require("../modules/reservation/reservation.service");
import logger = require("../logger");

const { syncExpired } = reservationService;
const { logDevelopment } = logger;
const RESERVATION_EXPIRY_INTERVAL_MS = 60 * 1000;

async function runReservationExpiry(): Promise<void> {
  try {
    const expired = await syncExpired();
    if (expired.length) {
      logDevelopment(`[reservation-expiry] Expired ${expired.length} reservation${expired.length === 1 ? "" : "s"}`);
    }
  } catch (error) {
    console.error("[reservation-expiry] Failed to expire reservations:", error);
  }
}

function startReservationExpiryJob(): NodeJS.Timeout {
  void runReservationExpiry();
  const timer = setInterval(() => void runReservationExpiry(), RESERVATION_EXPIRY_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

export = { runReservationExpiry, startReservationExpiryJob };
